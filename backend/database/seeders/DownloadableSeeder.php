<?php

namespace Database\Seeders;

use App\Models\Downloadable;
use Illuminate\Database\Seeder;

class DownloadableSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'title' => 'Exam day checklist',
                'slug' => 'exam-day-checklist',
                'description' => 'What to pack, timing, ID rules, and calm routines — tuned for computer-delivered and paper-style sittings.',
                'requires_pro' => false,
                'sort_order' => 1,
                'download_filename' => 'bandready-exam-day-checklist.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady — Exam day checklist (free)
======================================
Use this the week before your sitting and again the night before. Official rules always come from your test provider and centre.

One week out
- Book travel / parking; screenshot confirmation emails (centre address, reporting time).
- Check ID policy: usually one government photo ID, name must match registration exactly.
- If computer-delivered: confirm whether scratch paper is supplied or if you may bring a pen only.

Night before
- Aim for normal sleep; avoid “all-nighter” listening loops — fatigue hurts concentration more than one extra passage.
- Lay out clothes without metal that might slow security (belt, bulky jewellery) if your centre is strict.
- Set two alarms; charge phone but plan to leave it in a locker or car if required.

Morning of
- Eat a meal you know sits well; moderate caffeine if you use it habitually (avoid experimenting today).
- Arrive at the “reporting time”, not the test start time shown on some tickets.
- Bathroom before check-in; queues can be long.

In the room (general)
- Listen/read instructions once calmly; mis-clicking from panic costs more than 30 seconds of care.
- Note your remaining time on screen; never assume the proctor will warn you for every section.
- If audio fails or a passage skips: signal staff immediately — do not try to “guess through” technical faults.

During the test
- Flag hard items in reading/listening and move on; return if time allows.
- Writing: spend a fixed slice on planning (even 3–4 lines) before you type — it reduces mid-essay rewrites.
- Speaking: full sentences beat fillers; a short pause to think beats rambling.

Mindset
- One weak section does not “cancel” the rest; reset before the next part.
- BandReady practice scores are not official band predictions — use them to find gaps, not to forecast results.

TXT,
            ],
            [
                'title' => 'Quick study vocabulary sheet',
                'slug' => 'quick-vocabulary-sheet',
                'description' => 'High-utility words, collocations, and a simple method to turn any list into active recall.',
                'requires_pro' => false,
                'sort_order' => 2,
                'download_filename' => 'bandready-vocabulary-burst.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady — Vocabulary bursts (free)
====================================
Goal: 10–15 minutes, active use — not silent re-reading.

Method (repeat weekly)
1) Pick 8–12 new items max from YOUR last practice: words you almost knew or misused.
2) For each: write one sentence (speaking-style) OR one clause (writing-style) using it accurately.
3) Cover the list; try to recall aloud without looking. Mark misses for tomorrow.

Opinion & stance (examples — build your own parallel lists)
- maintain, undermine, outweigh, feasible, contentious, nuanced, warranted
- Collocations: draw a distinction, lend support to, run counter to, on pragmatic grounds

Trends & data
- plateau, surge, marginal, proportion, negligible, respectively, year-on-year
- Sample frame: “The figure for X rose steadily, whereas Y plateaued after 2015.”

Cause & effect
- stem from, give rise to, attributable to, consequently, thereby, in light of

Problems & solutions
- alleviate, exacerbate, shortfall, mitigation, viable measure, unintended consequence

Academic caution (tone)
- It would be premature to… / The evidence is inconclusive, yet… / This interpretation rests on…

Remember: examiners reward precision and range you control — rare words used wrongly hurt more than simple words used well.

