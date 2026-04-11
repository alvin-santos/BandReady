<?php

namespace App\Services;

use App\Models\Question;

class QuestionGrader
{
    public static function grade(Question $question, ?string $answer): ?bool
    {
        if ($answer === null || $answer === '') {
            return false;
        }

        $correct = $question->correct_answer;

        return match ($question->type) {
            'multiple_choice', 'true_false' => self::normalize($answer) === self::normalize((string) $correct),
            'fill_blank' => strcasecmp(trim($answer), trim((string) $correct)) === 0,
            'checkbox_multi' => self::sameJsonArrays($answer, (string) $correct),
            'essay', 'speaking_prompt' => null,
            default => self::normalize($answer) === self::normalize((string) $correct),
        };
    }

    public static function estimateSubjectivePoints(Question $question, ?string $answer): float
    {
        if (! in_array($question->type, ['essay', 'speaking_prompt'], true)) {
            return 0.0;
        }
        $len = strlen(trim((string) $answer));
        if ($len < 20) {
            return 0.0;
        }
        if ($len < 80) {
            return 0.4;
        }

        return 0.7;
    }

    /**
     * Map AI essay feedback (0–100 overall) to a 0–1 weight for the attempt score.
     *
     * @param  array{overall_score_0_100?: int|float}  $feedback
     */
    public static function subjectivePointsFromWritingAi(array $feedback): float
    {
        $overall = isset($feedback['overall_score_0_100']) ? (float) $feedback['overall_score_0_100'] : 0.0;
        $overall = max(0.0, min(100.0, $overall));

        return round($overall / 100.0, 4);
    }

    private static function normalize(string $s): string
    {
        return strtolower(trim($s));
    }

    private static function sameJsonArrays(string $answer, string $correct): bool
    {
        $a = json_decode($answer, true);
        $b = json_decode($correct, true);
        if (! is_array($a) || ! is_array($b)) {
            return false;
        }
        sort($a);
        sort($b);

        return $a === $b;
    }
}
