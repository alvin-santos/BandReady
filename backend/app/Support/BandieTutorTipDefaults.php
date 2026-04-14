<?php

namespace App\Support;

/**
 * Built-in Bandie tutor tip lines (merged with DB overrides when columns are null or partial).
 *
 * @phpstan-type TipBank array{speaking: list<string>, reading: list<string>, writing: list<string>, listening: list<string>}
 */
final class BandieTutorTipDefaults
{
    /** @var list<string> */
    public const SECTIONS = ['speaking', 'reading', 'writing', 'listening'];

    /**
     * @return TipBank
     */
    public static function compactDefaults(): array
    {
        return [
            'speaking' => [
                'Speak continuously. Avoid long pauses.',
                'Fluency matters more than perfect grammar.',
                'Use examples to support your answer.',
                'Try to speak for the full time.',
                'Avoid one-word answers.',
                "Use linking words like 'because' and 'also'.",
                'Add personal experiences.',
                "Don't worry about your accent.",
                'Explain your ideas clearly.',
                'Keep talking even if you make mistakes.',
            ],
            'writing' => [
                'Answer the question directly first.',
                'Use paragraphs to organize ideas.',
                'Give at least one example.',
                "Don't repeat the same words.",
                'Use simple sentences if unsure.',
                'Check spelling before submitting.',
                'Write more than the minimum word count.',
                'Support opinions with reasons.',
                'Stay on topic.',
                'Use linking words between sentences.',
            ],
            'reading' => [
                'Read questions before the passage.',
                'Scan for keywords.',
                "Don't read everything slowly.",
                'Watch for synonyms.',
                'Skip hard questions and return later.',
                'Answers follow order in passage.',
                'Focus on names and numbers.',
                'Use elimination method.',
                "Don't overthink.",
                'Look for paraphrased meaning.',
            ],
            'listening' => [
                'Focus on keywords.',
                'Answers follow the audio order.',
                "Don't panic if you miss one.",
                'Watch spelling carefully.',
                'Listen for paraphrasing.',
                'Keep eyes on next question.',
                'Write while listening.',
                'Stay focused until the end.',
                'Check grammar of answers.',
                'Plural and singular matter.',
            ],
        ];
    }

