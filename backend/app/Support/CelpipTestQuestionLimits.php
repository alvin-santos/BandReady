<?php

namespace App\Support;

use App\Models\Question;
use Illuminate\Support\Collection;

/**
 * Subsamples a test’s question bank for each attempt using optional per–CELPIP-task caps on {@see Test}.
 */
final class CelpipTestQuestionLimits
{
    /**
     * @param  array<mixed, mixed>|null  $capsRaw  e.g. ["1" => 3, "2" => 0] — task number => max questions (0 = exclude)
     * @return array<string, int> normalized map task id string => max count
     */
    public static function normalizeCaps(?array $capsRaw): array
    {
        if ($capsRaw === null || $capsRaw === []) {
            return [];
        }
        $out = [];
        foreach ($capsRaw as $k => $v) {
            if (! is_numeric($k) || ! is_numeric($v)) {
                continue;
            }
            $taskNum = (int) $k;
            $max = (int) $v;
            if ($taskNum < 1) {
                continue;
            }
            $out[(string) $taskNum] = max(0, min($max, 500));
        }

        return $out;
    }

    /**
     * Merge site-wide defaults (per section + official task number) with a test’s {@see Test::$celpip_questions_per_task}.
     * Test keys override defaults. Section must match {@see CelpipOfficialTaskCatalog::TASKS_BY_SECTION}.
     *
     * @param  array<mixed, mixed>|null  $testCapsRaw  task number => max (0 = exclude)
     * @param  array<string, array<string|int, mixed>>|null  $siteDefaultsBySection  e.g. ['Listening' => ['1' => 2, '3' => 3]]
     * @return array<string, int>|null  map for {@see applyPerTaskCaps}; null = no caps
     */
    public static function mergeSiteDefaultsWithTestCaps(?array $testCapsRaw, ?string $sectionName, ?array $siteDefaultsBySection): ?array
    {
        $sectionName = trim((string) $sectionName);
        if ($sectionName === '' || ! isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName])) {
            return $testCapsRaw;
        }

        $merged = [];
        $sectionDefaults = [];
        if (is_array($siteDefaultsBySection) && isset($siteDefaultsBySection[$sectionName]) && is_array($siteDefaultsBySection[$sectionName])) {
            $sectionDefaults = $siteDefaultsBySection[$sectionName];
        }
        foreach (array_keys(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName]) as $taskNum) {
            $k = (string) $taskNum;
            if (! array_key_exists($k, $sectionDefaults) && ! array_key_exists($taskNum, $sectionDefaults)) {
                continue;
            }
            $v = $sectionDefaults[$k] ?? $sectionDefaults[$taskNum] ?? null;
            if ($v === null || ! is_numeric($v)) {
                continue;
            }
            $merged[$k] = max(0, min(500, (int) $v));
        }

        if (is_array($testCapsRaw)) {
            foreach ($testCapsRaw as $k => $v) {
                if (! is_numeric($k) || ! is_numeric($v)) {
                    continue;
                }
                $merged[(string) (int) $k] = max(0, min(500, (int) $v));
            }
        }

        return $merged === [] ? null : $merged;
    }

    /**
     * @param  Collection<int, Question>  $questionsOrdered
     * @param  array<mixed, mixed>|null  $capsRaw
     * @return Collection<int, Question>
     */
    public static function applyPerTaskCaps(Collection $questionsOrdered, ?array $capsRaw): Collection
    {
        $caps = self::normalizeCaps($capsRaw);
        if ($caps === []) {
            return $questionsOrdered->values();
        }

        $grouped = $questionsOrdered->groupBy(function (Question $q) {
            return $q->celpip_task_number !== null
                ? (string) (int) $q->celpip_task_number
                : '_ungrouped';
        });

        $taskKeys = $grouped->keys()->sort(function ($a, $b) {
            if ($a === '_ungrouped') {
                return 1;
            }
            if ($b === '_ungrouped') {
                return -1;
            }

            return (int) $a <=> (int) $b;
        })->values();

        $picked = collect();
        foreach ($taskKeys as $taskKey) {
            $group = $grouped->get($taskKey);
            if ($group === null) {
                continue;
            }
            $group = $group->values();
            if ($taskKey === '_ungrouped') {
                $picked = $picked->merge($group);

                continue;
            }
            $limit = $caps[$taskKey] ?? null;
            if ($limit === null) {
                $picked = $picked->merge($group);

                continue;
            }
            if ($limit === 0) {
                continue;
            }
            $picked = $picked->merge($group->shuffle()->take($limit));
        }

        return $picked->values();
    }
}
