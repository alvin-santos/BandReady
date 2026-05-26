<?php

namespace App\Support;

use App\Models\Question;
use App\Models\Test;
use Illuminate\Support\Collection;

/**
 * Questions for an attempt: all items in the same skill section (Listening, Reading, etc.)
 * across exam programs, not only the selected test's bank.
 */
final class SectionQuestionPool
{
    /**
     * @return Collection<int, Question>
     */
    public static function forTest(Test $test): Collection
    {
        $test->loadMissing('section');
        $sectionName = trim((string) ($test->section?->name ?? ''));
        if ($sectionName === '') {
            return $test->questions()->orderBy('order')->get();
        }

        return Question::query()
            ->whereHas('test', function ($q) use ($test, $sectionName) {
                $q->where('is_available', true)
                    ->where('practice_mode', $test->practice_mode)
                    ->whereHas('section', fn ($s) => $s->where('name', $sectionName));
            })
            ->orderBy('test_id')
            ->orderBy('order')
            ->get();
    }
}
