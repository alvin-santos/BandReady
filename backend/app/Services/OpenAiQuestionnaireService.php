<?php

namespace App\Services;

use App\Console\Commands\OpenAiGenerateQuestionnaireCommand;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Section;
use App\Models\Test;
use App\Support\CelpipOfficialTaskCatalog;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use Symfony\Component\Console\Output\OutputInterface;

class OpenAiQuestionnaireService
{
    /** Canonical section names (JSON "name" field). */
    public const SECTIONS = ['Listening', 'Reading', 'Writing', 'Speaking'];

    /** OpenAI prompt: minimum passage length for Reading MCQ only when audio_script is empty/null (2× prior 2000). */
    private const MIN_READING_PASSAGE_CHARS = 4000;

    /** OpenAI prompt: Reading MCQ question_text should be a short stem only (soft cap for the model). */
    private const MAX_READING_MCQ_QUESTION_TEXT_CHARS = 280;

    /** Import validation: MCQ `audio_script` must be at least this long (UTF-8 chars)—blocks only trivial one-liners. */
    private const MIN_LISTENING_AUDIO_SCRIPT_CHARS = 400;

    /** Prompt / model guidance: encourage scripts at least this long for exam-style listening depth. */
    private const TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS = 2800;

    /** Maximum `audio_script` length (import + prompts)—keeps browser TTS practical. */
    private const MAX_LISTENING_AUDIO_SCRIPT_CHARS = 5200;

    /** Follow-up OpenAI turns when the model returns listening scripts under {@see MIN_LISTENING_AUDIO_SCRIPT_CHARS}. */
    private const LISTENING_AUDIO_SHORT_SCRIPT_MAX_RETRIES = 2;

    /**
     * If a Listening MCQ question_text uses these tokens (word-boundary match for single words), the same token must
     * appear in audio_script—catches common role/setting hallucinations (e.g. "barista" for a hardware-store clip).
     *
     * @var list<string>
     */
    private const LISTENING_STEM_LEXEMES_REQUIRING_SCRIPT_SUBSTRING = [
        'barista', 'baristas', 'bartender', 'sommelier', 'waiter', 'waitress', 'waitresses', 'hostess',
        'librarian', 'curator', 'barber', 'hairstylist', 'nurse', 'dentist', 'surgeon', 'pharmacist',
        'cashier', 'teller', 'receptionist', 'concierge', 'janitor', 'custodian', 'mechanic', 'plumber',
        'electrician', 'pilot',
    ];

    /**
     * Multi-word or drink tokens: if present in question_text, must appear in audio_script.
     *
     * @var list<string>
     */
    private const LISTENING_STEM_PHRASES_REQUIRING_SCRIPT_SUBSTRING = [
        'coffee shop', 'coffeehouse', 'coffee house', 'espresso', 'cappuccino', 'latte', 'frappuccino',
        'drive-thru', 'drive through', 'fast food',
    ];

    private const QUESTION_TYPES = [
        'multiple_choice',
        'essay',
        'speaking_prompt',
        'true_false',
        'fill_blank',
        'checkbox_multi',
    ];

    public function buildSystemPrompt(): string
    {
        $minPassage = self::MIN_READING_PASSAGE_CHARS;
        $maxStem = self::MAX_READING_MCQ_QUESTION_TEXT_CHARS;
        $minAudio = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
        $targetMinAudio = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
        $maxAudio = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;

        return <<<PROMPT
You output JSON only (no markdown) for an English exam prep app database import.

Root shape: {"exams":[...]}

Each exam object:
- "name": string (display name, e.g. "IELTS Academic")
- "code": string, unique, lowercase snake_case (e.g. "ielts_academic")
- "type": short string label (e.g. "academic", "general", "ls")

Each exam has "sections": array. Each section:
- "name": one of Listening, Reading, Writing, Speaking (or similar)
- "duration_minutes": positive integer (typical 15–60)
- "sort_order": integer starting at 1

Each section has "tests": array. Each test:
- "title": string (unique enough to identify the test)
- "difficulty": "easy" | "medium" | "hard" (schema allows all three for compatibility, but **BandReady content policy:** use **only** `"medium"` or `"hard"`—**never** `"easy"`. Across tests in the same output, set **roughly two-thirds** of tests to `"hard"` and the rest to `"medium"` unless the user explicitly requests otherwise.)
- "is_full_mock": boolean
- "practice_mode": "full" | "quick" (full = full mock; quick = short samples or timed single-skill sets)
- "duration_minutes": positive integer or null (null means use section duration)
- "is_available": boolean (default true)

Each test has "questions": array. Each question:
- "type": **required non-empty string**, exactly one of: multiple_choice, essay, speaking_prompt, true_false, fill_blank, checkbox_multi. For Speaking-section items use **speaking_prompt** (not a blank type, not "speaking" alone).
- "question_text": string (the prompt shown to the user). For **Reading multiple_choice** (no audio_script): **only a short question stem**—one clear sentence that refers to "the passage" or "the text", ideally under {$maxStem} characters. Examples: "According to the passage, which statement is correct?" or "What does the author imply about X?" Do **not** put the article, notice, story, or any long reading material in question_text; do **not** repeat or paraphrase the passage at length here. For Listening multiple_choice with audio_script, keep question_text similarly short. Other question types may use longer question_text as needed.
- "passage_text": string or null. **Listening multiple_choice** with non-empty **audio_script**: **passage_text is required** (do not use null). This is **only a scenario frame** so the learner knows *where/what kind of clip*—**not** a summary and **not** a hint. Use **one sentence**, or **two very short sentences** only if you must name both place and roles; target about **50–180 characters** total, plain English. **Allowed:** setting/place type + speaker **roles** (e.g. "A guest and a hotel receptionist.", "Public announcement at a library.", "Two coworkers talk at the office.")—like exam rubrics ("You will hear…"). **Forbidden in passage_text:** any **fact**, **number**, time, date, price, name, place name, outcome, problem, decision, offer, complaint, or topic detail that could overlap the **question_text** or **any option**; any wording of *what* they discuss beyond "a conversation" / "an announcement"; paraphrasing the stem; previewing who is "right" or what "happens". The listener must **not** be able to narrow answers from passage_text alone—only from the audio. Do **not** paste dialogue or quotes. For **Reading** multiple_choice with **no** audio_script: put **the entire reading material** here—**2 or 3 full paragraphs** (prefer 3 when possible), at least {$minPassage} characters total. **Formatting (mandatory):** separate paragraphs with a **blank line** (use `\n\n` inside the JSON string—i.e. newline, newline). Start each paragraph on its own line; optionally indent the first line of each paragraph with **4 spaces** for a print-style look (e.g. `"    First line...\n\n    Second para..."`). Do not output the passage as one giant unbroken line. The passage is what the user reads on screen; question_text is only the line above the choices. **Never reuse the same passage_text on more than one question in the same test**—duplicate passages break the UI. **If a test has 2+ Reading MCQs, each passage_text must be a wholly different source** (different scenario, genre, topic, and wording)—not one long passage reused for several questions, not copy-paste with small edits, not the same paragraph twice.
- "audio_url": null (app uses browser TTS from audio_script when set)
- "audio_script": string or null. REQUIRED for Listening multiple_choice: a **unique** clip per question (plain text; lines like "Customer: ..." / "Agent: ..."). **One line per speaker turn:** put the **full** role label and colon on a **single** line (e.g. `Store Clerk: …`)—do **not** break labels across lines (bad: `Store` newline `Clerk: …`), because the app’s browser TTS parses line breaks for turn-taking and split labels merge wrongly or delay the next voice. **Hard minimum {$minAudio}** characters (import rejects shorter). **Strongly prefer {$targetMinAudio}–{$maxAudio}** characters of **natural** dialogue or monologue (including role labels)—**many exchanges** or a well-developed single-speaker segment (often **~2–4 minutes** TTS at exam pace when you hit the preferred band). **Never exceed {$maxAudio}** (no novellas). Count characters as in the JSON string; do **not** pad with repetition or filler. This is spoken aloud; do not put the answer key here. **Never reuse the same audio_script text on more than one question in the same test**—each listening item needs its own distinct clip.
- "options_json": for multiple_choice, object with keys A,B,C,D and string values. For true_false/fill_blank/essay/speaking_prompt usually null. **speaking_prompt** may instead use **IELTS AI mock interview** shape: `{"ielts_speaking":{"mode":"ai_conversation"}}` (see **IELTS AI SPEAKING** below), or **CELPIP-style picture** shape: `{"speaking":{"celpip_mode":"…","image_generation_prompt":"…"}}` when requested—**never both** on the same question. For CELPIP picture rows, `celpip_mode` is **`describe`**, **`scenario`** (Task 3 — Describing a Scene), or **`predict`** (Task 4 — Making predictions: learner forecasts what happens next from the image—not the same as describing the scene).
- "correct_answer": for multiple_choice, single letter A–D. For true_false, "true" or "false". For fill_blank, the exact expected word or short phrase. For essay/speaking_prompt, a short **rubric** for graders/AI: prioritize **language** (range, accuracy, coherence) and **reasonable on-topic response**; for picture tasks, do not imply the candidate must enumerate every visual detail. For checkbox_multi, a JSON string of a sorted array of keys, e.g. "[\"A\",\"C\"]"
- "explanation": string or null (shown after submit; not read for listening). For **multiple_choice**, explain using the **substance** of the correct option (paraphrase from passage or audio)—**never** name which letter is correct (do not write "Option B", "choice D", "the answer is A"); option labels may be reordered for learners.
- "order": integer starting at 1 per test
- "celpip_task_number": optional integer (official CELPIP General–style task index for that section: Listening 1–6, Reading 1–4, Writing 1–2, Speaking 1–8). Omit or null when the question is not tied to a named CELPIP task type.
- "celpip_task_label": optional string; the **canonical English task name** for that number and section (must match the official list when `celpip_task_number` is set). When the user selects specific CELPIP section tasks for a generation run, these two fields are **mandatory** for every question in those sections (see the user message for that run).

Rules:
- Include at least one exam. When the user does not restrict sections: include at least two sections and at least one test per section with sensible question counts (e.g. Reading: 5–10 MCQ each with a **different** passage_text; Listening: several MCQ each with a **different** audio_script; Writing: 1–2 essay; Speaking: 1–2 speaking_prompt). When the user restricts to specific section(s) only, output only those sections—each with at least one test and sensible question counts—and omit all other section types.
- **Test `difficulty` must shape the questions, not only the label:** Use **only** `medium` or `hard` on each test (see field note—**do not** output `easy`). Author **every** question in that test to match that test’s level:
  - **medium:** B2-style (typical exam practice); mix of explicit detail and **one-step** inference about **ideas** (purpose, stance, consequence, comparison of views); plausible wrong options that need careful reading/listening but remain distinguishable; standard academic/general register as appropriate. **Not** drill-level or trivial recall of isolated facts when a deeper idea is available.
  - **hard:** upper B2–C1; denser or more nuanced passages and clips; **subtle implication**, formal or abstract wording, tone, and stems that require **integrating** two parts of the source around **meaning** (not around picking a figure). Wrong answers should be **attractive** partial interpretations—still only one keyed answer grounded in the source.
- **Idea-based answers — mandatory (all objective types):** Questions must be answerable by **meaning and reasoning**, not by plucking a digit. **Forbidden:** stems that centre on **“How many…?”, “How much…?”**, or any wording whose **natural** completion is a **quantity, price, tally, clock time, calendar date, or other bare number** as the keyed response. Passages and audio may still **mention** numbers for realism, but **do not** write MCQ/true_false/checkbox items whose **correct_answer** is primarily a numeral or whose options are **mostly numbers**. Prefer stems about **why, attitude, implication, purpose, problem/solution, recommendation, speaker’s view, main concern, relationship between ideas**, or **which statement best reflects…**. Options A–D should be **substantive statements or clauses** (paraphrases of ideas), not four alternative numerals. **fill_blank:** prefer **concept words or short phrases**—not blanks whose only correct completion is a standalone number. **Essay/speaking:** tasks must elicit **explanation, argument, or description of ideas**—not “state the number…” style prompts.
- Plausible content only; no copyrighted IELTS/CELPIP text—write original material in the same style.
- Ensure correct_answer always matches the keyed options for multiple_choice.
- **Multiple choice — correct letter distribution:** Within each test, **vary** which letter (A–D) is correct across questions—**do not** make almost every item the same letter (e.g. all A). Aim for a **roughly even spread** when a test has several MCQs. Explanations must **not** refer to letters (see explanation field)—only describe the correct *content*.

**Reading multiple_choice — topical alignment (mandatory):**
- Each **question_text** must be answerable **only** from **that same question’s passage_text**. The stem must reference the passage’s subject matter (e.g. composting, hiring policy, transit)—not generic trivia unrelated to the passage.
- **correct_answer** must be **directly supported** by a sentence or clear implication in passage_text. Put in **explanation** a short paraphrase of the supporting phrase or idea (1–2 sentences)—this proves the key is grounded.
- Wrong options (B, C, D) must stay **on the same topic** as the passage (same domain, vocabulary band, scenario) but be **clearly incorrect** for *this* text: contradicted, never stated, **idea-level** misstatements, or attribute misattributed. Do **not** use distractors about unrelated subjects (e.g. space travel when the passage is about library funding).
- **Forbidden:** stems that could be answered without reading the passage; copy-paste stems reused across different passages without fitting each passage; “filler” questions whose answer does not appear in the passage.

**Listening multiple_choice — topical alignment (mandatory):**
- **Authoring order:** For each item, **finish the full `audio_script` first**, then write **`question_text` and options A–D** so they test **only** content from **that** script. Do **not** pick a question “theme” in the abstract and then write a script that only loosely fits—**the stem must follow the script’s actual subject matter** (reason for the call, conflict, booking, complaint, announcement topic, etc.).
- Each **question_text** must ask about **specific ideas or information** carried in **that same question’s audio_script** (motives, attitudes, problems, decisions, relationships between what was said, reasons, implications, next steps in **non-numeric** terms where possible). The listener must **need** the clip to choose the answer—not general life knowledge. **Do not** centre stems on **how many / how much** or answers that reduce to picking a **number** (see **Idea-based answers** in Rules).
- **Semantic lock-in:** Every **content word** in `question_text` that names a topic, problem, object, place type, or activity (e.g. refund, prescription, gate change, strata fee, internship) must reflect something **actually spoken** in `audio_script`. If the stem could plausibly describe a **different** everyday conversation, it is **too generic**—rewrite it to target **this** clip’s central issue (use details the speakers name).
- **Stems to avoid or sharpen:** Vague stems like “What is the conversation mainly about?” / “What are they discussing?” often drift off-topic—**prefer** stems that ask **one** clear **idea-level** point (why, attitude, implied consequence, what concern is raised, what the speaker recommends, how two statements relate, what problem is being addressed, what happens next **in narrative terms**—not “how much” / “how many” / “at what exact time”). If you use a broad “main topic” stem, all four options must be **tight paraphrases of distinct themes** actually raised in **this** clip—not filler topics (travel, weather, sports) unless the script explicitly discusses them.
- **Options:** All four options must be **about the same situation** as the clip. Wrong answers = **false** for this dialogue (wrong number, wrong person, wrong reason) or **not stated**—**not** unrelated scenarios (e.g. passport renewal in a clip about a broken washing machine). **correct_answer** must match what is **said or clearly implied** in the clip. **explanation** must paraphrase the **supporting line or exchange** (no invented dialogue).
- **Forbidden:** generic listening stems unrelated to the dialogue; questions whose answer is common knowledge and not in the script; stems about a **sub-topic never mentioned** in the audio; identical `question_text` across items unless each audio_script clearly warrants a distinct stem tied to **its** clip.
- **Role and setting fidelity (Listening — mandatory):** The `question_text` must describe **only** the same situation as `audio_script`. Use the **exact speaker role labels** from the script (the words before “:” on dialogue lines, e.g. `Store Clerk:`, `Customer:`) or neutral phrases that fit **that** clip (“one of the speakers”, “the employee”, if the script clearly has an employee). **Never** name a different job or venue (e.g. do **not** write “barista”, “café”, “espresso”, or “waiter” if the dialogue is a **hardware store**, **clinic**, **bank**, etc.). Before finalizing each Listening MCQ, scan `question_text` **and all four options**: every job title or location-specific word must either appear in `audio_script` or be replaced with neutral wording tied to the script.
- **Listening scenario blurbs:** `passage_text` is **frame-only** (see field definition): setting + roles, **50–180 characters**, **no answer hints**. Each item’s blurb must be **unique** in the test (no copy-paste). **Check:** if someone could rule out an option using only `passage_text` + `question_text` without hearing audio, rewrite `passage_text` to be more neutral.
- **Self-check before output:** For each Listening MCQ ask: (1) “Does the stem ask about a detail **I can point to** in this `audio_script`?” (2) “Could this stem still make sense if I swapped in a random other listening clip?” If **yes**, the stem is too loose—rewrite.
- **CELPIP Listening task genre (when `celpip_task_number` / `celpip_task_label` are set):** The **audio_script** must match that **named** task—not only topic words in the stem. Example: **News item** = **broadcast-style** news (anchor/reporter, public story). **Do not** write a **Problem solving**-style customer–agent troubleshooting clip (e.g. laptop warranty at a desk) and label it **News item**. If the scenario is service-recovery dialogue, use **Problem solving** (task 1) metadata instead—or rewrite the audio into real news packaging.

- **IELTS AI SPEAKING (BandReady — Parts 1–3):** When an exam’s **code** starts with `ielts_` (e.g. `ielts_general`, `ielts_academic`) and the section is **Speaking**, **prefer** each Speaking test to include **exactly one** `speaking_prompt` with `options_json`: `{"ielts_speaking":{"mode":"ai_conversation"}}`. The app runs a **live AI examiner** turn-by-turn (user’s speech is transcribed; examiner lines are TTS). **Fields:** `question_text` — 2–5 sentences telling the learner they will complete a full IELTS-style AI interview (Parts 1–3) with the microphone, including Part 2 prep time. `passage_text` — one or two short lines: practice only, not a human examiner; scoring from transcripts (Pro). **`audio_script` must be null or empty** (do **not** embed a full examiner script—the model generates dialogue at runtime). `correct_answer` — rubric for post-submit AI feedback (language, coherence, task response). `explanation` — one sentence that examiner lines are generated per session. **Do not** combine `ielts_speaking.mode: "ai_conversation"` with `options_json.speaking.image_generation_prompt` on the **same** row. **Per test:** at most **one** `ai_conversation` item per test; do not output two `ai_conversation` prompts in the same `questions` array. If a global “questions per test” count would force more Speaking rows for an IELTS Speaking test, use **one** `ai_conversation` item anyway and **omit** extra `speaking_prompt` rows for that test (the single item covers the whole interview).

- **Speaking picture tasks (when the user requests CELPIP-style images):** For tests in the **Speaking** section, each **non–IELTS-AI** `speaking_prompt` may include `options_json.speaking` with `celpip_mode` (**`describe`** | **`scenario`** | **`predict`**) and `image_generation_prompt`. **Task 3 (Describing a Scene):** use `describe` or `scenario`; **`question_text` centres on what is shown**—the learner describes the visible scene (people, actions, setting, mood), not imaginary surroundings. **Task 4 (Making predictions):** use **`predict`**; **`question_text` must ask the learner to predict what will happen next (or likely outcomes) based on the picture**—not a pure “describe everything you see” prompt. In both cases the **main instruction** must explicitly anchor to **this image / the picture / the scene on screen** (see user-message SPEAKING PICTURE TASKS block when applicable). Use `explanation` to support graders (scene summary for Task 3; frozen moment + plausible futures for Task 4). Scoring still **prioritizes English delivery** (grammar, vocabulary, coherence). `correct_answer` holds a rubric aligned with the task type.

- Reading: vary topics across passages (e.g. government and policy, politics, law and regulations, science and research, health and medicine, environment and climate, technology and IT, business and finance, workplace and HR, education and training, housing and rentals, immigration and settlement, community programs, sports and recreation, arts and culture, travel and tourism, consumer rights, retail and e-commerce, public transit and infrastructure, agriculture, energy, weather and safety bulletins, biographies, book or film blurbs, product manuals, FAQs, terms of service, legal or municipal notices, job postings, conference or event schedules, museum or gallery text, nutrition or ingredient panels, surveys, editorials, letters to the editor, formal emails or memos) so every question’s passage_text differs. Enforce at least {$minPassage} characters per Reading multiple_choice passage_text **only when audio_script is null or empty**. Each such passage must be **2–3 paragraphs** with `\n\n` between paragraphs and readable line breaks (not a single run-on line). Enforce **short** question_text (stem only, ~≤{$maxStem} characters); if question_text is longer than passage_text for Reading MCQ, you have the fields reversed—fix it. **Per-test rule:** whenever you output more than one Reading multiple_choice in the **same** test’s `questions` array, treat each item as a **separate** reading task with its **own** passage_text; pairwise passages must not match or paraphrase each other closely. **Before finalizing each Reading MCQ, mentally verify:** “Could I answer this stem using only this passage_text?” If not, rewrite stem or passage.
- Listening: vary scenarios across clips (e.g. medical or dental reception, pharmacy pickup, bank or service counter, housing office, job centre, school or daycare messages, university registrar, library hours, gym or pool desk, car rental or repair, hotel front desk, airline or airport gate, train or bus announcements, taxi or rideshare, ferry terminal, lost and found, voicemail, customer-service callbacks, sales follow-ups, tech support tiers, insurance claims, utility outages, restaurant reservations, catering or delivery updates, retail returns, workplace meetings or stand-ups, training or safety briefings, team project check-ins, conference calls, radio news summaries, weather forecasts, traffic reports, podcast or interview excerpts, public event PA, community centre or recreation programs, charity or volunteer coordination, neighbour or strata notices) so every question’s audio_script differs. Every Listening multiple_choice **audio_script**: **≥{$minAudio}** characters; **aim {$targetMinAudio}–{$maxAudio}** (see field rules). **passage_text** = **minimal scenario frame only** (see field rules; ~50–180 characters, hint-free)—never null for Listening MCQ with audio. **Before finalizing each Listening MCQ, mentally verify:** “Does the stem ask about **this** clip’s central content?” “Does every option relate to **this** clip’s scenario?” “Does exactly one option match the script?” If not, rewrite `audio_script` or **question_text and options together** so they are one coherent unit.
PROMPT;
    }

