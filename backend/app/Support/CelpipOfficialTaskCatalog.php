<?php

namespace App\Support;

use App\Models\Exam;
use App\Models\Test;
use InvalidArgumentException;

/**
 * Official CELPIP General section task names (public rubric structure).
 * Used only to steer OpenAI toward authentic-style practice content — not affiliated with Paragon.
 */
class CelpipOfficialTaskCatalog
{
    /** @var array<string, array<int, string>> task_number => short label */
    public const TASKS_BY_SECTION = [
        'Listening' => [
            1 => 'Problem solving',
            2 => 'A daily life conversation',
            3 => 'Information',
            4 => 'News item',
            5 => 'Discussion',
            6 => 'Viewpoints',
        ],
        'Reading' => [
            1 => 'Correspondence',
            2 => 'Apply a Diagram',
            3 => 'Information',
            4 => 'Viewpoints',
        ],
        'Writing' => [
            1 => 'Writing an Email',
            2 => 'Survey Questions',
        ],
        'Speaking' => [
            1 => 'Giving Advice',
            2 => 'Talking about personal experience',
            3 => 'Describing a Scene',
            4 => 'Making predictions',
            5 => 'Comparing and Persuading',
            6 => 'Dealing with a difficult situation',
            7 => 'Expressing opinions',
            8 => 'Describing an unusual situation',
        ],
    ];

    /**
     * @param  array<string, mixed>|null  $input  e.g. ['Listening' => [1, 2], 'Speaking' => [3]]
     * @return array<string, list<int>>|null
     */
    public static function validateAndNormalize(?array $input): ?array
    {
        if ($input === null || $input === []) {
            return null;
        }
        $out = [];
        foreach ($input as $section => $ids) {
            if (! is_string($section) || $section === '') {
                throw new InvalidArgumentException('celpip_section_tasks keys must be section names (Listening, Reading, Writing, Speaking).');
            }
            if (! isset(self::TASKS_BY_SECTION[$section])) {
                throw new InvalidArgumentException("Unknown section \"{$section}\" in celpip_section_tasks.");
            }
            if (! is_array($ids)) {
                throw new InvalidArgumentException("celpip_section_tasks.{$section} must be an array of task numbers.");
            }
            /** @var array<int, bool> $seen */
            $seen = [];
            $norm = [];
            foreach ($ids as $id) {
                $n = is_int($id) ? $id : (is_numeric($id) ? (int) $id : -1);
                if ($n < 1 || ! isset(self::TASKS_BY_SECTION[$section][$n])) {
                    throw new InvalidArgumentException("Invalid task number for {$section}: ".json_encode($id));
                }
                if (! isset($seen[$n])) {
                    $seen[$n] = true;
                    $norm[] = $n;
                }
            }
            if ($norm !== []) {
                $out[$section] = $norm;
            }
        }

        return $out === [] ? null : $out;
    }

