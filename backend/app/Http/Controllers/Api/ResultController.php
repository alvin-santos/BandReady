<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attempt;
use App\Models\Question;
use Illuminate\Http\Request;

class ResultController extends Controller
{
    public function show(Request $request, int $id)
    {
        $attempt = Attempt::query()
            ->with(['test.exam', 'test.section', 'test.questions' => fn ($q) => $q->orderBy('order'), 'answers'])
            ->findOrFail($id);

        $this->authorizeAttempt($request, $attempt);

        $byQuestion = $attempt->answers->keyBy('question_id');
        $details = [];

        foreach ($attempt->questionsInAttemptOrder() as $question) {
            $ans = $byQuestion->get($question->id);
            $details[] = [
                'question' => $question,
                'your_answer' => $ans?->answer,
                'correct_answer' => $question->correct_answer,
                'is_correct' => $ans?->is_correct,
                'explanation' => $question->explanation,
                'is_flagged' => (bool) $ans?->is_flagged,
                'writing_feedback' => $ans?->writing_feedback,
                'speaking_feedback' => $ans?->speaking_feedback,
            ];
        }

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'score' => $attempt->score,
                'time_spent_seconds' => $attempt->time_spent_seconds,
                'started_at' => $attempt->started_at,
                'completed_at' => $attempt->completed_at,
            ],
            'test' => [
                'id' => $attempt->test->id,
                'title' => $attempt->test->title,
                'exam' => $attempt->test->exam,
                'section' => $attempt->test->section,
            ],
            'details' => $details,
        ]);
    }

    private function authorizeAttempt(Request $request, Attempt $attempt): void
    {
        $user = $request->user('sanctum');
        if ($user && $attempt->user_id === $user->id) {
            return;
        }
        if (! $user && $attempt->guest_session) {
            $guest = $request->header('X-Guest-Session') ?? $request->input('guest_session');
            if ($guest && (string) $guest === (string) $attempt->guest_session) {
                return;
            }
        }
        abort(403, 'Unauthorized');
    }
}