    /**
     * Parse the Artisan `--section=*` option into canonical section names.
     *
     * @param  array<int, string>|string|null  $optionValue
     * @return list<string>|null null = no filter (generate all sections as usual)
     */
    public function parseSectionOption(array|string|null $optionValue): ?array
    {
        $chunks = [];
        if (is_string($optionValue)) {
            $optionValue = trim($optionValue) === '' ? [] : [$optionValue];
        }
        if (! is_array($optionValue)) {
            return null;
        }
        foreach ($optionValue as $chunk) {
            $chunk = trim((string) $chunk);
            if ($chunk === '') {
                continue;
            }
            foreach (preg_split('/\s*,\s*/', $chunk) as $part) {
                $part = trim($part);
                if ($part !== '') {
                    $chunks[] = $part;
                }
            }
        }
        if ($chunks === []) {
            return null;
        }

        $canonicalMap = [
            'listening' => 'Listening',
            'reading' => 'Reading',
            'writing' => 'Writing',
            'speaking' => 'Speaking',
        ];
        /** @var array<string, bool> $seen */
        $seen = [];
        foreach ($chunks as $label) {
            $k = strtolower($label);
            if (! isset($canonicalMap[$k])) {
                throw new InvalidArgumentException(
                    "Unknown section \"{$label}\". Use one or more of: ".implode(', ', self::SECTIONS).' (e.g. --section=Listening or --section=Listening,Speaking).'
                );
            }
            $seen[$canonicalMap[$k]] = true;
        }

        return array_keys($seen);
    }

    /**
     * Whether the current generate/import scope includes Speaking (for picture-speaking options).
     *
     * @param  list<string>|null  $onlySections
     * @param  array{exam: Exam, test: Test}|null  $existingTarget
     */
    public function sectionScopeIncludesSpeaking(?array $onlySections, ?array $existingTarget): bool
    {
        if ($existingTarget !== null) {
            $test = $existingTarget['test'];
            $test->loadMissing('section');

            return $test->section !== null && $test->section->name === 'Speaking';
        }
        if ($onlySections === null || $onlySections === []) {
            return true;
        }

        return in_array('Speaking', $onlySections, true);
    }