    /**
     * @param  array<string, list<int>>  $applicable  pre-filtered to relevant sections
     */
    public static function formatPromptBlock(array $applicable, ?int $questionsPerTest): string
    {
        $lines = [];
        $lines[] = '**Official-style task types (CELPIP General — unofficial BandReady practice; not affiliated with Paragon Testing):**';
        $lines[] = 'Shape passages, audio scenarios, prompts, and stems so they authentically fit the **spirit** of these named task types. Do not add "Task 1" labels inside `question_text` unless the scenario naturally reads like an exam rubric header—focus on realistic formats (e.g. voicemail + problem for Listening problem-solving; email/letter for Reading correspondence; image-backed description for Speaking "Describing a Scene" when picture tasks apply).';
        $lines[] = '';

        foreach (['Listening', 'Reading', 'Writing', 'Speaking'] as $section) {
            if (! isset($applicable[$section]) || $applicable[$section] === []) {
                continue;
            }
            $lines[] = "- **{$section}**";
            foreach ($applicable[$section] as $taskNum) {
                $label = self::TASKS_BY_SECTION[$section][$taskNum];
                $lines[] = "  - **Task {$taskNum} — {$label}**";
            }
            $lines[] = '';
        }

        if ($questionsPerTest !== null && $questionsPerTest >= 1) {
            $lines[] = "**Question count vs. selected tasks:** You must still output exactly {$questionsPerTest} question object(s) per test as required elsewhere.";
            $lines[] = '- If **one** task type is selected for a section’s test, every question in that test should suit that task type.';
            $lines[] = '- If **multiple** task types are selected for one test, **spread** questions across those types (each question should clearly fit one of the selected types; cycle or distribute evenly).';
        } else {
            $lines[] = '**Multiple selected tasks:** When several task types are selected for the same section, distribute questions across them across the test(s) you output for that section.';
        }

        /** @var array<string, list<array{celpip_task_number: int, celpip_task_label: string}>> $binding */
        $binding = [];
        foreach (['Listening', 'Reading', 'Writing', 'Speaking'] as $section) {
            if (! isset($applicable[$section]) || $applicable[$section] === []) {
                continue;
            }
            $binding[$section] = [];
            foreach ($applicable[$section] as $taskNum) {
                $binding[$section][] = [
                    'celpip_task_number' => $taskNum,
                    'celpip_task_label' => self::TASKS_BY_SECTION[$section][$taskNum],
                ];
            }
        }
        if ($binding !== []) {
            $lines[] = '';
            $lines[] = '**Exact task metadata (replicate one matching pair on every question row in that section — numbers and labels must match exactly):**';
            $lines[] = json_encode($binding, JSON_UNESCAPED_UNICODE);
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<string, list<int>>|null  $normalized
     * @param  list<string>|null  $onlySections
     * @param  array{exam: Exam, test: Test}|null  $existingTarget
     * @return array<string, list<int>>
     */
    public static function filterApplicable(?array $normalized, ?array $onlySections, ?array $existingTarget): array
    {
        if ($normalized === null || $normalized === []) {
            return [];
        }
        if ($existingTarget !== null) {
            $existingTarget['test']->loadMissing('section');
            $section = $existingTarget['test']->section;
            if ($section === null) {
                return [];
            }
            $name = $section->name;

            return isset($normalized[$name]) ? [$name => $normalized[$name]] : [];
        }
        if ($onlySections !== null && $onlySections !== []) {
            $flip = array_flip($onlySections);
            $out = [];
            foreach ($normalized as $sec => $ids) {
                if (isset($flip[$sec]) && $ids !== []) {
                    $out[$sec] = $ids;
                }
            }

            return $out;
        }

        return $normalized;
    }

    /**
     * Normalize titles the same way as {@see OpenAiQuestionnaireService::normalizeTitleForMatch}
     * so model output and catalog labels match reliably.
     */
    public static function normalizeTitleForMatch(string $title): string
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
     * Resolve optional CELPIP task metadata for a question row.
     *
     * @return array{0: int|null, 1: string|null} [celpip_task_number, celpip_task_label]
     */
    public static function resolveForQuestion(string $sectionName, mixed $numRaw, mixed $labelRaw): array
    {
        if (! isset(self::TASKS_BY_SECTION[$sectionName])) {
            return [null, null];
        }

        $num = null;
        if ($numRaw !== null && $numRaw !== '' && is_numeric($numRaw)) {
            $num = (int) $numRaw;
        }

        $label = null;
        if (is_string($labelRaw)) {
            $t = trim($labelRaw);
            if ($t !== '') {
                $label = $t;
            }
        }

        if ($num === null && $label === null) {
            return [null, null];
        }

        if ($num !== null) {
            if (! isset(self::TASKS_BY_SECTION[$sectionName][$num])) {
                throw new InvalidArgumentException("Invalid celpip_task_number {$num} for section {$sectionName}.");
            }
            $canonical = self::TASKS_BY_SECTION[$sectionName][$num];
            if ($label !== null && self::normalizeTitleForMatch($label) !== self::normalizeTitleForMatch($canonical)) {
                throw new InvalidArgumentException(
                    "celpip_task_label \"{$label}\" does not match official name for task {$num} in {$sectionName} (expected \"{$canonical}\")."
                );
            }

            return [$num, $canonical];
        }

        $want = self::normalizeTitleForMatch((string) $label);
        foreach (self::TASKS_BY_SECTION[$sectionName] as $n => $canon) {
            if (self::normalizeTitleForMatch($canon) === $want) {
                return [$n, $canon];
            }
        }

        throw new InvalidArgumentException("Unknown celpip_task_label \"{$label}\" for section {$sectionName}.");
    }
}