    /**
     * @return TipBank
     */
    public static function detailedDefaults(): array
    {
        return [
            'speaking' => [
                'Fluency beats perfection: examiners notice long silences more than small grammar slips. Keep your voice moving with simple connectors (“and then…”, “because…”) while you think.',
                'Use one concrete example per main idea—a short story from work, school, or daily life makes your answer easier to follow and sounds more natural than abstract lists.',
                'Aim to use most of the prep/speaking time. If you finish early, add a consequence (“So that meant…”) or a quick contrast (“I used to… but now…”) instead of stopping cold.',
                'One-word answers sound unfinished. Turn “Yes” into “Yes, mainly because…” or restate the question in one clause before you give your view.',
                'Linking words signal logic: “although”, “even so”, “on the other hand”, and “that’s why” help the listener track your argument without you needing perfect vocabulary.',
                'Accent is fine if you’re clear. Slow down slightly on key nouns and stress the words that carry your opinion—listeners grasp meaning from emphasis as much as grammar.',
                'If you lose a word, paraphrase (“the kind of place where…”) instead of freezing. Recovery shows the same communication skill exams reward.',
                'Answer the prompt first, then elaborate. Two short clear sentences beat one long sentence that never quite commits to a position.',
                'Compare or rank ideas when asked (“both matter, but X is more important because…”). That structure matches how many speaking rubrics score “development”.',
                'Mistakes while still developing an idea are better than perfect silence. Self-correct once if needed (“…or rather…”), then continue forward.',
            ],
            'writing' => [
                'Start with a direct answer to the task (your position or summary line), then support it. Examiners scan for relevance before they reward detail.',
                'One idea per paragraph with a clear topic sentence keeps your essay readable under time pressure and matches how markers award “coherence”.',
                'Concrete beats vague: swap “many problems” for “traffic delays and higher rent” when you can—specific nouns make arguments feel grounded without needing rare words.',
                'Vary sentence openings (not every sentence with “The”). Simple patterns like “However,” “For example,” and “This suggests” add rhythm and cohesion.',
                'If you’re unsure of a complex structure, choose two short correct sentences instead of one long risky one. Accuracy still matters alongside range.',
                'Save two minutes for a quick spell-check of task words (names, question terms) and obvious typos—first impressions include clean key terms.',
                'Word count: aim clearly above the minimum so you have room for development; thin essays rarely hit top bands even when grammar is clean.',
                'When you give an opinion, add “because” with a reason, then optionally “for example” with a mini-example—that’s a full band-building move in one paragraph.',
                'Stay on the question’s scope. If it asks about “your local area”, don’t drift into global policy unless you tie it back (“In my city that shows up as…”).',
                'Use discourse markers between paragraphs (“Another factor is…”, “In contrast…”) so the reader feels a planned structure, not a list of random points.',
            ],
            'reading' => [
                'Skim the questions first so you know what to hunt for—names, dates, opinions, or “according to the text” stems tell you what to anchor on while you read.',
                'Answers usually follow passage order on many tests: if you’re stuck, don’t burn minutes on one item—flag mentally and move on, then return with fresher eyes.',
                'Paraphrase is normal: the correct option may use different words than the passage. Match meaning and attitude, not identical wording.',
                'Elimination works when two options sound plausible: find the one line in the passage that confirms one and contradicts the other, even subtly.',
                'Numbers and proper nouns are easy anchors—underline mentally when you see them; questions often target exactly those details.',
                '“Main purpose” and “writer’s attitude” items need the whole paragraph context, not the first sentence only—read the shift sentences too.',
                'Don’t read every word at the same speed: slow down for the paragraph that matches the question stem, skim transitions elsewhere.',
                'If an option introduces an idea never mentioned, it’s usually wrong—good distractors stay inside the passage’s topic universe.',
                'Time box: if you’ve re-read the same lines twice without progress, pick your best elimination guess and move on—unfinished easy items cost more than one hard guess.',
                'Inference items still need evidence: choose the option best supported by a combination of sentences, not the one that sounds smartest in general knowledge.',
            ],
            'listening' => [
                'The clip and the question are one unit: the right answer is something you could defend by pointing to what was said—not general life advice.',
                'Listen for signposts (“the problem is…”, “what we decided…”, “the reason I called…”). They often introduce the exact idea the MCQ tests.',
                'Audio often moves in order while questions follow the clip—if you miss an answer, jump to the next question’s window instead of replaying the whole thing in your head forever.',
                'Spelling still counts on written responses: note plural endings and small words you mis-hear (“than” vs “then”) when you transfer answers.',
                'Speakers paraphrase: the stem may say “postpone” while audio says “push it to next week”—train your ear for synonyms under exam stress.',
                'Keep your eyes on the next stem while the clip plays for the prior item if the interface allows it—you’ll know what detail to listen for on the second pass mentally.',
                'Jot keywords during long clips (names, times, negatives like “didn’t”) so you don’t rely on memory when the options appear.',
                'If two options both sound familiar, ask which one matches the speaker’s final stance—last-minute corrections happen a lot in dialogues.',
                'Don’t panic on one missed detail: later items may be easier; missing one beat losing the rhythm for the whole section.',
                'Check subject–verb and tense when you write the answer: audio might be past tense while an option tempts you with present—match the speakers’ timeframe.',
                'Map answers to the order of information in the clip: if the stem asks about a later development, wait for that part of the audio before you lock in a choice—first mentions can be red herrings.',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>|null  $stored
     * @param  TipBank  $defaults
     * @return TipBank
     */
    public static function merge(?array $stored, array $defaults): array
    {
        if ($stored === null || $stored === []) {
            return $defaults;
        }
        $out = [];
        foreach (self::SECTIONS as $sec) {
            $raw = $stored[$sec] ?? null;
            if (! is_array($raw)) {
                $out[$sec] = $defaults[$sec];

                continue;
            }
            $clean = [];
            foreach ($raw as $line) {
                if (! is_string($line) && ! is_numeric($line)) {
                    continue;
                }
                $t = trim((string) $line);
                if ($t !== '') {
                    $clean[] = $t;
                }
            }
            $out[$sec] = $clean !== [] ? array_values($clean) : $defaults[$sec];
        }

        return $out;
    }
}