    /**
     * User-message appendix for --with-speaking-images: CELPIP Task 3 (describe scene) vs Task 4 (predict).
     *
     * @param  list<int>|null  $speakingCelpipTaskNumbers  Speaking task numbers from {@see CelpipOfficialTaskCatalog::filterApplicable} (null = unrestricted).
     */
    private function buildSpeakingPictureTasksUserAppend(?array $speakingCelpipTaskNumbers): string
    {
        $nums = $speakingCelpipTaskNumbers ?? [];
        $has3 = in_array(3, $nums, true);
        $has4 = in_array(4, $nums, true);
        $unrestricted = $nums === [];
        $wantsDescribe = $unrestricted || $has3 || (! $has4 && $nums !== []);
        $wantsPredict = $has4;

        $out = [];
        $out[] = '';
        $out[] = 'SPEAKING PICTURE TASKS (for this run, after import we generate DALL·E images where applicable):';
        $out[] = '- **IELTS AI conversation** rows (`options_json.ielts_speaking.mode` = `ai_conversation`): **no** `image_generation_prompt`; omit CELPIP `options_json.speaking` picture fields—those rows skip image generation.';
        $out[] = '- **All other** `speaking_prompt` rows in this JSON must include `options_json.speaking` with `celpip_mode` and `image_generation_prompt` as below.';
        $out[] = '- **Route by official CELPIP task (mandatory when `celpip_task_number` is set on the row):**';
        $out[] = '  - **Task 3 — Describing a Scene:** use `celpip_mode` **`describe`** or **`scenario`**. The learner **describes what is visible** in the picture.';
        $out[] = '  - **Task 4 — Making predictions:** use `celpip_mode` **`predict`**. The learner **predicts what will happen next** (or likely outcomes) **from evidence in the image**—**not** a task whose main ask is only to list or inventory everything shown.';
        if ($wantsDescribe && $wantsPredict) {
            $out[] = '- This run’s CELPIP focus includes **both** task types for Speaking: each `speaking_prompt` must set `celpip_task_number` / `celpip_task_label` and matching `celpip_mode` so Task 3 rows never use `predict`, and Task 4 rows never use describe/scenario as if they were Task 3.';
        } elseif ($wantsPredict && ! $wantsDescribe) {
            $out[] = '- This run targets **Making predictions** (Task 4): every picture `speaking_prompt` must use **`predict`** mode and Task **4** metadata—**do not** write describe-the-scene-only prompts.';
        }

        if ($wantsDescribe) {
            $out[] = '';
            $out[] = '**CELPIP Speaking Task 3 — Describing a Scene (describe / scenario):**';
            $out[] = '- The learner will see **one generated image** next to **question_text**. They must be asked to describe **that image’s content**—the visible scene—**not** their real environment, not generic “things around you”, not “what you notice on the street” unless you clearly mean **in the picture**. **Forbidden** as the core task: wording that invites describing imagined surroundings, a city tour, or anything **not** shown in the image (e.g. “describe some of the interesting things you see around you” without tying to the image). **Required:** at least one explicit anchor such as **“the image”**, **“this picture”**, **“the photo (on screen)”**, **“what you see in the picture”**, or **“the scene in the image”**—and the verbs/objects of the task must refer to **that** scene (who/what/where **shown**).';
            $out[] = '- celpip_mode:';
            $out[] = '  - "describe" — **question_text** (2–4 sentences, second person): optional one-line frame (e.g. exam-style “You are shown a picture”) + clear instruction to **describe the image** (main ideas, people, actions, setting, mood). The bulk of the task must be image-bound.';
            $out[] = '  - "scenario" — You may add a **short** role-play frame (who you are, who you are talking to—friend, sister, colleague). **Still** the speaking task must be: describe **the image / this picture** to that person—e.g. “You are on a call with your friend. **Look at the image on your screen** and **describe what is happening in it**…” **Bad:** “…describe interesting things you see around you” (implies real life, not the picture). **Good:** “…tell them **what you see in the image**—who is there, what they are doing, and what stands out.”';
            $out[] = '- image_generation_prompt: 50–150 words in English describing ONE coherent **present** scene for later image generation (no text in the image, no logos, no real celebrities; family-friendly exam style). Include setting, people, actions, key objects, mood. **question_text** must not ask for a different scene than this prompt.';
            $out[] = '- correct_answer (rubric): emphasize **English ability** and **reasonable engagement with the visible scene**; answers need not list every object.';
            $out[] = '- explanation: **Scene summary** (3–8 sentences)—what the image shows and typical themes a response might cover; not an exhaustive checklist. Scoring weights **language quality** and staying broadly **on the pictured scene** over photographic completeness.';
        }

        if ($wantsPredict) {
            $out[] = '';
            $out[] = '**CELPIP Speaking Task 4 — Making predictions (`celpip_mode`: `predict`):**';
            $out[] = '- **Different from Task 3:** the primary job is **speculation / forecasting** grounded in the picture, **not** a neutral catalogue of everything visible.';
            $out[] = '- **question_text (mandatory shape):** 2–5 sentences, second person. You must clearly ask the learner to **predict** (e.g. **what will happen next**, **what is likely to happen**, **what might occur**, **how this situation will probably unfold**) **based on what they see in the image / this picture / the scene on screen**. Include at least one explicit anchor tying the task to **the image** (same anchor family as Task 3). **Forbidden as the main instruction:** “describe everything you see”, “list all the things in the picture”, “tell us what is in the image” **without** a prediction ask—those are Task 3 patterns, not Task 4.';
            $out[] = '- **image_generation_prompt:** 50–150 words describing ONE coherent **still** that **supports forecasting**—show clear cues (body language, weather, objects in use, an action mid-way, expressions, unfinished business) so several **reasonable** next events are imaginable. Avoid a flat still life with no narrative tension unless the **question_text** explicitly mines subtle cues for predictions.';
            $out[] = '- **correct_answer (rubric):** Reward **plausible hypotheses** tied to **visible cues**; strong **English** (fluency, coherence, range) matters most. **There is no single “correct” future**—multiple reasonable predictions are acceptable. Do **not** require fortune-telling precision or one exact outcome; penalize only clearly **unrelated** speculation or ignoring the picture.';
            $out[] = '- **explanation:** Summarize the **frozen moment** (what is shown) and list **2–4 plausible directions** a strong answer might take—**not** one canonical “right answer” and **not** a demand to describe every object. State that grading favours **language** and **prediction quality grounded in the image** over exhaustive description.';
        }

        if ($wantsDescribe || $wantsPredict) {
            $out[] = '';
            $out[] = '**Shared field rules (picture speaking):**';
            $out[] = '- passage_text: Usually **null** when question_text already contains the scenario. Optional: one short line only (e.g. time limit)—do not duplicate the whole scenario.';
            $out[] = '- audio_url and audio_script: **null** unless you deliberately add a listening clip (default null).';
        }

        return implode("\n", $out);
    }

    /**
     * Normalize display strings for comparison (Unicode dash variants, horizontal whitespace, NFKC).
     * Reuses the same rules for exam names and test titles so CLI/API values match DB rows when only
     * punctuation differs (e.g. em dash vs hyphen, NBSP vs space).
     */
    public function normalizeTitleForMatch(string $title): string
    {
        $t = trim($title);
        $dashLike = ["\u{2013}", "\u{2014}", "\u{2015}", "\u{2212}", "\u{FE58}", "\u{FE63}", "\u{FF0D}"];
        $t = str_replace($dashLike, '-', $t);
        if (class_exists(\Normalizer::class)) {
            $n = \Normalizer::normalize($t, \Normalizer::FORM_KC);
            if (is_string($n)) {
                $t = $n;
            }
        }
        $t = preg_replace('/\h+/u', ' ', $t) ?? $t;

        return trim($t);
    }

    /**
     * @return Collection<int, Exam>
     */
    private function examsMatchingNormalizedName(string $examTitle): Collection
    {
        $needle = $this->normalizeTitleForMatch($examTitle);

        return Exam::query()->get()->filter(
            fn (Exam $e) => $this->normalizeTitleForMatch($e->name) === $needle
        )->values();
    }

    /**
     * @return Collection<int, Test>
     */
    private function testsMatchingNormalizedTitle(int $examId, string $testTitle): Collection
    {
        $needle = $this->normalizeTitleForMatch($testTitle);

        return Test::query()->where('exam_id', $examId)->get()->filter(
            fn (Test $t) => $this->normalizeTitleForMatch($t->title) === $needle
        )->values();
    }

    /**
     * Resolve an exam by display name (`exams.name`) and a test by `tests.title` within that exam.
     * Matching is **normalized** (dash/space variants) so an existing row is reused when the title is
     * the same for humans even if bytes differ from the CLI string.
     * If no row matches, creates a new `tests` record under the chosen section.
     *
     * @param  string|null  $preferredSectionNameForNewTest  When creating: section `name` on that exam (must exist). If null/empty, uses the exam's first section by `sort_order`, then `id`.
     * @return array{exam: Exam, test: Test}
     */
    public function resolveExistingExamAndTestByTitles(string $examTitle, string $testTitle, ?string $preferredSectionNameForNewTest = null): array
    {
        $examTitle = trim($examTitle);
        $testTitle = trim($testTitle);
        if ($examTitle === '' || $testTitle === '') {
            throw new InvalidArgumentException('--exam-title and --test-title must both be non-empty when targeting an existing test.');
        }

        $examMatches = $this->examsMatchingNormalizedName($examTitle);
        if ($examMatches->isEmpty()) {
            throw new InvalidArgumentException("No exam found with name \"{$examTitle}\" (matches exams.name, including dash/space-normalized comparison).");
        }
        if ($examMatches->count() > 1) {
            throw new InvalidArgumentException(
                "Multiple exams match \"{$examTitle}\" after normalizing spaces and dashes. Rename or disambiguate in the database."
            );
        }
        /** @var Exam $exam */
        $exam = $examMatches->first();

        $testMatches = $this->testsMatchingNormalizedTitle($exam->id, $testTitle);
        if ($testMatches->count() > 1) {
            $ids = $testMatches->pluck('id')->implode(', ');
            throw new InvalidArgumentException(
                "Multiple tests match \"{$testTitle}\" for this exam after normalization (ids: {$ids}). Fix duplicate titles in the database."
            );
        }
        if ($testMatches->count() === 1) {
            /** @var Test $test */
            $test = $testMatches->first();
            $test->loadMissing('section');
            if ($test->section === null) {
                throw new InvalidArgumentException("Test \"{$test->title}\" has no section.");
            }

            return ['exam' => $exam, 'test' => $test];
        }

        $preferred = trim((string) $preferredSectionNameForNewTest);
        if ($preferred !== '') {
            $section = Section::query()
                ->where('exam_id', $exam->id)
                ->where('name', $preferred)
                ->first();
            if ($section === null) {
                throw new InvalidArgumentException(
                    "No test titled \"{$testTitle}\" exists for exam \"{$examTitle}\", and that exam has no section named \"{$preferred}\". Add the section or use --section with a section that exists on this exam."
                );
            }
        } else {
            $section = $exam->sections()->orderBy('sort_order')->orderBy('id')->first();
            if ($section === null) {
                throw new InvalidArgumentException(
                    "No test titled \"{$testTitle}\" exists for exam \"{$examTitle}\", and the exam has no sections. Create at least one section, then retry."
                );
            }
        }

        /** @var Section $section */
        $test = Test::query()->create([
            'exam_id' => $exam->id,
            'section_id' => $section->id,
            'title' => $testTitle,
            'difficulty' => 'medium',
            'is_full_mock' => false,
            'practice_mode' => 'quick',
            'duration_minutes' => (int) $section->duration_minutes,
            'is_available' => true,
        ]);
        $test->loadMissing('section');

        return ['exam' => $exam, 'test' => $test];
    }

    /**
     * Rebuild import JSON using DB metadata for exam/section/test and questions taken from raw payload (by test title).
     *
     * @param  array<string, mixed>  $rawPayload
     * @return array<string, mixed>
     */
    public function mergePayloadOntoExistingTest(array $rawPayload, Exam $exam, Test $test): array
    {
        $questions = $this->extractQuestionsForTestTitle($rawPayload, $test->title);
        if ($questions === []) {
            throw new InvalidArgumentException(
                'No non-empty "questions" array found in JSON for test "'.$test->title.'".'
            );
        }

        $out = $this->buildCanonicalPayloadForExistingTest($exam, $test, $questions);
        $this->assertDistinctReadingPassagesPerTest($out);

        return $out;
    }

    /**
     * Fail fast if one test contains multiple Reading MCQs that share the same passage_text (normalized).
     *
     * @param  array<string, mixed>  $payload
     */
    public function assertDistinctReadingPassagesPerTest(array $payload): void
    {
        foreach ($payload['exams'] ?? [] as $exam) {
            if (! is_array($exam)) {
                continue;
            }
            foreach ($exam['sections'] ?? [] as $sec) {
                if (! is_array($sec)) {
                    continue;
                }
                foreach ($sec['tests'] ?? [] as $test) {
                    if (! is_array($test)) {
                        continue;
                    }
                    $testTitle = (string) ($test['title'] ?? '?');
                    /** @var array<string, int> $firstIndexByPassageKey 1-based question index */
                    $firstIndexByPassageKey = [];
                    foreach ($test['questions'] ?? [] as $qi => $q) {
                        if (! is_array($q)) {
                            continue;
                        }
                        if (($q['type'] ?? '') !== 'multiple_choice') {
                            continue;
                        }
                        $audio = isset($q['audio_script']) && is_string($q['audio_script']) ? trim($q['audio_script']) : '';
                        if ($audio !== '') {
                            continue;
                        }
                        $passage = isset($q['passage_text']) && is_string($q['passage_text']) ? trim($q['passage_text']) : '';
                        if ($passage === '') {
                            continue;
                        }
                        $key = $this->normalizedQuestionStemKey($passage);
                        if ($key === '') {
                            continue;
                        }
                        $pos = (int) $qi + 1;
                        if (isset($firstIndexByPassageKey[$key])) {
                            $first = $firstIndexByPassageKey[$key];
                            throw new InvalidArgumentException(
                                "Duplicate reading passage_text in test \"{$testTitle}\": questions #{$first} and #{$pos} use the same passage. Each Reading question in one test must have a different passage_text. Regenerate or fix the JSON."
                            );
                        }
                        $firstIndexByPassageKey[$key] = $pos;
                    }
                }
            }
        }
    }

    /**
     * @param  array{exam: Exam, test: Test}|null  $existingTarget
     */
    public function generatePayload(string $userInstructions, ?string $model = null, ?OutputInterface $output = null, ?int $questionsPerTest = null, ?array $onlySections = null, ?array $existingTarget = null, bool $withSpeakingImages = false, ?array $celpipSectionTasks = null, bool $omitOptionalPassageText = false): array
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $model ??= (string) config('openai.model');
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('openai.timeout', 180);
        $maxTokens = (int) config('openai.max_completion_tokens', 16384);

        $exam = null;
        $test = null;
        if ($existingTarget !== null) {
            $exam = $existingTarget['exam'];
            $test = $existingTarget['test'];
            $test->loadMissing('section');
            if ($test->section === null) {
                throw new InvalidArgumentException('Target test has no section.');
            }
        }

