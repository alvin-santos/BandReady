<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Answer;
use App\Models\Attempt;
use App\Models\Exam;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $attempts = Attempt::query()
            ->where('user_id', $user->id)
            ->whereNotNull('completed_at')
            ->with(['test.exam', 'test.section'])
            ->orderByDesc('completed_at')
            ->limit(20)
            ->get();

        $avg = Attempt::query()
            ->where('user_id', $user->id)
            ->whereNotNull('completed_at')
            ->avg('score');

        $count = Attempt::query()
            ->where('user_id', $user->id)
            ->whereNotNull('completed_at')
            ->count();

        $sectionStats = $this->buildSectionStats($user->id);

        $reviewMistakes = $this->buildReviewMistakes($user->id);

        $readiness = $this->buildReadiness($user->id);

        return response()->json([
            'recent_attempts' => $attempts,
            'average_score' => $avg ? round((float) $avg, 2) : null,
            'completed_count' => $count,
            'section_stats' => $sectionStats['stats'],
            'weak_sections' => $sectionStats['weak'],
            'review_mistakes' => $reviewMistakes,
            'readiness' => $readiness,
        ]);
    }

    public function profileStats(Request $request)
    {
        return $this->summary($request);
    }

    private function buildSectionStats(int $userId): array
    {
        $rows = Attempt::query()
            ->where('user_id', $userId)
            ->whereNotNull('completed_at')
            ->whereNotNull('score')
            ->with(['test.exam', 'test.section'])
            ->get();

        $buckets = [];
        foreach ($rows as $a) {
            $test = $a->test;
            if (! $test || ! $test->section || ! $test->exam) {
                continue;
            }
            $key = $test->exam_id.'-'.$test->section_id;
            if (! isset($buckets[$key])) {
                $buckets[$key] = [
                    'exam_name' => $test->exam->name,
                    'section_name' => $test->section->name,
                    'scores' => [],
                    'last_completed_at' => null,
                ];
            }
            $buckets[$key]['scores'][] = (float) $a->score;
            $completed = $a->completed_at?->toIso8601String();
            if ($completed && ($buckets[$key]['last_completed_at'] === null || $completed > $buckets[$key]['last_completed_at'])) {
                $buckets[$key]['last_completed_at'] = $completed;
            }
        }

        $stats = [];
        foreach ($buckets as $b) {
            $n = count($b['scores']);
            $avg = $n ? round(array_sum($b['scores']) / $n, 2) : null;
            $stats[] = [
                'exam_name' => $b['exam_name'],
                'section_name' => $b['section_name'],
                'attempts_count' => $n,
                'avg_score' => $avg,
                'last_completed_at' => $b['last_completed_at'],
            ];
        }

        usort($stats, fn ($a, $b) => strcmp($a['exam_name'].' '.$a['section_name'], $b['exam_name'].' '.$b['section_name']));

        $weak = array_values(array_filter($stats, fn ($r) => $r['attempts_count'] >= 2));
        usort($weak, fn ($a, $b) => ($a['avg_score'] ?? 0) <=> ($b['avg_score'] ?? 0));
        $weak = array_slice($weak, 0, 5);

        return ['stats' => $stats, 'weak' => $weak];
    }

    private function buildReviewMistakes(int $userId): array
    {
        $answers = Answer::query()
            ->whereHas('attempt', function ($q) use ($userId) {
                $q->where('user_id', $userId)->whereNotNull('completed_at');
            })
            ->where('is_correct', false)
            ->with(['question', 'attempt.test.section', 'attempt.test.exam'])
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get();

        $out = [];
        foreach ($answers as $ans) {
            $attempt = $ans->attempt;
            $test = $attempt?->test;
            $q = $ans->question;
            if (! $q || ! $test) {
                continue;
            }
            $text = $q->question_text ?? '';
            $out[] = [
                'answer_id' => $ans->id,
                'attempt_id' => $attempt->id,
                'question_id' => $q->id,
                'question_excerpt' => Str::limit($text, 140),
                'explanation' => $q->explanation ? Str::limit((string) $q->explanation, 200) : null,
                'test_title' => $test->title,
                'section_name' => $test->section?->name,
                'exam_name' => $test->exam?->name,
                'completed_at' => $attempt->completed_at?->toIso8601String(),
            ];
        }

        return $out;
    }

    /**
     * Readiness aggregates completed, scored attempts by exam program (equal weight per program).
     * `section_readiness` applies the same rule per skill (Listening, Reading, …): mean per program, then mean across programs.
     * It is an approximate study indicator, not a prediction of official test results.
     */
    private function buildReadiness(int $userId): array
    {
        $examsTotal = Exam::query()->count();

        $rows = Attempt::query()
            ->where('user_id', $userId)
            ->whereNotNull('completed_at')
            ->whereNotNull('score')
            ->with(['test.exam', 'test.section'])
            ->get();

        $byExam = [];
        foreach ($rows as $a) {
            $exam = $a->test?->exam;
            if (! $exam) {
                continue;
            }
            $eid = $exam->id;
            if (! isset($byExam[$eid])) {
                $byExam[$eid] = [
                    'exam_id' => $eid,
                    'exam_code' => $exam->code,
                    'exam_name' => $exam->name,
                    'scores' => [],
                ];
            }
            $byExam[$eid]['scores'][] = (float) $a->score;
        }

        if ($byExam === []) {
            return [
                'overall_score' => null,
                'label' => null,
                'readiness_band' => null,
                'summary' => 'Complete at least one scored practice test to see your readiness across programs.',
                'per_exam' => [],
                'section_readiness' => [],
                'exams_covered' => 0,
                'exams_total' => $examsTotal,
                'coverage_percent' => 0,
            ];
        }

        $perExam = [];
        $examMeans = [];
        foreach ($byExam as $b) {
            $n = count($b['scores']);
            $mean = $n ? array_sum($b['scores']) / $n : 0.0;
            $mean = round($mean, 2);
            $examMeans[] = $mean;
            $perExam[] = [
                'exam_name' => $b['exam_name'],
                'exam_code' => $b['exam_code'],
                'avg_score' => $mean,
                'attempts_count' => $n,
            ];
        }

        usort($perExam, fn ($a, $b) => strcmp($a['exam_name'], $b['exam_name']));

        $overall = round(array_sum($examMeans) / count($examMeans), 2);
        $covered = count($byExam);
        $coveragePercent = $examsTotal > 0 ? round(100 * $covered / $examsTotal) : 0;

        $label = $this->readinessLabel($overall);
        $band = $this->readinessBandMeta($overall);
        $sectionReadiness = $this->buildSectionReadinessFromAttempts($rows);

        return [
            'overall_score' => $overall,
            'label' => $label,
            'readiness_band' => $band,
            'summary' => $this->readinessSummary($covered, $examsTotal),
            'per_exam' => $perExam,
            'section_readiness' => $sectionReadiness,
            'exams_covered' => $covered,
            'exams_total' => $examsTotal,
            'coverage_percent' => $coveragePercent,
        ];
    }

    /**
     * Per section skill (Listening, Reading, …): same rule as overall — for each section, average each
     * exam program’s scores in that section, then average those program means (equal weight per program).
     *
     * @param  \Illuminate\Support\Collection<int, \App\Models\Attempt>  $rows
     * @return list<array{
     *   section_name: string,
     *   overall_score: float,
     *   label: string,
     *   readiness_band: array{label: string, explanation: string},
     *   exams_covered: int,
     *   attempts_count: int
     * }>
     */
    private function buildSectionReadinessFromAttempts($rows): array
    {
        /** @var array<string, array<int, list<float>>> $bySectionThenExam section name => exam id => scores */
        $bySectionThenExam = [];
        foreach ($rows as $a) {
            $test = $a->test;
            $exam = $test?->exam;
            $section = $test?->section;
            if (! $exam || ! $section) {
                continue;
            }
            $sname = trim((string) $section->name);
            if ($sname === '') {
                continue;
            }
            $eid = $exam->id;
            if (! isset($bySectionThenExam[$sname])) {
                $bySectionThenExam[$sname] = [];
            }
            if (! isset($bySectionThenExam[$sname][$eid])) {
                $bySectionThenExam[$sname][$eid] = [];
            }
            $bySectionThenExam[$sname][$eid][] = (float) $a->score;
        }

        $out = [];
        foreach ($bySectionThenExam as $sectionName => $examBuckets) {
            $examMeans = [];
            $attemptsCount = 0;
            foreach ($examBuckets as $scores) {
                $n = count($scores);
                $attemptsCount += $n;
                $examMeans[] = $n ? array_sum($scores) / $n : 0.0;
            }
            $nExams = count($examMeans);
            $sectionScore = $nExams > 0 ? round(array_sum($examMeans) / $nExams, 2) : 0.0;
            $out[] = [
                'section_name' => $sectionName,
                'overall_score' => $sectionScore,
                'label' => $this->readinessLabel($sectionScore),
                'readiness_band' => $this->readinessBandMeta($sectionScore),
                'exams_covered' => $nExams,
                'attempts_count' => $attemptsCount,
            ];
        }

        usort($out, function ($a, $b) {
            $cmp = $this->sectionKindOrder($a['section_name']) <=> $this->sectionKindOrder($b['section_name']);
            if ($cmp !== 0) {
                return $cmp;
            }

            return strcmp($a['section_name'], $b['section_name']);
        });

        return $out;
    }

    /** Stable ordering for typical exam sections (Listening → Reading → Writing → Speaking). */
    private function sectionKindOrder(string $name): int
    {
        $n = strtolower($name);
        if (str_contains($n, 'listen')) {
            return 1;
        }
        if (str_contains($n, 'read')) {
            return 2;
        }
        if (str_contains($n, 'writ')) {
            return 3;
        }
        if (str_contains($n, 'speak')) {
            return 4;
        }

        return 50;
    }

    /**
     * Decile band (0–10%, 10–20%, … 90–100%) with a static explanation for the dashboard.
     *
     * @return array{label: string, explanation: string}
     */
    private function readinessBandMeta(float $score): array
    {
        $s = max(0.0, min(100.0, $score));
        $idx = (int) floor($s / 10);
        if ($idx > 9) {
            $idx = 9;
        }

        $bands = [
            [
                'label' => '0–10%',
                'explanation' => 'You are at the start of your practice journey. Focus on learning the interface, timing, and question types in one section at a time.',
            ],
            [
                'label' => '10–20%',
                'explanation' => 'Early exposure is in place. Keep repeating timed sets to build stamina and reduce surprises on unfamiliar tasks.',
            ],
            [
                'label' => '20–30%',
                'explanation' => 'Patterns are beginning to stick. Shore up weaker skills and review explanations for items you miss.',
            ],
            [
                'label' => '30–40%',
                'explanation' => 'You are moving past basics. Aim for consistent routines—same time limits, fewer pauses—and track recurring mistake types.',
            ],
            [
                'label' => '40–50%',
                'explanation' => 'Mid-range performance: good foundation. Balance new material with targeted drills on your lowest sections.',
            ],
            [
                'label' => '50–60%',
                'explanation' => 'Skills are taking shape. Simulate longer sessions and mix sections so practice feels closer to test day.',
            ],
            [
                'label' => '60–70%',
                'explanation' => 'Solid progress. Refine accuracy under pressure and tighten time use on tasks that still feel slow.',
            ],
            [
                'label' => '70–80%',
                'explanation' => 'Strong trajectory. Focus on fine details—precision, proofreading, and stamina across a full mock when you can.',
            ],
            [
                'label' => '80–90%',
                'explanation' => 'High practice performance in BandReady. Keep variety in topics and formats so skills stay flexible.',
            ],
            [
                'label' => '90–100%',
                'explanation' => 'Very strong practice scores. Maintain with occasional full mocks and light review; remember this is still an approximate app metric, not a guarantee on test day.',
            ],
        ];

        return $bands[$idx];
    }

    private function readinessLabel(float $score): string
    {
        if ($score < 40) {
            return 'Getting started';
        }
        if ($score < 65) {
            return 'Building skills';
        }
        if ($score < 80) {
            return 'Strong progress';
        }

        return 'High readiness (practice)';
    }

    private function readinessSummary(int $covered, int $examsTotal): string
    {
        if ($examsTotal < 1) {
            return 'Keep practicing to refine your readiness.';
        }

        $base = 'Readiness averages your approximate scores across each exam program you have tried (equal weight per program).';

        if ($covered < $examsTotal) {
            return $base.sprintf(' You have tried %d of %d programs — add more for a fuller picture.', $covered, $examsTotal);
        }

        return $base.' You have practice data for every program in BandReady.';
    }
}
