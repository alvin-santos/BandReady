<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Answer;
use App\Models\Attempt;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MistakesHubController extends Controller
{
    /**
     * Mistakes queue (oldest wrong answers first per unique question), weak sections, and quick stats.
     */
    public function show(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $userId = $user->id;

        $weakSections = $this->buildWeakSections($userId);

        $totalWrong = Answer::query()
            ->whereHas('attempt', function ($q) use ($userId) {
                $q->where('user_id', $userId)->whereNotNull('completed_at');
            })
            ->where('is_correct', false)
            ->count();

        $answers = Answer::query()
            ->whereHas('attempt', function ($q) use ($userId) {
                $q->where('user_id', $userId)->whereNotNull('completed_at');
            })
            ->where('is_correct', false)
            ->with(['question', 'attempt.test.exam', 'attempt.test.section'])
            ->join('attempts', 'answers.attempt_id', '=', 'attempts.id')
            ->orderBy('attempts.completed_at', 'asc')
            ->select('answers.*')
            ->get();

        $seenQuestionIds = [];
        $queue = [];
        $bySection = [];

        foreach ($answers as $ans) {
            $q = $ans->question;
            $attempt = $ans->attempt;
            $test = $attempt?->test;
            if (! $q || ! $test) {
                continue;
            }
            $qid = (int) $q->id;
            if (isset($seenQuestionIds[$qid])) {
                continue;
            }
            $seenQuestionIds[$qid] = true;

            $section = $test->section?->name ?? 'Section';
            $bySection[$section] = ($bySection[$section] ?? 0) + 1;

            $text = $q->question_text ?? '';
            $queue[] = [
                'question_id' => $qid,
                'answer_id' => $ans->id,
                'attempt_id' => $attempt->id,
                'question_type' => $q->type,
                'exam_code' => $test->exam?->code,
                'exam_name' => $test->exam?->name,
                'section_name' => $section,
                'test_title' => $test->title,
                'test_id' => $test->id,
                'question_excerpt' => Str::limit($text, 160),
                'explanation' => $q->explanation ? Str::limit((string) $q->explanation, 220) : null,
                'completed_at' => $attempt->completed_at?->toIso8601String(),
            ];

            if (count($queue) >= 50) {
                break;
            }
        }

        return response()->json([
            'weak_sections' => $weakSections,
            'queue' => $queue,
            'stats' => [
                'queued_mistakes' => count($queue),
                'by_section' => $bySection,
                'total_wrong_answers' => $totalWrong,
            ],
            'tips' => [
                'Open a result to see the full question, your answer, and explanation.',
                'Section links jump to exam selection filtered by program — pick a matching practice test.',
                'Revisit oldest items first: the queue is ordered by when you missed each question.',
            ],
        ]);
    }

    /**
     * @return list<array{exam_name: string, section_name: string, avg_score: float|null, attempts_count: int}>
     */
    private function buildWeakSections(int $userId): array
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
                    'exam_code' => $test->exam->code,
                    'scores' => [],
                ];
            }
            $buckets[$key]['scores'][] = (float) $a->score;
        }

        $weak = [];
        foreach ($buckets as $b) {
            $n = count($b['scores']);
            if ($n < 2) {
                continue;
            }
            $avg = round(array_sum($b['scores']) / $n, 2);
            $weak[] = [
                'exam_name' => $b['exam_name'],
                'exam_code' => $b['exam_code'],
                'section_name' => $b['section_name'],
                'avg_score' => $avg,
                'attempts_count' => $n,
            ];
        }

        usort($weak, fn ($a, $b) => ($a['avg_score'] ?? 0) <=> ($b['avg_score'] ?? 0));

        return array_slice($weak, 0, 8);
    }
}