        if ($userInstructions !== '') {
            $user = $userInstructions;
        } elseif ($existingTarget !== null) {
            $minP = self::MIN_READING_PASSAGE_CHARS;
            $minA = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
            $targetA = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
            $maxA = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;
            $maxQ = self::MAX_READING_MCQ_QUESTION_TEXT_CHARS;
            $user = "Generate new questions for the existing BandReady test described in EXISTING TARGET below. Output valid JSON only. For Reading multiple_choice with no audio_script: passage_text holds the full reading (≥{$minP} chars); question_text is a short stem only (~≤{$maxQ} chars, no passage body). If you output more than one Reading question in this batch, **each passage_text must be different**—never reuse the same passage for multiple questions. For Listening multiple_choice: **write each full audio_script first**, then derive **question_text + A–D** only from that script’s facts (no mismatched topic). Each **audio_script** at least **{$minA}** characters (hard floor); **aim {$targetA}–{$maxA}** with substantial dialogue or monologue (many turns); never exceed {$maxA}; **passage_text = one or two ultra-short scenario-frame lines only** (~50–180 chars): place/situation type + speaker roles—**zero** facts, outcomes, or topic overlap with the stem/options (no hints); not the script; each audio_script must differ. **Coherence:** every Reading stem and all four options must be about *that* passage only; every Listening stem and all four options must be answerable from *that* audio_script only—**no vague “main topic” stems unless all options are tight paraphrases of content actually in the clip**. **Listening role fidelity:** `question_text` and **every option** must use vocabulary consistent with that `audio_script` (same speaker labels as before “:”, e.g. Store Clerk—not barista/café vocabulary for a hardware or plumbing-supply dialogue). **Idea-based items:** no **how many / how much** stems and no MCQ keyed answers that are **mostly numerals**—see system prompt. **MCQ answer keys:** Within each test, **vary** `correct_answer` across A, B, C, and D—do not make almost every question use the same letter; explanations must not name letters (substance only).";
        } else {
            $minP = self::MIN_READING_PASSAGE_CHARS;
            $minA = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
            $targetA = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
            $maxA = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;
            $maxQ = self::MAX_READING_MCQ_QUESTION_TEXT_CHARS;
            $user = "Generate a complete exam hierarchy with realistic practice content suitable for BandReady. Prefer one primary exam (e.g. IELTS-style Academic) with Listening, Reading, Writing, and Speaking **quick**-mode tests (timed single-skill sets) plus one short quick sampler test per exam. For reading multiple-choice (no audio_script): each passage_text is the full on-screen reading, distinct and at least {$minP} characters; each question_text is only a brief stem (~≤{$maxQ} chars), never the passage body. For listening multiple-choice: **complete each audio_script first**, then write the stem and options **only** from that dialogue (CELPIP/IELTS-style: one clip, one question, tight topic fit). Each audio_script distinct, at least **{$minA}** chars, **aim {$targetA}–{$maxA}** (full scene, multiple exchanges); max {$maxA}; **each passage_text: tiny hint-free scenario frame** (~50–180 chars, 1–2 sentences)—only where/who-in-role, **not** what is discussed or any detail testable by the MCQ. **Strict alignment:** Reading MCQ stems must target main ideas, details, inference, or vocabulary **in that passage**; Listening MCQ stems must target **specific** ideas or implications **in that clip**—prefer **why, attitude, purpose, concern, recommendation, relationship between claims, what problem is raised, what happens next in narrative terms** over generic “what are they discussing?” **Do not** use **how many / how much** stems or items whose answer is mainly a **number** (see system prompt: idea-based answers). Wrong options stay in-scenario but contradict the source; **never** unrelated scenarios. **Listening:** stems and options must match script roles and setting (speaker labels before “:”—never wrong-venue jobs like barista for a non-café clip). Avoid irrelevant stems that ignore the passage or audio. **MCQ answer keys:** Across MCQs in each test, **spread** `correct_answer` over A–D (no long runs of the same letter); explanations: substance only, never \"Option B\" / letter names.";
        }

        if ($userInstructions === '' && $existingTarget === null) {
            $user .= "\n\n**Difficulty:** Each test must set `difficulty` to **`medium` or `hard` only** (never `easy`). Across tests in this JSON, use **mostly `hard`** (~two-thirds of tests `hard`, remainder `medium`) unless the user instructions say otherwise. Author **every** question to match that test’s band—see system prompt.";
        }

        if ($userInstructions === '') {
            $listeningOnlyScope = is_array($onlySections) && count($onlySections) === 1 && in_array('Listening', $onlySections, true);
            $existingListeningTest = $existingTarget !== null && $exam !== null && $test !== null && $test->section->name === 'Listening';
            if (! $listeningOnlyScope && ! $existingListeningTest) {
                $user .= "\n\n**IELTS AI Speaking:** When any exam in your JSON has `code` starting with `ielts_`, each **Speaking** test should include **one** `speaking_prompt` with `options_json.ielts_speaking.mode` = `ai_conversation` (full Parts 1–3 in-app), `audio_script` null or empty, learner briefing in `question_text`, short `passage_text`, rubric in `correct_answer`—see system prompt. Omit this shape only if instructions explicitly require picture/description tasks or another format.";
            }
        }

