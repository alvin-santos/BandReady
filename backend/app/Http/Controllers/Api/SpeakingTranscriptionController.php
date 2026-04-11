<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attempt;
use App\Models\Question;
use App\Models\User;
use App\Services\OpenAiSpeechToTextService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SpeakingTranscriptionController extends Controller
{
    public function transcribe(Request $request, OpenAiSpeechToTextService $speechToText)
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json(['message' => 'Sign in required for speaking transcription.', 'code' => 'auth_required'], 403);
        }

        $data = $request->validate([
            'attempt_id' => 'required|exists:attempts,id',
            'question_id' => 'required|exists:questions,id',
            'audio' => 'required|file|max:25600',
        ]);

        $attempt = Attempt::query()->findOrFail($data['attempt_id']);
        $this->authorizeAttempt($request, $attempt);

        if ($attempt->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($attempt->completed_at) {
            return response()->json(['message' => 'Attempt already submitted'], 422);
        }

        $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order')]);
        $allowedIds = $attempt->questionsInAttemptOrder()->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (! in_array((int) $data['question_id'], $allowedIds, true)) {
            return response()->json(['message' => 'This question is not part of this attempt.'], 422);
        }

        $question = Question::query()->findOrFail($data['question_id']);
        if ($question->type !== 'speaking_prompt') {
            return response()->json(['message' => 'This question is not a speaking task.'], 422);
        }

        $file = $request->file('audio');
        if ($file === null) {
            return response()->json(['message' => 'Audio file missing.'], 422);
        }

        $contextRef = 'attempt:'.$attempt->id.',q:'.$question->id;
        $transcript = $speechToText->transcribe($file, $user->id, $contextRef);

        $max = (int) config('openai.speaking_max_chars', 4000);
        if (Str::length($transcript) > $max) {
            $transcript = mb_substr($transcript, 0, $max);
        }

        return response()->json([
            'transcript' => $transcript,
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
