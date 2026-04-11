<?php

namespace App\Services;

use App\Models\Statistic;
use Carbon\Carbon;

class StatisticsRecorder
{
    public static function incrementMetric(string $metric, float $delta = 1, ?string $date = null): void
    {
        $d = $date ? Carbon::parse($date)->toDateString() : now()->toDateString();
        $row = Statistic::query()->firstOrNew(['metric' => $metric, 'date' => $d]);
        $row->value = (float) $row->value + $delta;
        $row->save();
    }

    public static function recordAttempt(float $score, bool $completed): void
    {
        $today = now()->toDateString();
        self::incrementMetric('attempts', 1, $today);
        if ($completed) {
            self::incrementMetric('completions', 1, $today);
        }
        $row = Statistic::query()->firstOrNew(['metric' => 'score_sum', 'date' => $today]);
        $row->value = (float) $row->value + $score;
        $row->save();
    }
}