        if ($existingTarget !== null && $exam !== null && $test !== null) {
            $section = $test->section;
            $shell = $this->buildCanonicalPayloadForExistingTest($exam, $test, []);
            $user .= "\n\nEXISTING TARGET (mandatory): Return JSON with exactly this exam → section → test shape. Use the same \"name\", \"code\", \"type\", section \"name\"/\"duration_minutes\"/\"sort_order\", and test \"title\"/\"difficulty\"/\"is_full_mock\"/\"practice_mode\"/\"duration_minutes\"/\"is_available\" as shown. Only the \"questions\" array must be filled (non-empty). Questions must match the section skill: {$section->name}.\n";
            $user .= json_encode($shell, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $user .= "\n\nDo not add other exams, sections, or tests. Do not rename the test.";
            $user .= "\n\n".$this->difficultyAuthoringInstructionForTest((string) $test->difficulty);
            if ($section->name === 'Listening') {
                $minA = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $targetA = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $maxA = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;
                $user .= "\n\n**LISTENING TEST (CRITICAL):** This test is **Listening** only. Every `multiple_choice` **audio_script** MUST be at least **{$minA}** UTF-8 characters—the import **rejects** anything shorter. Aim **{$targetA}–{$maxA}** with many back-and-forth lines (or a long monologue). Before you output JSON, count characters for each `audio_script`.\n";
                $user .= "**Topic lock (mandatory):** For **each** question row, **write `audio_script` first**, then set `question_text` and options A–D so they test **that clip’s** ideas (problem, stance, conflict, reasons, implied outcome, recommendation, relationship between speakers’ positions). The stem must **not** introduce a theme that is absent from the dialogue (e.g. do not ask about parking if the speakers only discuss a refund). Prefer **specific idea-level** stems over vague “main topic” questions unless every option is clearly tied to lines in the script. **Do not** use **how many / how much** stems or answers dominated by **bare numbers**—see system prompt.\n";
                $user .= "**Stem vs script:** each `question_text` and **all four options** must use **only** people, places, and subject-matter words that fit **that** `audio_script` (use the dialogue line labels before “:”, e.g. Store Clerk / Customer—not barista or café terms unless the script is actually in a coffee shop). **explanation** must cite the supporting idea in the clip (paraphrase), proving the key is on-topic.\n";
            }
            if ($section->name === 'Speaking' && str_starts_with(strtolower((string) $exam->code), 'ielts_')) {
                $user .= "\n\n**SPEAKING (IELTS — mandatory shape):** `questions` must contain **one** `speaking_prompt` with `options_json`: {\"ielts_speaking\":{\"mode\":\"ai_conversation\"}}. `audio_script` null or empty. Use `question_text` (learner briefing), short `passage_text`, rubric in `correct_answer`. Do **not** use CELPIP picture `options_json.speaking` / `image_generation_prompt` on this row.";
            }
        }

        if ($onlySections !== null && $onlySections !== [] && $existingTarget === null) {
            $list = implode(', ', $onlySections);
            $user .= "\n\nSCOPE (mandatory): Generate ONLY these exam section(s): {$list}. Each exam's \"sections\" array must list ONLY those section names (exact spelling as given). Do not include Listening, Reading, Writing, or Speaking unless it appears in this list: {$list}. Omit every other section type entirely. Each listed section must still have at least one test with appropriate questions for that skill.";
            $output?->writeln('<comment>OpenAI section scope:</comment> '.$list);
            if (count($onlySections) === 1 && in_array('Listening', $onlySections, true)) {
                $minA = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $targetA = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $maxA = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;
                $user .= "\n\n**LISTENING-ONLY SCOPE (CRITICAL):** Every Listening `multiple_choice` **audio_script** MUST be ≥ **{$minA}** UTF-8 characters (hard reject if shorter). Aim **{$targetA}–{$maxA}**; verify length on each script before returning JSON. **Author each clip fully, then write the MCQ from that clip**—stem + options must test **this** dialogue’s content, not a generic conversation. **Every `question_text` and all options** must align with the same clip’s **roles, setting, and subject matter** (no mismatched job titles, venues, or off-topic themes). Prefer stems that target **one verifiable idea or implication** from the script (not **how many / how much** or numeric-first answers—see system prompt).";
            }
            if (count($onlySections) === 1 && in_array('Speaking', $onlySections, true)) {
                $user .= "\n\n**SPEAKING-ONLY:** For exams whose `code` starts with `ielts_`, each Speaking test: **one** `speaking_prompt` with `ielts_speaking.mode: ai_conversation` (system prompt). For other exam codes, use the appropriate `speaking_prompt` shapes from the system prompt (e.g. CELPIP picture tasks when relevant).";
            }
        }

        if ($questionsPerTest !== null && $questionsPerTest >= 1) {
            $user .= "\n\nRequired: every test object must include exactly {$questionsPerTest} entries in its \"questions\" array. If a section would normally have only one essay or a generic multi-prompt speaking batch, still output {$questionsPerTest} question objects (e.g. distinct prompts or sub-parts) **unless** the **IELTS AI Speaking** exception applies (one `speaking_prompt` per IELTS Speaking test—see next note).";
            if ($questionsPerTest >= 2) {
                $minListen = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $targetListen = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $maxListen = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;
                $user .= "\n\nMULTI-QUESTION SAME TEST (mandatory): You are placing {$questionsPerTest} questions in one test. For **Reading** multiple_choice (no audio_script): **each question must have its own unique passage_text**—{$questionsPerTest} different readings (e.g. mix email, ad, editorial, timetable, workplace memo, FAQ, legal notice, research summary, travel brochure, municipal bulletin). **Identical or near-identical passage_text across those questions is invalid.** Each stem+options must be **tightly tied** to its passage. For **Listening** multiple_choice, each audio_script must be completely different (e.g. pharmacy, bank, airport gate, voicemail, hotel desk, team meeting, radio news), at least **{$minListen}** characters each, **aim {$targetListen}–{$maxListen}**; **each passage_text its own minimal frame** (~50–180 chars, hint-free, not reused); **for each item, write the script first, then the stem and A–D from that script only**—no cross-clip topic bleed; each stem+options must reflect **only** that clip’s content.";
            }
            $user .= "\n\n**IELTS AI Speaking (exception to per-test count):** For any **Speaking** test under an exam whose `code` starts with `ielts_`, if you use `options_json.ielts_speaking.mode: ai_conversation`, output **exactly one** `speaking_prompt` for that test (full Parts 1–3 interview in-app)—do **not** duplicate multiple `ai_conversation` rows to satisfy a higher question count.";
            $output?->writeln('<comment>Questions per test (prompt constraint):</comment> '.$questionsPerTest);
        }

        $celpipApplicable = CelpipOfficialTaskCatalog::filterApplicable($celpipSectionTasks, $onlySections, $existingTarget);
        if ($celpipApplicable !== []) {
            $user .= "\n\n".CelpipOfficialTaskCatalog::formatPromptBlock($celpipApplicable, $questionsPerTest);
            $parts = [];
            foreach ($celpipApplicable as $sec => $ids) {
                $parts[] = $sec.' ['.implode(',', $ids).']';
            }
            $output?->writeln('<comment>CELPIP-style task focus:</comment> '.implode('; ', $parts));
            $user .= <<<'CELPIP_META'

**CELPIP TASK METADATA (mandatory for this run):** For **every question** whose section appears in the CELPIP task focus above, include both:
- `"celpip_task_number"`: integer — must be **one of** the task numbers listed for that section in this request (not any other task index).
- `"celpip_task_label"`: string — the **exact** official English name for that task (same spelling as in the list above, e.g. Listening task 1 → `"Problem solving"`).

Each question must map to **exactly one** selected task. Distribute questions across the selected task types as already instructed. Sections **not** listed in the CELPIP task focus may omit these keys or use null.
CELPIP_META;
        }

        if ($withSpeakingImages && $this->sectionScopeIncludesSpeaking($onlySections, $existingTarget)) {
            $user .= $this->buildSpeakingPictureTasksUserAppend($celpipApplicable['Speaking'] ?? null);
            $output?->writeln('<comment>Speaking picture mode:</comment> ON (model must emit image_generation_prompt + explanation grading reference).');
        }

        if (trim($userInstructions) !== '') {
            $user .= "\n\n**BandReady defaults (apply unless your instructions explicitly override):** Each test's `difficulty` must be **medium** or **hard** only (use **hard** for roughly two-thirds of tests). Objective questions must be **idea-based**: no **how many** / **how much** stems and no keyed answers that are **primarily numerals**; see the system prompt.";
        }

        if ($omitOptionalPassageText) {
            $user .= <<<'OMIT_PASS'


**passage_text (this run — omit when optional):** For every question where `passage_text` is **optional** in BandReady—especially **`speaking_prompt`** and **`essay`**—set `passage_text` to JSON **null** (not `""`). Put the full learner briefing and task wording in **`question_text`** only; **do not** duplicate it as a second “passage” block and **do not** add filler context in `passage_text` for those types. **Exceptions (unchanged — follow the system prompt):** Listening `multiple_choice` rows **must** keep the short hint-free scenario `passage_text` (~50–180 characters) where required; Reading `multiple_choice` without audio **must** keep the full reading in `passage_text`; any other type that **requires** non-null `passage_text` for a valid import stays as required.
OMIT_PASS;
            $output?->writeln('<comment>Omit optional passage_text:</comment> ON (e.g. speaking_prompt / essay → passage_text null unless mandatory).');
        }

        $output?->writeln('<comment>Model:</comment> '.$model);
        $output?->writeln('<comment>Endpoint:</comment> '.$url);
        $output?->writeln('<comment>Timeout:</comment> '.$timeout.'s · <comment>max_completion_tokens:</comment> '.$maxTokens);

        $systemPrompt = $this->buildSystemPrompt();
        /** @var list<array{role: string, content: string}> $messages */
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $user],
        ];

        $maxAttempts = 1 + self::LISTENING_AUDIO_SHORT_SCRIPT_MAX_RETRIES;
        $generateStartedAt = microtime(true);
        $httpResponse = null;
        $caught = null;
        /** @var array<string, mixed> $requestPayload */
        $requestPayload = [];

        try {
            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                if ($attempt > 1) {
                    $output?->writeln('<comment>Listening audio_script too short — retry '.$attempt.'/'.$maxAttempts.'…</>');
                } else {
                    $output?->writeln('<info>Sending request to OpenAI…</info>');
                }

                $requestPayload = [
                    'model' => $model,
                    'messages' => $messages,
                    'response_format' => ['type' => 'json_object'],
                    'max_completion_tokens' => $maxTokens,
                ];

                $httpResponse = Http::withToken($key)
                    ->timeout($timeout)
                    ->acceptJson()
                    ->post($url, $requestPayload);

                if (! $httpResponse->successful()) {
                    throw new InvalidArgumentException(
                        'OpenAI API error: HTTP '.$httpResponse->status().' — '.$httpResponse->body()
                    );
                }

                $usage = $httpResponse->json('usage');
                if ($output && is_array($usage)) {
                    $pt = data_get($usage, 'prompt_tokens');
                    $ct = data_get($usage, 'completion_tokens');
                    $tt = data_get($usage, 'total_tokens');
                    $output->writeln('<comment>Token usage:</comment> prompt='.$pt.' completion='.$ct.' total='.$tt);
                }

                $content = data_get($httpResponse->json(), 'choices.0.message.content');
                if (! is_string($content) || $content === '') {
                    throw new InvalidArgumentException('OpenAI returned an empty response.');
                }

                $output?->writeln('<info>Response received. Parsing JSON…</info>');

                $decoded = $this->decodePayloadJson($content);

                if ($existingTarget !== null && $exam !== null && $test !== null) {
                    $questions = $this->extractQuestionsForTestTitle($decoded, $test->title);
                    if ($questions === []) {
                        throw new InvalidArgumentException(
                            'OpenAI returned no non-empty "questions" for test "'.$test->title.'". Check the model output or your prompt.'
                        );
                    }
                    $n = count($questions);
                    $output?->writeln("<info>Rebuilt payload: DB exam/test shell + {$n} question(s) from the model.</info>");

                    $resultPayload = $this->buildCanonicalPayloadForExistingTest($exam, $test, $questions);
                } else {
                    $resultPayload = $decoded;
                }

                $this->assertDistinctReadingPassagesPerTest($resultPayload);

                $shortViolations = $this->collectListeningAudioTooShortViolations($resultPayload);
                if ($shortViolations !== [] && $attempt < $maxAttempts) {
                    $messages[] = ['role' => 'assistant', 'content' => $content];
                    $messages[] = ['role' => 'user', 'content' => $this->buildListeningAudioLengthRetryUserMessage($shortViolations)];

                    continue;
                }
                if ($shortViolations !== []) {
                    throw new InvalidArgumentException(
                        "OpenAI listening output still fails length checks after {$maxAttempts} attempt(s):\n- ".implode("\n- ", $shortViolations)
                    );
                }

                return $resultPayload;
            }
        } catch (\Throwable $e) {
            $caught = $e;
            throw $e;
        } finally {
            $contextRef = $test !== null ? 'test:'.$test->id : null;
            app(OpenAiActivityLogger::class)->recordChatCompletion(
                'questionnaire_generate',
                null,
                $contextRef,
                $url,
                $requestPayload,
                $httpResponse,
                (microtime(true) - $generateStartedAt) * 1000,
                $caught,
            );
        }

        throw new InvalidArgumentException('OpenAI questionnaire generation failed unexpectedly.');
    }

    public function decodePayloadJson(string $raw): array
    {
        $t = trim($raw);
        if (preg_match('/^```(?:json)?\s*([\s\S]*?)```$/m', $t, $m)) {
            $t = trim($m[1]);
        }

        $decoded = json_decode($t, true);
        if (! is_array($decoded)) {
            throw new InvalidArgumentException('Response is not valid JSON.');
        }

        return $decoded;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    /**
     * @param  array<string, list<int>>|null  $celpipSectionTasksNormalized  When set (e.g. OpenAI run with celpip_section_tasks), questions in those sections must include valid task metadata within the allowed task numbers.
     */
    public function validatePayload(array $payload, ?array $celpipSectionTasksNormalized = null): void
    {
        if (! isset($payload['exams']) || ! is_array($payload['exams']) || $payload['exams'] === []) {
            throw new InvalidArgumentException('JSON must contain a non-empty "exams" array.');
        }

        foreach ($payload['exams'] as $ei => $exam) {
            if (! is_array($exam)) {
                throw new InvalidArgumentException("exams[$ei] must be an object.");
            }
            foreach (['name', 'code', 'type'] as $k) {
                if (empty($exam[$k]) || ! is_string($exam[$k])) {
                    throw new InvalidArgumentException("exams[$ei].$k must be a non-empty string.");
                }
            }
            if (! isset($exam['sections']) || ! is_array($exam['sections']) || $exam['sections'] === []) {
                throw new InvalidArgumentException("exams[$ei].sections must be a non-empty array.");
            }
            foreach ($exam['sections'] as $si => $sec) {
                if (! is_array($sec)) {
                    throw new InvalidArgumentException("exams[$ei].sections[$si] must be an object.");
                }
                if (empty($sec['name']) || ! is_string($sec['name'])) {
                    throw new InvalidArgumentException("exams[$ei].sections[$si].name required.");
                }
                if (! isset($sec['duration_minutes']) || ! is_numeric($sec['duration_minutes'])) {
                    throw new InvalidArgumentException("exams[$ei].sections[$si].duration_minutes required.");
                }
                if (! isset($sec['sort_order']) || ! is_numeric($sec['sort_order'])) {
                    throw new InvalidArgumentException("exams[$ei].sections[$si].sort_order required.");
                }
                if (! isset($sec['tests']) || ! is_array($sec['tests']) || $sec['tests'] === []) {
                    throw new InvalidArgumentException("exams[$ei].sections[$si].tests must be non-empty.");
                }
                foreach ($sec['tests'] as $ti => $test) {
                    $this->validateTestNode($exam, $ei, $sec, $si, $test, $ti);
                }
            }
        }

        $this->assertDistinctReadingPassagesPerTest($payload);
        $this->validatePayloadQuestionConstraints($payload, $celpipSectionTasksNormalized);
    }

    /**
     * Per-question rules (e.g. Listening audio_script length) so dry-run and file import fail before DB writes.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, list<int>>|null  $celpipSectionTasksNormalized
     */
    private function validatePayloadQuestionConstraints(array $payload, ?array $celpipSectionTasksNormalized = null): void
    {
        foreach ($payload['exams'] ?? [] as $exam) {
            if (! is_array($exam)) {
                continue;
            }
            foreach ($exam['sections'] ?? [] as $sec) {
                if (! is_array($sec)) {
                    continue;
                }
                foreach ($sec['tests'] ?? [] as $test) {
                    if (! is_array($test)) {
                        continue;
                    }
                    $title = (string) ($test['title'] ?? '');
                    if ($title === '') {
                        continue;
                    }
                    $questions = is_array($test['questions'] ?? null) ? $test['questions'] : [];
                    $sectionName = (string) ($sec['name'] ?? '');
                    $allowedCelpip = null;
                    if ($celpipSectionTasksNormalized !== null && $sectionName !== '' && isset($celpipSectionTasksNormalized[$sectionName])) {
                        $allowedCelpip = $celpipSectionTasksNormalized[$sectionName];
                    }
                    foreach ($questions as $qi => $qRow) {
                        if (! is_array($qRow)) {
                            throw new InvalidArgumentException("Test \"{$title}\" question #".((int) $qi + 1).': must be an object.');
                        }
                        try {
                            $qRow = $this->prepareQuestionRowForImport($qRow, $sectionName);
                            $qRow = $this->inferMissingCelpipTaskMetadataFromSingleAllowed($qRow, $sectionName, $allowedCelpip);
                        } catch (InvalidArgumentException $e) {
                            throw new InvalidArgumentException("Test \"{$title}\" question #".((int) $qi + 1).': '.$e->getMessage());
                        }
                        $this->assertValidQuestion($qRow, $title, (int) $qi, $sectionName, $allowedCelpip);
                    }
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<string>
     */
    private function collectListeningAudioTooShortViolations(array $payload): array
    {
        $minA = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
        $lines = [];
        foreach ($payload['exams'] ?? [] as $exam) {
            if (! is_array($exam)) {
                continue;
            }
            foreach ($exam['sections'] ?? [] as $sec) {
                if (! is_array($sec)) {
                    continue;
                }
                foreach ($sec['tests'] ?? [] as $t) {
                    if (! is_array($t)) {
                        continue;
                    }
                    $testTitle = (string) ($t['title'] ?? '?');
                    foreach ($t['questions'] ?? [] as $qi => $q) {
                        if (! is_array($q)) {
                            continue;
                        }
                        if (($q['type'] ?? '') !== 'multiple_choice') {
                            continue;
                        }
                        $script = isset($q['audio_script']) && is_string($q['audio_script']) ? trim($q['audio_script']) : '';
                        if ($script === '') {
                            continue;
                        }
                        $n = function_exists('mb_strlen') ? mb_strlen($script, 'UTF-8') : strlen($script);
                        if ($n < $minA) {
                            $lines[] = "Test \"{$testTitle}\" MCQ #".((int) $qi + 1).": audio_script is {$n} characters (minimum {$minA}).";
                        }
                    }
                }
            }
        }

        return $lines;
    }

    /**
     * @param  list<string>  $violationLines
     */
    private function buildListeningAudioLengthRetryUserMessage(array $violationLines): string
    {
        $minA = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
        $targetA = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
        $maxA = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;
        $bullets = implode("\n", array_map(static fn (string $l) => '- '.$l, $violationLines));

        return <<<MSG
Your previous JSON is invalid for import: one or more Listening multiple_choice `audio_script` values are shorter than the required minimum.

{$bullets}

**Fix (mandatory):** Output the **complete** JSON document again with the **same** top-level shape (`exams` → `sections` → `tests` → `questions`). Expand every under-length `audio_script` so each is **at least {$minA}** UTF-8 characters (aim **{$targetA}–{$maxA}** with natural dialogue or monologue—many turns; no padding or repeated filler). Keep `passage_text` as the short scenario frame only (hint-free). Update `question_text`, `options_json`, `correct_answer`, and `explanation` if needed so they still match the expanded audio. **Each Listening `question_text` must use roles and setting consistent with that clip** (match speaker labels before “:”—never e.g. “barista” for a hardware-store dialogue). Valid JSON only, no markdown.
MSG;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function importPayload(array $payload, ?OutputInterface $output = null, bool $showQuestionPreviews = true, bool $withSpeakingImages = false, ?array $celpipSectionTasksNormalized = null): void
    {
        $this->validatePayload($payload, $celpipSectionTasksNormalized);

        $examCount = count($payload['exams']);
        $output?->writeln('<info>Starting database import…</info> (<comment>'.$examCount.'</comment> exam(s))');
        if ($withSpeakingImages) {
            $output?->writeln('<comment>Post-import:</comment> generating scene images for speaking_prompt rows with options_json.speaking.image_generation_prompt…');
        }

        DB::transaction(function () use ($payload, $output, $showQuestionPreviews, $withSpeakingImages, $celpipSectionTasksNormalized) {
            foreach ($payload['exams'] as $examRow) {
                $exam = Exam::query()->updateOrCreate(
                    ['code' => $examRow['code']],
                    [
                        'name' => $examRow['name'],
                        'type' => $examRow['type'],
                    ]
                );

                $examNote = $exam->wasRecentlyCreated ? 'created' : 'merged';
                $output?->writeln(' <info>Exam</info> '.$examRow['name'].' <comment>('.$examRow['code'].')</comment> → id '.$exam->id." <fg=gray>[{$examNote}]</>");

                foreach ($examRow['sections'] as $secRow) {
                    $section = Section::query()->updateOrCreate(
                        [
                            'exam_id' => $exam->id,
                            'name' => $secRow['name'],
                        ],
                        [
                            'duration_minutes' => (int) $secRow['duration_minutes'],
                            'sort_order' => (int) $secRow['sort_order'],
                        ]
                    );

                    $secNote = $section->wasRecentlyCreated ? 'created' : 'updated';
                    $output?->writeln('  <comment>Section</comment> '.$secRow['name'].' <fg=gray>(#'.$section->id.', '.$section->duration_minutes." min · {$secNote})</>");

                    foreach ($secRow['tests'] as $testRow) {
                        $duration = $testRow['duration_minutes'] ?? null;
                        if ($duration === null || $duration === '') {
                            $duration = $section->duration_minutes;
                        }

                        $title = $testRow['title'];
                        $testMatches = $this->testsMatchingNormalizedTitle($exam->id, (string) $title);
                        if ($testMatches->count() > 1) {
                            $ids = $testMatches->pluck('id')->implode(', ');
                            throw new InvalidArgumentException(
                                "Multiple tests match title \"{$title}\" for exam \"{$examRow['name']}\" after normalization (ids: {$ids})."
                            );
                        }
                        $test = $testMatches->first();

                        $insertedTest = false;
                        if ($test === null) {
                            $test = Test::query()->create([
                                'exam_id' => $exam->id,
                                'section_id' => $section->id,
                                'title' => $title,
                                'difficulty' => $testRow['difficulty'] ?? 'medium',
                                'is_full_mock' => (bool) ($testRow['is_full_mock'] ?? false),
                                'practice_mode' => $this->normalizePracticeModeForImport($testRow['practice_mode'] ?? null),
                                'duration_minutes' => (int) $duration,
                                'is_available' => (bool) ($testRow['is_available'] ?? true),
                            ]);
                            $insertedTest = true;
                        } else {
                            if ($test->section_id !== $section->id && $output) {
                                $output->writeln(
                                    '    <fg=yellow>note: test "'.$title.'" already belongs to section #'.$test->section_id.'; keeping that link (payload had section '.$section->name.')</>'
                                );
                            }
                        }

                        $questions = is_array($testRow['questions'] ?? null) ? $testRow['questions'] : [];
                        $qCount = count($questions);
                        $mode = $this->normalizePracticeModeForImport($testRow['practice_mode'] ?? null);
                        $existingQ = (int) Question::query()->where('test_id', $test->id)->count();
                        $testNote = $insertedTest
                            ? 'new row'
                            : 'reused (same exam_id + title)';
                        $testNote .= ' · '.$existingQ.' Q before · +'.$qCount.' from payload';
                        $output?->writeln('    <comment>Test</comment> '.$testRow['title'].' <fg=gray>[#'.$test->id.' · '.$mode.' · '.$testNote.']</>');

                        $maxOrder = (int) (Question::query()->where('test_id', $test->id)->max('order') ?? 0);
                        $orderCursor = $maxOrder;

                        /** @var array<string, int> $seenQuestionStems norm => first payload order in batch */
                        $seenQuestionStems = [];
                        /** @var array<string, int> $seenPassageTexts normalized passage => first payload order in batch */
                        $seenPassageTexts = [];
                        /** @var array<string, int> $seenAudioScripts normalized script => first payload order in batch */
                        $seenAudioScripts = [];

                        $allowedCelpip = null;
                        if ($celpipSectionTasksNormalized !== null && isset($celpipSectionTasksNormalized[$secRow['name']])) {
                            $allowedCelpip = $celpipSectionTasksNormalized[$secRow['name']];
                        }

                        foreach ($questions as $qi => $qRow) {
                            if (! is_array($qRow)) {
                                throw new InvalidArgumentException('Each question must be an object.');
                            }
                            try {
                                $qRow = $this->prepareQuestionRowForImport($qRow, $secRow['name']);
                                $qRow = $this->inferMissingCelpipTaskMetadataFromSingleAllowed($qRow, $secRow['name'], $allowedCelpip);
                            } catch (InvalidArgumentException $e) {
                                throw new InvalidArgumentException('Test "'.$test->title.'" question #'.($qi + 1).': '.$e->getMessage());
                            }
                            $this->assertValidQuestion($qRow, $test->title, $qi, $secRow['name'], $allowedCelpip);
                            $payloadOrder = (int) ($qRow['order'] ?? ($qi + 1));
                            $orderCursor++;
                            $dbOrder = $orderCursor;

                            if ($output && $showQuestionPreviews) {
                                $type = (string) $qRow['type'];
                                $output->writeln("      <fg=cyan>Q{$payloadOrder}</> [{$type}] <fg=gray>→ order {$dbOrder}</> ".$this->previewOneLine($qRow['question_text'], 100));
                                $passage = isset($qRow['passage_text']) && is_string($qRow['passage_text']) ? trim($qRow['passage_text']) : '';
                                if ($passage !== '') {
                                    $output->writeln('        <comment>passage</comment> '.$this->previewOneLine($passage, 220));
                                }
                                $script = isset($qRow['audio_script']) && is_string($qRow['audio_script']) ? trim($qRow['audio_script']) : '';
                                if ($script !== '') {
                                    $output->writeln('        <comment>audio_script</comment> '.$this->previewOneLine($script, 220));
                                }
                            }

                            $stemKey = $this->normalizedQuestionStemKey($qRow['question_text']);
                            if ($stemKey !== '') {
                                if (isset($seenQuestionStems[$stemKey])) {
                                    $dup = $seenQuestionStems[$stemKey];
                                    $output?->writeln("        <fg=yellow>warning: duplicate question_text (same stem as payload Q{$dup})</>");
                                } else {
                                    $seenQuestionStems[$stemKey] = $payloadOrder;
                                }
                            }

                            $passageRaw = isset($qRow['passage_text']) && is_string($qRow['passage_text']) ? trim($qRow['passage_text']) : '';
                            if ($passageRaw !== '' && ($qRow['type'] ?? '') === 'multiple_choice') {
                                $passageKey = $this->normalizedQuestionStemKey($passageRaw);
                                if ($passageKey !== '') {
                                    if (isset($seenPassageTexts[$passageKey])) {
                                        $dup = $seenPassageTexts[$passageKey];
                                        $output?->writeln("        <fg=yellow>warning: duplicate passage_text in this batch (same as payload Q{$dup}) — model reused a reading passage</>");
                                    } else {
                                        $seenPassageTexts[$passageKey] = $payloadOrder;
                                    }
                                }
                            }

                            $scriptRaw = isset($qRow['audio_script']) && is_string($qRow['audio_script']) ? trim($qRow['audio_script']) : '';
                            if ($scriptRaw !== '' && ($qRow['type'] ?? '') === 'multiple_choice') {
                                $scriptKey = $this->normalizedQuestionStemKey($scriptRaw);
                                if ($scriptKey !== '') {
                                    if (isset($seenAudioScripts[$scriptKey])) {
                                        $dup = $seenAudioScripts[$scriptKey];
                                        $output?->writeln("        <fg=yellow>warning: duplicate audio_script in this batch (same as payload Q{$dup}) — model reused dialogue</>");
                                    } else {
                                        $seenAudioScripts[$scriptKey] = $payloadOrder;
                                    }
                                }
                            }

                            $correct = $this->normalizeCorrectAnswer($qRow['correct_answer']);
                            if ($qRow['type'] === 'multiple_choice') {
                                $correct = strtoupper(trim($correct));
                            }
                            $optsForRow = $this->normalizeOptionsJson($qRow['options_json'] ?? null);
                            if ($qRow['type'] === 'multiple_choice' && is_array($optsForRow)) {
                                $mcqShuffled = $this->shuffleMcqOptionsIfQuad($optsForRow, $correct);
                                $optsForRow = $mcqShuffled['options'];
                                $correct = $mcqShuffled['correct_answer'];
                            }

                            $question = Question::query()->create([
                                'test_id' => $test->id,
                                'type' => $qRow['type'],
                                'question_text' => $qRow['question_text'],
                                'passage_text' => $this->normalizeMultilinePassage(
                                    isset($qRow['passage_text']) && is_string($qRow['passage_text']) ? $qRow['passage_text'] : null
                                ),
                                'audio_url' => isset($qRow['audio_url']) && is_string($qRow['audio_url']) ? $qRow['audio_url'] : null,
                                'audio_script' => isset($qRow['audio_script']) && is_string($qRow['audio_script']) ? $qRow['audio_script'] : null,
                                'image_url' => null,
                                'options_json' => $optsForRow,
                                'correct_answer' => $correct,
                                'explanation' => isset($qRow['explanation']) && is_string($qRow['explanation']) ? $qRow['explanation'] : null,
                                'order' => $dbOrder,
                                'celpip_task_number' => isset($qRow['celpip_task_number']) && $qRow['celpip_task_number'] !== null
                                    ? (int) $qRow['celpip_task_number']
                                    : null,
                                'celpip_task_label' => isset($qRow['celpip_task_label']) && is_string($qRow['celpip_task_label']) && trim($qRow['celpip_task_label']) !== ''
                                    ? trim($qRow['celpip_task_label'])
                                    : null,
                            ]);

                            if ($withSpeakingImages && ($qRow['type'] ?? '') === 'speaking_prompt') {
                                $imgPrompt = is_array($optsForRow) ? data_get($optsForRow, 'speaking.image_generation_prompt') : null;
                                $imgPrompt = is_string($imgPrompt) ? trim($imgPrompt) : '';
                                if ($imgPrompt === '') {
                                    $output?->writeln("        <fg=yellow>skip image:</> speaking_prompt Q{$payloadOrder} has no options_json.speaking.image_generation_prompt</>");
                                } else {
                                    try {
                                        $img = app(OpenAiImageGenerationService::class);
                                        $result = $img->generateAndStore($imgPrompt);
                                        $hints = $img->describeSceneForGrader($imgPrompt);
                                        $speaking = is_array($optsForRow['speaking'] ?? null) ? $optsForRow['speaking'] : [];
                                        if ($hints !== '') {
                                            $speaking['image_context'] = $hints;
                                        }
                                        $speaking['image_generated_at'] = now()->toIso8601String();
                                        $optsForRow['speaking'] = $speaking;
                                        $question->update([
                                            'image_url' => $result['public_url'],
                                            'options_json' => $optsForRow,
                                        ]);
                                        $output?->writeln("        <comment>image</comment> generated for Q{$payloadOrder}");
                                    } catch (\Throwable $e) {
                                        $output?->writeln('        <fg=red>image error Q'.$payloadOrder.':</> '.$e->getMessage());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        $output?->writeln('<info>Database import finished.</info>');
    }

    private function normalizePracticeModeForImport(?string $value): string
    {
        $v = $value === null || $value === '' ? 'quick' : strtolower(trim($value));
        if ($v === 'section') {
            return 'quick';
        }

        return $v;
    }

    /**
     * @param  array<string, mixed>  $exam
     * @param  array<string, mixed>  $sec
     * @param  array<string, mixed>|mixed  $test
     */
    private function validateTestNode(array $exam, int $ei, array $sec, int $si, mixed $test, int $ti): void
    {
        if (! is_array($test)) {
            throw new InvalidArgumentException("exams[$ei].sections[$si].tests[$ti] must be an object.");
        }
        if (empty($test['title']) || ! is_string($test['title'])) {
            throw new InvalidArgumentException("exams[$ei].sections[$si].tests[$ti].title required.");
        }
        $mode = $this->normalizePracticeModeForImport($test['practice_mode'] ?? null);
        if (! in_array($mode, ['full', 'quick'], true)) {
            throw new InvalidArgumentException("Invalid practice_mode for test \"{$test['title']}\".");
        }
        if (! isset($test['questions']) || ! is_array($test['questions']) || $test['questions'] === []) {
            throw new InvalidArgumentException("Test \"{$test['title']}\" must have a non-empty questions array.");
        }
    }

    /**
     * Coerces missing/blank `type`, alternate keys, and common LLM aliases using section context.
     *
     * @param  array<string, mixed>  $qRow
     * @return array<string, mixed>
     */
    private function normalizeQuestionRowForImport(array $qRow, string $sectionName): array
    {
        $qRow = $this->coerceMcqOptionsJsonOnQuestionRow($qRow);

        $rawType = $qRow['type'] ?? null;
        if (($rawType === null || (is_string($rawType) && trim($rawType) === '')) && isset($qRow['question_type']) && is_string($qRow['question_type'])) {
            $qRow['type'] = trim($qRow['question_type']);
            unset($qRow['question_type']);
        }
        $rawType = $qRow['type'] ?? null;
        if (($rawType === null || (is_string($rawType) && trim($rawType) === '')) && isset($qRow['questionType']) && is_string($qRow['questionType'])) {
            $qRow['type'] = trim($qRow['questionType']);
            unset($qRow['questionType']);
        }

        $rawType = $qRow['type'] ?? null;
        if (is_string($rawType)) {
            $type = trim($rawType);
        } elseif (is_int($rawType) || is_float($rawType)) {
            $type = trim((string) $rawType);
        } else {
            $type = '';
        }

        if ($type !== '' && in_array($type, self::QUESTION_TYPES, true)) {
            $qRow['type'] = $type;

            return $qRow;
        }

        $slug = strtolower(str_replace([' ', '-'], '_', $type));
        /** @var array<string, string> $aliases */
        $aliases = [
            'speaking' => 'speaking_prompt',
            'speaking_prompt' => 'speaking_prompt',
            'ielts_speaking' => 'speaking_prompt',
            'oral' => 'speaking_prompt',
            'multiple_choice' => 'multiple_choice',
            'mcq' => 'multiple_choice',
            'multiplechoice' => 'multiple_choice',
            'true_false' => 'true_false',
            'truefalse' => 'true_false',
            'fill_blank' => 'fill_blank',
            'fillblank' => 'fill_blank',
            'checkbox_multi' => 'checkbox_multi',
            'checkbox' => 'checkbox_multi',
            'essay' => 'essay',
        ];
        if ($slug !== '' && isset($aliases[$slug])) {
            $mapped = $aliases[$slug];
            if (in_array($mapped, self::QUESTION_TYPES, true)) {
                $qRow['type'] = $mapped;

                return $qRow;
            }
        }

        if ($type === '' && $sectionName === 'Speaking') {
            $qRow['type'] = 'speaking_prompt';

            return $qRow;
        }

        if ($type === '' && $sectionName === 'Writing') {
            $qRow['type'] = 'essay';

            return $qRow;
        }

        if ($type === '' && in_array($sectionName, ['Listening', 'Reading'], true)) {
            $opts = $qRow['options_json'] ?? null;
            if (is_array($opts) && isset($opts['A'], $opts['B'], $opts['C'], $opts['D'])
                && is_string($opts['A']) && is_string($opts['B']) && is_string($opts['C']) && is_string($opts['D'])) {
                $qRow['type'] = 'multiple_choice';

                return $qRow;
            }
        }

        if ($type === '' && $sectionName === 'Listening') {
            $script = isset($qRow['audio_script']) && is_string($qRow['audio_script']) ? trim($qRow['audio_script']) : '';
            if ($script !== '') {
                $qRow['type'] = 'multiple_choice';

                return $qRow;
            }
        }

        return $qRow;
    }

    /**
     * Normalizes MCQ option payloads so {@see normalizeQuestionRowForImport} can infer `multiple_choice`
     * when the model uses alternate keys, lowercase letters, stringified JSON, or {text} objects.
     *
     * @param  array<string, mixed>  $qRow
     * @return array<string, mixed>
     */
    private function coerceMcqOptionsJsonOnQuestionRow(array $qRow): array
    {
        $opts = $qRow['options_json'] ?? null;
        if (is_string($opts)) {
            $decoded = json_decode($opts, true);
            if (is_array($decoded)) {
                $qRow['options_json'] = $decoded;
                $opts = $decoded;
            }
        }
        if ((! is_array($opts) || ! $this->optionsJsonHasStringQuad($opts)) && isset($qRow['options']) && is_array($qRow['options'])) {
            $qRow['options_json'] = $qRow['options'];
            unset($qRow['options']);
            $opts = $qRow['options_json'];
        }
        if (! is_array($opts)) {
            return $qRow;
        }

        $norm = [];
        foreach ($opts as $k => $v) {
            if (is_string($k) || is_int($k)) {
                $letter = strtoupper(trim((string) $k));
            } else {
                continue;
            }
            if (! in_array($letter, ['A', 'B', 'C', 'D'], true)) {
                continue;
            }
            if (is_string($v) && trim($v) !== '') {
                $norm[$letter] = $v;

                continue;
            }
            if (is_array($v)) {
                $text = $v['text'] ?? $v['label'] ?? $v['value'] ?? $v['option'] ?? null;
                if (is_string($text) && trim($text) !== '') {
                    $norm[$letter] = $text;
                }
            }
        }
        if (isset($norm['A'], $norm['B'], $norm['C'], $norm['D'])) {
            $qRow['options_json'] = $norm;
        }

        return $qRow;
    }

    /**
     * @param  array<string, mixed>  $opts
     */
    private function optionsJsonHasStringQuad(array $opts): bool
    {
        foreach (['A', 'B', 'C', 'D'] as $k) {
            if (! isset($opts[$k]) || ! is_string($opts[$k]) || trim($opts[$k]) === '') {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $qRow
     * @return array<string, mixed>
     */
    private function prepareQuestionRowForImport(array $qRow, string $sectionName): array
    {
        $qRow = $this->normalizeQuestionRowForImport($qRow, $sectionName);

        return $this->applyCelpipTaskMetadata($qRow, $sectionName);
    }

    /**
     * When a run allows exactly one CELPIP task for a section, the model sometimes omits
     * celpip_task_number / celpip_task_label (e.g. short completions on speaking_prompt + image fields).
     * Fill from the catalog so validation and import stay aligned with the exam's task scope.
     *
     * @param  array<string, mixed>  $qRow
     * @param  list<int>|null  $allowedCelpipTaskNumbers
     * @return array<string, mixed>
     */
    private function inferMissingCelpipTaskMetadataFromSingleAllowed(
        array $qRow,
        string $sectionName,
        ?array $allowedCelpipTaskNumbers
    ): array {
        if ($allowedCelpipTaskNumbers === null || count($allowedCelpipTaskNumbers) !== 1) {
            return $qRow;
        }
        if (! isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName])) {
            return $qRow;
        }
        $existing = $qRow['celpip_task_number'] ?? null;
        if ($existing !== null && $existing !== '' && is_numeric($existing)) {
            return $qRow;
        }
        $only = (int) $allowedCelpipTaskNumbers[0];
        if (! isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName][$only])) {
            return $qRow;
        }
        $qRow['celpip_task_number'] = $only;
        $qRow['celpip_task_label'] = CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName][$only];

        return $this->applyCelpipTaskMetadata($qRow, $sectionName);
    }

    /**
     * @param  array<string, mixed>  $qRow
     * @return array<string, mixed>
     */
    private function applyCelpipTaskMetadata(array $qRow, string $sectionName): array
    {
        if (! isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName])) {
            $qRow['celpip_task_number'] = null;
            $qRow['celpip_task_label'] = null;

            return $qRow;
        }

        $numRaw = $qRow['celpip_task_number'] ?? null;
        $labelRaw = $qRow['celpip_task_label'] ?? null;
        [$n, $label] = CelpipOfficialTaskCatalog::resolveForQuestion($sectionName, $numRaw, $labelRaw);
        $qRow['celpip_task_number'] = $n;
        $qRow['celpip_task_label'] = $label;

        return $qRow;
    }

    /**
     * @param  array<string, mixed>  $qRow
     * @param  list<int>|null  $allowedCelpipTaskNumbers  When non-null, question must carry CELPIP task metadata and number must be in this list.
     */
    private function assertValidQuestion(array $qRow, string $testTitle, int $qi, string $sectionName = '', ?array $allowedCelpipTaskNumbers = null): void
    {
        $type = $qRow['type'] ?? '';
        if (! in_array($type, self::QUESTION_TYPES, true)) {
            throw new InvalidArgumentException("Test \"{$testTitle}\" question #".($qi + 1).": invalid type \"{$type}\".");
        }
        if (empty($qRow['question_text']) || ! is_string($qRow['question_text'])) {
            throw new InvalidArgumentException("Test \"{$testTitle}\" question #".($qi + 1).': question_text required.');
        }
        if (! array_key_exists('correct_answer', $qRow)) {
            throw new InvalidArgumentException("Test \"{$testTitle}\" question #".($qi + 1).': correct_answer required.');
        }

        if ($type === 'multiple_choice') {
            $opts = $qRow['options_json'] ?? null;
            if (! is_array($opts) || count($opts) < 2) {
                throw new InvalidArgumentException("Test \"{$testTitle}\" MCQ #".($qi + 1).': options_json must be an object with A–D.');
            }
            foreach (['A', 'B', 'C', 'D'] as $k) {
                if (empty($opts[$k]) || ! is_string($opts[$k])) {
                    throw new InvalidArgumentException("Test \"{$testTitle}\" MCQ #".($qi + 1).": missing option {$k}.");
                }
            }
            $ans = strtoupper(trim((string) $qRow['correct_answer']));
            if (! in_array($ans, ['A', 'B', 'C', 'D'], true)) {
                throw new InvalidArgumentException("Test \"{$testTitle}\" MCQ #".($qi + 1).': correct_answer must be A–D.');
            }

            $script = isset($qRow['audio_script']) && is_string($qRow['audio_script']) ? trim($qRow['audio_script']) : '';
            if ($script !== '') {
                $scriptLen = function_exists('mb_strlen') ? mb_strlen($script, 'UTF-8') : strlen($script);
                $minA = self::MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $targetA = self::TARGET_MIN_LISTENING_AUDIO_SCRIPT_CHARS;
                $maxA = self::MAX_LISTENING_AUDIO_SCRIPT_CHARS;
                if ($scriptLen < $minA) {
                    throw new InvalidArgumentException(
                        "Test \"{$testTitle}\" MCQ #".($qi + 1).": audio_script is too short ({$scriptLen} characters). Minimum is {$minA} characters; when generating new content, aim {$targetA}–{$maxA}."
                    );
                }
                if ($scriptLen > $maxA) {
                    throw new InvalidArgumentException(
                        "Test \"{$testTitle}\" MCQ #".($qi + 1).": audio_script is too long ({$scriptLen} characters). Maximum is {$maxA} characters for practical TTS."
                    );
                }
                if ($sectionName === 'Listening') {
                    $this->assertListeningMcqStemUsesScriptTokens((string) $qRow['question_text'], $script, $testTitle, $qi);
                }
            }
        }

        if ($allowedCelpipTaskNumbers !== null && $sectionName !== '' && isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName])) {
            $n = $qRow['celpip_task_number'] ?? null;
            if ($n === null) {
                throw new InvalidArgumentException(
                    "Test \"{$testTitle}\" question #".($qi + 1).': celpip_task_number and celpip_task_label are required for this CELPIP task-scoped generation.'
                );
            }
            $n = (int) $n;
            if (! in_array($n, $allowedCelpipTaskNumbers, true)) {
                throw new InvalidArgumentException(
                    "Test \"{$testTitle}\" question #".($qi + 1).": celpip_task_number {$n} is not allowed for {$sectionName} in this run (allowed: ".implode(', ', $allowedCelpipTaskNumbers).').'
                );
            }
            $lab = $qRow['celpip_task_label'] ?? null;
            if (! is_string($lab) || trim($lab) === '') {
                throw new InvalidArgumentException(
                    "Test \"{$testTitle}\" question #".($qi + 1).': celpip_task_label is required for this CELPIP task-scoped generation.'
                );
            }
        }
    }

    /**
     * Rejects obvious stem/script mismatches (e.g. "barista" in the stem for a hardware-store dialogue).
     */
    private function assertListeningMcqStemUsesScriptTokens(string $questionText, string $audioScript, string $testTitle, int $qi): void
    {
        $stem = mb_strtolower($questionText);
        $script = mb_strtolower($audioScript);
        foreach (self::LISTENING_STEM_PHRASES_REQUIRING_SCRIPT_SUBSTRING as $phrase) {
            if (str_contains($stem, $phrase) && ! str_contains($script, $phrase)) {
                throw new InvalidArgumentException(
                    "Test \"{$testTitle}\" Listening MCQ #".($qi + 1).": question_text mentions \"{$phrase}\" but audio_script does not—revise the stem to match the dialogue (same roles and setting as the script)."
                );
            }
        }
        foreach (self::LISTENING_STEM_LEXEMES_REQUIRING_SCRIPT_SUBSTRING as $word) {
            if (preg_match('/\b'.preg_quote($word, '/').'\b/u', $stem) && ! str_contains($script, $word)) {
                throw new InvalidArgumentException(
                    "Test \"{$testTitle}\" Listening MCQ #".($qi + 1).": question_text mentions \"{$word}\" but that does not appear in audio_script—use speaker labels and vocabulary from the clip only."
                );
            }
        }
    }

    private function normalizeOptionsJson(mixed $options): ?array
    {
        if ($options === null) {
            return null;
        }
        if (! is_array($options)) {
            return null;
        }

        return $options;
    }

    private function normalizeCorrectAnswer(mixed $value): string
    {
        if (is_array($value)) {
            return json_encode($value);
        }

        return (string) $value;
    }

    /**
     * Randomly permute A–D labels so learners do not see model bias (e.g. every key is A).
     *
     * @param  array<string, string>  $opts
     * @return array{options: array<string, string>, correct_answer: string}
     */
    private function shuffleMcqOptionsIfQuad(array $opts, string $correctLetter): array
    {
        $letters = ['A', 'B', 'C', 'D'];
        foreach ($letters as $L) {
            if (! isset($opts[$L]) || ! is_string($opts[$L]) || trim($opts[$L]) === '') {
                return ['options' => $opts, 'correct_answer' => $correctLetter];
            }
        }

        $correctLetter = strtoupper(trim($correctLetter));
        if (! in_array($correctLetter, $letters, true)) {
            return ['options' => $opts, 'correct_answer' => $correctLetter];
        }

        $pairs = [];
        foreach ($letters as $L) {
            $pairs[] = ['k' => $L, 't' => $opts[$L]];
        }
        shuffle($pairs);

        $newOpts = [];
        foreach ($letters as $i => $L) {
            $newOpts[$L] = $pairs[$i]['t'];
        }

        $newCorrect = $correctLetter;
        foreach ($letters as $i => $L) {
            if ($pairs[$i]['k'] === $correctLetter) {
                $newCorrect = $L;
                break;
            }
        }

        return ['options' => $newOpts, 'correct_answer' => $newCorrect];
    }

    /** Collapse whitespace to a single line and truncate for terminal preview. */
    private function previewOneLine(?string $text, int $maxLen): string
    {
        $s = preg_replace('/\s+/u', ' ', trim((string) $text));
        if ($s === '') {
            return '(empty)';
        }
        if (function_exists('mb_strlen') && mb_strlen($s) > $maxLen) {
            return mb_substr($s, 0, max(0, $maxLen - 1)).'…';
        }
        if (strlen($s) > $maxLen) {
            return substr($s, 0, $maxLen - 1).'…';
        }

        return $s;
    }

    private function normalizedQuestionStemKey(?string $text): string
    {
        return strtolower(preg_replace('/\s+/u', ' ', trim((string) $text)));
    }

    /**
     * Unify CRLF/CR to LF and collapse 3+ consecutive newlines so stored passages render cleanly.
     */
    private function normalizeMultilinePassage(?string $text): ?string
    {
        if ($text === null || $text === '') {
            return null;
        }
        $t = str_replace(["\r\n", "\r"], "\n", $text);
        $t = preg_replace('/\n{3,}/u', "\n\n", $t);

        return trim($t) === '' ? null : trim($t);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function extractQuestionsForTestTitle(array $payload, string $expectedTitle): array
    {
        $want = $this->normalizeTitleForMatch($expectedTitle);
        $matches = [];
        foreach ($payload['exams'] ?? [] as $exam) {
            if (! is_array($exam)) {
                continue;
            }
            foreach ($exam['sections'] ?? [] as $sec) {
                if (! is_array($sec)) {
                    continue;
                }
                foreach ($sec['tests'] ?? [] as $t) {
                    if (! is_array($t)) {
                        continue;
                    }
                    if ($this->normalizeTitleForMatch((string) ($t['title'] ?? '')) !== $want) {
                        continue;
                    }
                    $q = $t['questions'] ?? null;
                    if (is_array($q) && $q !== []) {
                        $matches[] = $q;
                    }
                }
            }
        }
        if (count($matches) === 0) {
            return [];
        }
        if (count($matches) > 1) {
            throw new InvalidArgumentException(
                'Multiple tests titled "'.$expectedTitle.'" with non-empty questions were found in the JSON.'
            );
        }

        return $matches[0];
    }

    private function normalizeDifficulty(?string $difficulty): string
    {
        $d = strtolower(trim((string) $difficulty));

        return in_array($d, ['easy', 'medium', 'hard'], true) ? $d : 'medium';
    }

    /**
     * User-message block so regeneration respects the DB test difficulty.
     */
    private function difficultyAuthoringInstructionForTest(string $difficulty): string
    {
        $ideaRule = ' **BandReady policy:** Stems and options must stay **idea-based**—no **how many / how much** questions and no keyed answers that are **primarily a number**; see system prompt.';

        return match ($this->normalizeDifficulty($difficulty)) {
            'easy' => '**Difficulty (mandatory for new questions):** This test is still labelled **easy** in the database, but **do not** author remedial or trivial content. Treat it as **at least medium (B2)**: standard exam-style syntax, stems that require careful reading/listening of **ideas** (purpose, implication, stance), and plausible wrong options—not obvious giveaways.'.$ideaRule,
            'hard' => '**Difficulty (mandatory for new questions):** This test is marked **hard**. Target upper B2–C1: denser or more subtle passages and audio, stems that may require **integrating** two details or spotting **implication, tone, or argument**, and **attractive** wrong options (plausible misreadings of **ideas**—not four competing numerals)—still exactly one correct answer grounded in the source.'.$ideaRule,
            default => '**Difficulty (mandatory for new questions):** This test is marked **medium** (typical exam practice, ~B2). Balance explicit detail with one-step inference about **meaning**; wrong options plausible but distinguishable with careful reading/listening. Avoid stems whose natural answer is a **bare quantity or figure**.'.$ideaRule,
        };
    }

    /**
     * @param  list<array<string, mixed>>  $questions
     * @return array<string, mixed>
     */
    private function buildCanonicalPayloadForExistingTest(Exam $exam, Test $test, array $questions): array
    {
        $test->loadMissing('section');
        $section = $test->section;
        if ($section === null) {
            throw new InvalidArgumentException('Test has no section.');
        }

        return [
            'exams' => [[
                'name' => $exam->name,
                'code' => $exam->code,
                'type' => $exam->type,
                'sections' => [[
                    'name' => $section->name,
                    'duration_minutes' => (int) $section->duration_minutes,
                    'sort_order' => (int) $section->sort_order,
                    'tests' => [[
                        'title' => $test->title,
                        'difficulty' => $test->difficulty,
                        'is_full_mock' => (bool) $test->is_full_mock,
                        'practice_mode' => $test->practice_mode,
                        'duration_minutes' => $test->duration_minutes,
                        'is_available' => (bool) $test->is_available,
                        'questions' => $questions,
                    ]],
                ]],
            ]],
        ];
    }

    /**
     * Same pipeline as {@see OpenAiGenerateQuestionnaireCommand} (generate, validate, import).
     *
     * @param  array{
     *   file_path?: string|null,
     *   file_content?: string|null,
     *   extra_prompt?: string,
     *   model?: string|null,
     *   questions_per_test?: int|null,
     *   section?: array<int, string>|string|null,
     *   exam_title?: string,
     *   test_title?: string,
     *   dry_run?: bool,
     *   no_question_preview?: bool,
     *   with_speaking_images?: bool,
     *   celpip_section_tasks?: array<string, list<int>>|null,
     *   omit_passage_text?: bool
     * } $opts
     * @return array{code: int, payload?: array|null}
     */
    public function runPipeline(OutputInterface $output, array $opts): array
    {
        $fail = static function (string $message) use ($output): array {
            $output->writeln('ERROR: '.$message);

            return ['code' => 1];
        };

        $filePath = isset($opts['file_path']) ? trim((string) $opts['file_path']) : '';
        $fileContent = isset($opts['file_content']) ? (string) $opts['file_content'] : '';
        $extra = trim((string) ($opts['extra_prompt'] ?? ''));
        $model = $opts['model'] ?? null;
        $model = is_string($model) && $model !== '' ? $model : null;
        $questionsPerTestInt = $opts['questions_per_test'] ?? null;
        if ($questionsPerTestInt !== null && (! is_int($questionsPerTestInt) || $questionsPerTestInt < 1)) {
            return $fail('--questions-per-test must be a positive integer.');
        }

        /** @var list<string>|string|null $sectionOpt */
        $sectionOpt = $opts['section'] ?? null;
        $onlySections = null;
        try {
            $onlySections = $this->parseSectionOption($sectionOpt);
        } catch (InvalidArgumentException $e) {
            return $fail($e->getMessage());
        }
        if (is_array($onlySections) && $onlySections !== []) {
            $output->writeln('Section filter (OpenAI only): '.implode(', ', $onlySections));
        }

        $examTitle = trim((string) ($opts['exam_title'] ?? ''));
        $testTitle = trim((string) ($opts['test_title'] ?? ''));
        $existingTarget = null;
        if ($examTitle !== '' || $testTitle !== '') {
            if ($examTitle === '' || $testTitle === '') {
                return $fail('When targeting an existing test, provide both exam_title and test_title (or omit both for a new hierarchy).');
            }
            $preferredSectionForNewTest = is_array($onlySections) && count($onlySections) === 1
                ? $onlySections[0]
                : null;
            try {
                $existingTarget = $this->resolveExistingExamAndTestByTitles($examTitle, $testTitle, $preferredSectionForNewTest);
            } catch (InvalidArgumentException $e) {
                return $fail($e->getMessage());
            }
            $ex = $existingTarget['exam'];
            $te = $existingTarget['test'];
            if ($te->wasRecentlyCreated) {
                $output->writeln("Created new test #{$te->id} \"{$te->title}\" under section \"{$te->section->name}\" on exam \"{$ex->name}\" ({$ex->code}).");
            } else {
                $output->writeln("Existing target: exam \"{$ex->name}\" ({$ex->code}), test #{$te->id} \"{$te->title}\" ({$te->section->name})");
            }
        }

        if ($existingTarget !== null && is_array($onlySections) && $onlySections !== []) {
            $te = $existingTarget['test'];
            if ($te->wasRecentlyCreated) {
                if (count($onlySections) > 1) {
                    $output->writeln('WARNING: --section: multiple values were given; the new test was placed using the exam\'s first section by sort order (pass exactly one section=Name to choose a section).');
                }
            } else {
                $output->writeln('WARNING: --section is ignored when the test already exists (section comes from the existing test).');
            }
        }

        $onlySectionsForOpenAi = $existingTarget !== null ? null : $onlySections;

        $withSpeakingImages = (bool) ($opts['with_speaking_images'] ?? false);
        if ($withSpeakingImages) {
            $speakingScoped = $this->sectionScopeIncludesSpeaking($onlySections, $existingTarget);
            if (! $speakingScoped) {
                $output->writeln('WARNING: --with-speaking-images ignored: scope does not include Speaking (use section=Speaking or target a Speaking test).');
                $withSpeakingImages = false;
            } else {
                $output->writeln('Speaking picture tasks: model will output image_generation_prompt + grading text; images generated after import.');
            }
        }

        $dryRun = (bool) ($opts['dry_run'] ?? false);
        $noQuestionPreview = (bool) ($opts['no_question_preview'] ?? false);
        $omitOptionalPassageText = (bool) ($opts['omit_passage_text'] ?? false);

        /** @var array<string, list<int>>|null $celpipNormalized */
        $celpipNormalized = null;
        if (isset($opts['celpip_section_tasks']) && is_array($opts['celpip_section_tasks'])) {
            try {
                $celpipNormalized = CelpipOfficialTaskCatalog::validateAndNormalize($opts['celpip_section_tasks']);
            } catch (InvalidArgumentException $e) {
                return $fail($e->getMessage());
            }
        }

        try {
            if ($filePath !== '') {
                if (! is_readable($filePath)) {
                    return $fail("File not readable: {$filePath}");
                }
                $raw = file_get_contents($filePath);
                if ($raw === false) {
                    return $fail("Could not read: {$filePath}");
                }
                $payload = $this->decodePayloadJson($raw);
                $output->writeln('Loaded JSON from file: '.$filePath);
                if ($questionsPerTestInt !== null) {
                    $output->writeln('WARNING: --questions-per-test applies only when generating via OpenAI; ignored for --file.');
                }
                if ($onlySections !== null && $onlySections !== []) {
                    $output->writeln('WARNING: --section applies only when generating via OpenAI; ignored for --file.');
                }
                if ($existingTarget !== null) {
                    $payload = $this->mergePayloadOntoExistingTest($payload, $existingTarget['exam'], $existingTarget['test']);
                    $output->writeln('Anchored file JSON to existing exam/test (DB metadata + questions from file).');
                }
            } elseif (trim($fileContent) !== '') {
                $payload = $this->decodePayloadJson($fileContent);
                $output->writeln('Loaded JSON from request body (import mode).');
                if ($questionsPerTestInt !== null) {
                    $output->writeln('WARNING: questions_per_test applies only when generating via OpenAI; ignored for file JSON.');
                }
                if ($onlySections !== null && $onlySections !== []) {
                    $output->writeln('WARNING: section filter applies only when generating via OpenAI; ignored for file JSON.');
                }
                if ($existingTarget !== null) {
                    $payload = $this->mergePayloadOntoExistingTest($payload, $existingTarget['exam'], $existingTarget['test']);
                    $output->writeln('Anchored file JSON to existing exam/test (DB metadata + questions from file).');
                }
            } else {
                if ($extra !== '') {
                    $output->writeln('Extra prompt: '.$extra);
                }
                if ($omitOptionalPassageText) {
                    $output->writeln('Omit optional passage_text: ON (appended to OpenAI user message).');
                }
                $payload = $this->generatePayload($extra, $model, $output, $questionsPerTestInt, $onlySectionsForOpenAi, $existingTarget, $withSpeakingImages, $celpipNormalized, $omitOptionalPassageText);
            }

            $output->writeln('Validating payload structure…');
            $this->validatePayload($payload, $celpipNormalized);
            $examN = count($payload['exams']);
            $output->writeln("Payload OK: {$examN} exam(s) in response.");
        } catch (InvalidArgumentException $e) {
            return $fail($e->getMessage());
        }

        if ($dryRun) {
            $output->writeln('Dry run — printing JSON only; database unchanged.');
            if ($withSpeakingImages) {
                $output->writeln('Note: with_speaking_images would run image generation after import; skipped in dry-run.');
            }
            $output->writeln(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            return ['code' => 0, 'payload' => $payload];
        }

        try {
            $this->importPayload($payload, $output, ! $noQuestionPreview, $withSpeakingImages, $celpipNormalized);
        } catch (InvalidArgumentException $e) {
            return $fail($e->getMessage());
        }

        $count = count($payload['exams']);
        $output->writeln("Done. Processed {$count} exam(s); questions were appended where tests already existed.");

        return ['code' => 0, 'payload' => null];
    }
}
