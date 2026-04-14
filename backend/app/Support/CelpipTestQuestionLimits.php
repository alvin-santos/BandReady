<?php

namespace App\Support;

use App\Models\Question;
use App\Models\Test;
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
