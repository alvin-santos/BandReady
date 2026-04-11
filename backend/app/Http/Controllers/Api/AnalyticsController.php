<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Answer;
use App\Models\Attempt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $userId = $user->id;

        $attempts = Attempt::query()
            ->where('user_id', $userId)
            ->whereNotNull('completed_at')
            ->whereNotNull('score')
            ->with(['test.section', 'test.exam'])
            ->orderBy('completed_at')
            ->get();

        $totalAnswers = Answer::query()
            ->whereHas('attempt', function ($q) use ($userId) {
                $q->where('user_id', $userId)->whereNotNull('completed_at');
            })
            ->count();

        $answersBySectionName = DB::table('answers')
            ->join('attempts', 'answers.attempt_id', '=', 'attempts.id')
            ->join('questions', 'answers.question_id', '=', 'questions.id')
            ->join('tests', 'questions.test_id', '=', 'tests.id')
            ->join('sections', 'tests.section_id', '=', 'sections.id')
            ->where('attempts.user_id', $userId)
            ->whereNotNull('attempts.completed_at')
            ->selectRaw('sections.name as section_name, COUNT(*) as c')
            ->groupBy('sections.name')
            ->pluck('c', 'section_name');

        if ($attempts->isEmpty()) {
            return response()->json([
                'summary' => [
                    'completed_attempts' => 0,
                    'answers_recorded' => (int) $totalAnswers,
                    'first_activity' => null,
                    'last_activity' => null,
                ],
                'daily' => [],
                'charts' => [
                    'labels' => [],
                    'overall_avg_by_day' => [],
                    'attempts_by_day' => [],
                    'section_avg_by_day' => [],
                ],
                'section_totals' => [],
            ]);
        }

        $tz = config('app.timezone', 'UTC');

        /** @var array<string, array{attempts: int, score_sum: float, sections: array<string, array{sum: float, count: int}>}> $dayBuckets */
        $dayBuckets = [];

        /** @var array<string, array{attempts: int, score_sum: float}> $sectionTotals */
        $sectionTotals = [];

        foreach ($attempts as $a) {
            $completed = $a->completed_at;
            if ($completed === null) {
                continue;
            }
            $day = $completed->timezone($tz)->toDateString();
            $sk = $this->sectionKey($a->test?->section?->name);
            $label = $this->sectionLabel($sk, $a->test?->section?->name);

            if (! isset($dayBuckets[$day])) {
                $dayBuckets[$day] = [
                    'attempts' => 0,
                    'score_sum' => 0.0,
                    'sections' => [],
                ];
            }
            $dayBuckets[$day]['attempts']++;
            $dayBuckets[$day]['score_sum'] += (float) $a->score;

            if (! isset($dayBuckets[$day]['sections'][$sk])) {
                $dayBuckets[$day]['sections'][$sk] = [
                    'label' => $label,
                    'sum' => 0.0,
                    'count' => 0,
                ];
            }
            $dayBuckets[$day]['sections'][$sk]['sum'] += (float) $a->score;
            $dayBuckets[$day]['sections'][$sk]['count']++;

            if (! isset($sectionTotals[$sk])) {
                $sectionTotals[$sk] = [
                    'key' => $sk,
                    'label' => $label,
                    'attempts' => 0,
                    'score_sum' => 0.0,
                ];
            }
            $sectionTotals[$sk]['attempts']++;
            $sectionTotals[$sk]['score_sum'] += (float) $a->score;
        }

        ksort($dayBuckets);

        $daily = [];
        $labels = [];
        $overallAvgByDay = [];
        $attemptsByDay = [];
        $sectionKeys = ['listening', 'reading', 'writing', 'speaking', 'other'];

        $sectionAvgByDay = [];
        foreach ($sectionKeys as $sk) {
            $sectionAvgByDay[$sk] = [];
        }

        foreach ($dayBuckets as $day => $bucket) {
            $labels[] = $day;
            $n = $bucket['attempts'];
            $overallAvgByDay[] = $n > 0 ? round($bucket['score_sum'] / $n, 2) : null;
            $attemptsByDay[] = $n;

            $row = [
                'date' => $day,
                'attempts' => $n,
                'avg_score' => $n > 0 ? round($bucket['score_sum'] / $n, 2) : null,
                'sections' => [],
            ];

            foreach ($sectionKeys as $sk) {
                $sec = $bucket['sections'][$sk] ?? null;
                $avg = null;
                if ($sec !== null && $sec['count'] > 0) {
                    $avg = round($sec['sum'] / $sec['count'], 2);
                    $row['sections'][$sk] = [
                        'attempts' => $sec['count'],
                        'avg_score' => $avg,
                        'label' => $sec['label'],
                    ];
                } else {
                    $sectionAvgByDay[$sk][] = null;
                    continue;
                }
                $sectionAvgByDay[$sk][] = $avg;
            }

            $daily[] = $row;
        }

        // Align section series length with labels (fill missing trailing alignment)
        $labelCount = count($labels);
        foreach ($sectionKeys as $sk) {
            while (count($sectionAvgByDay[$sk]) < $labelCount) {
                $sectionAvgByDay[$sk][] = null;
            }
        }

        $sectionTotalsOut = [];
        foreach ($sectionTotals as $sk => $st) {
            $avg = $st['attempts'] > 0 ? round($st['score_sum'] / $st['attempts'], 2) : null;
            $answers = 0;
            foreach ($answersBySectionName as $secName => $c) {
                if ($this->sectionKey($secName) === $sk) {
                    $answers += (int) $c;
                }
            }
            $sectionTotalsOut[] = [
                'key' => $sk,
                'label' => $st['label'],
                'attempts' => $st['attempts'],
                'avg_score' => $avg,
                'answers_recorded' => $answers,
            ];
        }
        usort($sectionTotalsOut, fn ($a, $b) => strcmp($a['label'], $b['label']));

        $first = $attempts->first()?->completed_at?->timezone($tz)->toDateString();
        $last = $attempts->last()?->completed_at?->timezone($tz)->toDateString();

        return response()->json([
            'summary' => [
                'completed_attempts' => $attempts->count(),
                'answers_recorded' => (int) $totalAnswers,
                'first_activity' => $first,
                'last_activity' => $last,
            ],
            'daily' => $daily,
            'charts' => [
                'labels' => $labels,
                'overall_avg_by_day' => $overallAvgByDay,
                'attempts_by_day' => $attemptsByDay,
                'section_avg_by_day' => $sectionAvgByDay,
            ],
            'section_totals' => $sectionTotalsOut,
        ]);
    }

    private function sectionKey(?string $name): string
    {
        if ($name === null || trim($name) === '') {
            return 'other';
        }
        $n = strtolower(trim($name));
        if (str_contains($n, 'listen')) {
            return 'listening';
        }
        if (str_contains($n, 'read')) {
            return 'reading';
        }
        if (str_contains($n, 'writ')) {
            return 'writing';
        }
        if (str_contains($n, 'speak')) {
            return 'speaking';
        }

        return 'other';
    }

    private function sectionLabel(string $key, ?string $originalName): string
    {
        return match ($key) {
            'listening' => 'Listening',
            'reading' => 'Reading',
            'writing' => 'Writing',
            'speaking' => 'Speaking',
            default => $originalName && trim($originalName) !== '' ? trim($originalName) : 'Other',
        };
    }
}
