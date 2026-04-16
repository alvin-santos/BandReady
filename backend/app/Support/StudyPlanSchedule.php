<?php

namespace App\Support;

use Carbon\Carbon;

final class StudyPlanSchedule
{
    public const MODES = ['everyday', 'weekdays', 'weekends', 'custom'];

    public static function firstStudyDate(Carbon $todayInTz): Carbon
    {
        return $todayInTz->copy()->addDay()->startOfDay();
    }

    /**
     * @param  list<int>|null  $customIso  Carbon dayOfWeekIso: 1 = Monday … 7 = Sunday
     */
    public static function countSessions(Carbon $examDateStart, Carbon $todayInTz, string $mode, ?array $customIso): int
    {
        $from = self::firstStudyDate($todayInTz);
        $to = $examDateStart->copy()->startOfDay();
        if ($from->gt($to)) {
            return 0;
        }

        $n = 0;
        for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
            $iso = (int) $d->dayOfWeekIso;
            if (self::isStudyDay($iso, $mode, $customIso)) {
                $n++;
            }
        }

        return $n;
    }

    /**
     * @param  list<int>|null  $customIso
     */
    public static function isStudyDay(int $dayOfWeekIso, string $mode, ?array $customIso): bool
    {
        return match ($mode) {
            'everyday' => true,
            'weekdays' => $dayOfWeekIso >= 1 && $dayOfWeekIso <= 5,
            'weekends' => $dayOfWeekIso === 6 || $dayOfWeekIso === 7,
            'custom' => in_array($dayOfWeekIso, $customIso ?? [], true),
            default => false,
        };
    }

    /**
     * @param  list<int|string>|null  $raw
     * @return list<int>
     */
    public static function normalizeCustomDays(?array $raw): array
    {
        if ($raw === null || $raw === []) {
            return [];
        }
        $out = [];
        foreach ($raw as $v) {
            $i = (int) $v;
            if ($i >= 1 && $i <= 7) {
                $out[$i] = $i;
            }
        }
        ksort($out);

        return array_values($out);
    }

    /**
     * @param  list<int>|null  $customIso
     */
    public static function describe(string $mode, ?array $customIso): string
    {
        return match ($mode) {
            'everyday' => 'Every calendar day from tomorrow through the exam date.',
            'weekdays' => 'Weekdays only (Monday–Friday); weekends are off.',
            'weekends' => 'Weekends only (Saturday and Sunday).',
            'custom' => 'Custom weekly rhythm: '.self::customDayListLabel($customIso ?? []),
            default => $mode,
        };
    }

    /**
     * @param  list<int>  $customIso
     */
    public static function customDayListLabel(array $customIso): string
    {
        if ($customIso === []) {
            return '(no days selected)';
        }

        return implode(', ', array_map(fn (int $d) => self::isoDayName($d), $customIso));
    }

    public static function isoDayName(int $iso): string
    {
        return match ($iso) {
            1 => 'Monday',
            2 => 'Tuesday',
            3 => 'Wednesday',
            4 => 'Thursday',
            5 => 'Friday',
            6 => 'Saturday',
            7 => 'Sunday',
            default => 'Day '.$iso,
        };
    }
}