TXT,
            ],
            [
                'title' => 'Writing task planner & band-style self-review',
                'slug' => 'writing-planner-pro',
                'description' => 'Pro: paragraph roles, timing blocks, cohesion pass, and a compact rubric aligned with how examiners read task response and coherence.',
                'requires_pro' => true,
                'sort_order' => 3,
                'download_filename' => 'bandready-writing-planner-pro.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady Pro — Writing planner & self-review (practice only)
==============================================================
Use for timed practice in the app or paper drills. Official criteria wording belongs to your test provider; this is a learner-friendly mirror.

Step 0 — Decode the task (2–3 min)
- Underline instruction verbs: discuss, agree/disagree, advantages & disadvantages, problem & solution, two-part question.
- List every part you must answer; if you cannot list them, you are not ready to draft.

Step 1 — Position & plan (3–5 min)
- One clear overall position (where the task asks for it) OR balanced treatment with a justified conclusion.
- Body 1 idea + one example type (experience / general case / hypothetical).
- Body 2 different angle (not a repeat of the same claim with new synonyms).

Suggested timing (~40 min task)
- 0–8: decode + plan + thesis
- 8–32: draft (aim for two developed bodies + short conclusion)
- 32–38: cohesion pass (reference words, paragraph openers, remove redundancy)
- 38–40: proofread for article errors, tense shifts, stray fragments

Paragraph roles (quick check)
- Intro: topic frame + direct answer to the question (not a dictionary definition).
- Body: topic sentence → explain → exemplify → mini-link forward.
- Conclusion: summarise logic; avoid brand-new major arguments.

Cohesion pass (tick mentally)
- Pronouns have clear referents.
- “This/that” does not point at two possible nouns.
- Linkers (however, therefore, for instance) match the logical relation — not sprinkled at random.

Self-review rubric (0–2 each; be honest)
- Task response: all parts covered? Position consistent?
- Coherence & cohesion: reader can follow without re-reading sentences?
- Lexical resource: precision + some less common items used well?
- Grammatical range & accuracy: mix of structures; errors do not obscure meaning?

BandReady Pro unlocks deeper writing content in the app where enabled. This sheet does not replace official feedback or human tutoring.

TXT,
            ],
            [
                'title' => 'Listening: note-taking & signal words',
                'slug' => 'listening-notetaking-guide',
                'description' => 'Abbreviations, layout on scratch paper, and signpost language that often precedes answers.',
                'requires_pro' => false,
                'sort_order' => 4,
                'download_filename' => 'bandready-listening-notetaking.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady — Listening note-taking (free)
========================================
Practice on full-length sets, not isolated clips. Official formats differ by test; adapt labels to yours.

Why notes help
- Short-term memory drops under stress; keywords anchor you before the question appears.
- Notes are for you — not full sentences. If you cannot read them in 2 seconds, they are too long.

Paper layout (example)
- Divide sheet by section or by speaker if multi-speaker.
- Leave a margin for “numbers / dates / names” — they are easy to mishear once.

Useful abbreviations (build your own set)
- w/ with | w/o without | → leads to / causes | ↑↓ increase decrease | govt government
- approx. | max min | esp especially | diff different | info information
- b/c because | tho though | envt environment

Signposts that often matter
- contrast: however, on the other hand, whereas, unlike
- emphasis: the main point is, what matters here is, the key issue
- examples: for instance, such as, namely
- correction: actually, I mean, rather — the answer may follow the correction
- sequence: first, next, finally, prior to, subsequently

During the audio
- Write numbers as digits; circle if unit is asked (%, km, $).
- If you miss an item: leave a gap and refocus — chasing one word can cost two more.

After practice
- Replay once with transcript ONLY to see what you mis-segmented (word boundaries, weak forms).

TXT,
            ],
            [
                'title' => 'Reading: time strategy in one pass',
                'slug' => 'reading-time-strategy',
                'description' => 'How to budget minutes per passage, order questions, and recover when you are behind pace.',
                'requires_pro' => false,
                'sort_order' => 5,
                'download_filename' => 'bandready-reading-time-strategy.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady — Reading time strategy (free)
========================================
Adjust numbers to your real section length; the pattern matters more than exact minutes.

Before you read
- Skim the title + any subheads + first sentence of each paragraph — build a “map” of the text.
- Read the first question group; know what you are hunting (name? date? opinion?).

Budget (example: three passages, 60 minutes total)
- Passage A (easiest for YOU): strict cap so you bank time — e.g. 17–18 min including answers.
- Passage B: ~20 min.
- Passage C (often densest): remainder, but never below ~18 min if you can avoid it.

Question order tactics
- If matching headings: consider doing after partial paragraph read — not always first.
- If gap-fill summary: use parallel grammar in the summary to predict word class (noun? adj?).
- True/False/Not Given: “Not Given” means no clear statement — not “I disagree”.

When you are behind
- Skip one hard question, mark it, move on — a string of guesses under time pressure is costly.
- Never re-read whole paragraphs “for feeling”; re-scan the sentence neighbourhood of the item.

Pitfalls
- Over-highlighting: if everything is yellow, nothing is salient.
- Changing answers repeatedly without evidence — first reasoned choice is often best.

TXT,
            ],
            [
                'title' => 'Speaking: Part 2 one-minute plan',
                'slug' => 'speaking-part2-plan',
                'description' => 'A bullet framework for the long turn: past / present / future, and a clean close.',
                'requires_pro' => false,
                'sort_order' => 6,
                'download_filename' => 'bandready-speaking-part2-plan.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady — Speaking Part 2 mini-plan (free)
============================================
Use in timed speaking practice. Cue cards vary by test; this fits “describe / explain / tell” style prompts.

Your 60 seconds of notes (example layout)
- T — topic in one word (e.g. “childhood hobby”)
- W — what it was + where/when (2 bullets)
- W — why it mattered / how you felt (2 bullets)
- S — specific story beat (who / what happened once)
- F — future or contrast today (one line) → helps you finish without trailing off

During the 2-minute talk
- Open with a direct answer in one sentence — examiners notice relevance early.
- Use past tense for memories; watch tense shifts if you jump to “nowadays”.
- If you forget a word: paraphrase (“the place where you borrow books”) instead of long silence.

Fluency without filler overload
- Short pauses are fine; replace “uhhh” with “Let me think — …” once, not every sentence.

Close cleanly
- One sentence summary: “So that’s why I still remember it / I’d recommend it because…”

Self-check after recording
- Did you cover every bullet on the card?
- Was there one concrete example (not only abstract opinion)?

TXT,
            ],
            [
                'title' => 'Writing: Task 1 data language bank',
                'slug' => 'writing-task1-language-pro',
                'description' => 'Pro: verbs, adverbs, and comparison patterns for charts, tables, and processes — with misuse warnings.',
                'requires_pro' => true,
                'sort_order' => 7,
                'download_filename' => 'bandready-writing-task1-language-pro.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady Pro — Task 1 / visual description language (practice only)
====================================================================
Use to vary sentences in data tasks. Always match the figure: do not invent trends the graphic does not support.

Overview (1–2 sentences)
- “Overall, X accounted for the largest share throughout the period, while Y remained the lowest.”
- “The most noticeable change was the sharp increase in … between … and ….”

Numbers & approximations
- just over / just under / approximately / roughly / slightly more than
- Avoid false precision: if the chart is labelled in millions, mirror that unit.

Change verbs (pick by steepness)
- rise, increase, grow, climb | fall, drop, decline, decrease
- level off, plateau | fluctuate | peak at | hit a low of

Adverbs / adjectives (use sparingly, accurately)
- steadily, gradually, sharply, dramatically, marginally, modestly

Comparisons
- twice as high as | threefold increase (be careful: “threefold” = ×3)
- compared with / relative to / whereas / while

Maps & processes (basics)
- to the north of | adjacent to | runs alongside | leads into | subsequent stage

Common misuses to avoid
- “oscillate” for a single up-down — reserve for repeated waves.
- “skyrocket” for a small tick — keep hyperbole for steep real slopes.

Proofread checklist
- Tense: past if years finished; present if “current snapshot” style is required by task.
- Consistent grouping (e.g. per capita vs totals — never mix silently).

TXT,
            ],
            [
                'title' => 'Practice log: mistakes & fixes',
                'slug' => 'practice-mistakes-log-pro',
                'description' => 'Pro: a printable table to capture what went wrong, why, and one concrete fix — turns every session into measurable progress.',
                'requires_pro' => true,
                'sort_order' => 8,
                'download_filename' => 'bandready-practice-mistakes-log-pro.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady Pro — Mistakes & fixes log (practice only)
====================================================
Copy this table by hand or in a notebook after each serious practice block. One honest row beats ten vague “I need more practice” notes.

| Date | Section (L/R/W/S) | Question type or task | What I did wrong (be specific) | Why it happened (time? vocab? misread?) | One fix for next session |
|------|-------------------|------------------------|----------------------------------|-------------------------------------------|----------------------------|
|      |                   |                        |                                  |                                           |                            |
|      |                   |                        |                                  |                                           |                            |
|      |                   |                        |                                  |                                           |                            |

Examples of “specific” wrong
- “Chose True because I agreed with the idea — ignored NG definition.”
- “Missed plural in audio — wrote singular.”
- “Task asked for ‘effects on society’ — I only wrote personal effects.”
- “Used ‘however’ between two similar supporting ideas — not a contrast.”

Examples of “one fix”
- “Do three NG questions with transcript check after.”
- “Pre-write number formats: dates, money, percentages.”
- “Spend 4 min listing both ‘social’ bullets before drafting.”

Weekly review (5 min)
- Count repeated mistake types; only the top one becomes next week’s drill theme.

TXT,
            ],
        ];

        foreach ($items as $row) {
            Downloadable::query()->updateOrCreate(
                ['slug' => $row['slug']],
                array_merge($row, ['is_active' => true])
            );
        }
    }
}
