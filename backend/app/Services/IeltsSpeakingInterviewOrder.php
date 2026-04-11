<?php

namespace App\Services;

use App\Models\Question;
use App\Models\Test;
use App\Support\IeltsAiSpeaking;
use Illuminate\Support\Collection;

/**
 * Builds per-attempt question order for IELTS-style scripted speaking: fixed intro, random Part 1 pool,
 * fixed Part 2, random Part 3 pool. Questions opt in via options_json.ielts_speaking.phase.
 */
final class IeltsSpeakingInterviewOrder
{
    public static function appliesToTest(Test $test): bool
    {
        $test->loadMissing(['section', 'exam']);
        if (! $test->section || strcasecmp((string) $test->section->name, 'Speaking') !== 0) {
            return false;
        }
        $code = strtolower((string) ($test->exam?->code ?? ''));

        return str_starts_with($code, 'ielts_');
    }

    /**
     * @param  Collection<int, Question>  $questionsOrdered
     * @return list<int>|null  null = use default shuffle / cap behaviour
     */
    public static function orderedQuestionIds(Test $test, Collection $questionsOrdered): ?array
    {
        if (! self::appliesToTest($test)) {
            return null;
        }

        $tagged = $questionsOrdered->filter(function (Question $q) {
            $o = $q->options_json;

            return is_array($o) && isset($o['ielts_speaking']) && is_array($o['ielts_speaking']);
        });

        if ($tagged->isEmpty()) {
            return null;
        }

        if ($questionsOrdered->contains(fn (Question $q) => IeltsAiSpeaking::isAiConversationQuestion($q))) {
            return $questionsOrdered
                ->filter(function (Question $q) {
                    if (IeltsAiSpeaking::isAiConversationQuestion($q)) {
                        return true;
                    }
                    $o = $q->options_json;

                    return ! (is_array($o) && isset($o['ielts_speaking']));
                })
                ->sortBy('order')
                ->pluck('id')
                ->values()
                ->all();
        }

        $picks = $test->ielts_speaking_picks;
        $part1Target = is_array($picks) ? (int) ($picks['part1_pool'] ?? 3) : 3;
        $part3Target = is_array($picks) ? (int) ($picks['part3_pool'] ?? 2) : 2;
        $part1Target = max(0, $part1Target);
        $part3Target = max(0, $part3Target);

        $phase = static function (Question $q): string {
            $o = $q->options_json;

            return is_array($o) && isset($o['ielts_speaking']['phase'])
                ? (string) $o['ielts_speaking']['phase']
                : '';
        };

        $intro = $questionsOrdered
            ->filter(fn (Question $q) => $phase($q) === 'intro')
            ->sortBy('order')
            ->pluck('id')
            ->all();

        $part1Pool = $questionsOrdered
            ->filter(fn (Question $q) => $phase($q) === 'part1_pool')
            ->pluck('id')
            ->shuffle()
            ->values()
            ->all();
        $part1 = array_slice($part1Pool, 0, min($part1Target, count($part1Pool)));

        $part2 = $questionsOrdered
            ->filter(fn (Question $q) => $phase($q) === 'part2')
            ->sortBy('order')
            ->pluck('id')
            ->all();

        $part3Pool = $questionsOrdered
            ->filter(fn (Question $q) => $phase($q) === 'part3_pool')
            ->pluck('id')
            ->shuffle()
            ->values()
            ->all();
        $part3 = array_slice($part3Pool, 0, min($part3Target, count($part3Pool)));

        $ordered = array_merge($intro, $part1, $part2, $part3);

        $taggedIds = $tagged->pluck('id')->all();
        $untagged = $questionsOrdered
            ->filter(fn (Question $q) => ! in_array($q->id, $taggedIds, true))
            ->sortBy('order')
            ->pluck('id')
            ->all();

        $ids = array_values(array_merge($ordered, $untagged));

        if ($ids === [] && $questionsOrdered->isNotEmpty()) {
            return null;
        }

        return $ids;
    }
}
