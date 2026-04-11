<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attempt;
use App\Models\Question;
use App\Models\User;
use App\Services\OpenAiIeltsSpeakingConversationService;
use App\Services\OpenAiSpeakingModerationService;
use App\Services\SpeakingAiSuspensionService;
use App\Support\IeltsAiSpeaking;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class IeltsSpeakingAiController extends Controller
{
    public function start(Request $request, OpenAiIeltsSpeakingConversationService $ai)
    {
        $user = $this->requireAuthenticatedUser($request);

        $data = $request->validate([
            'attempt_id' => 'required|exists:attempts,id',
            'question_id' => 'required|exists:questions,id',
        ]);

        $attempt = Attempt::query()->findOrFail($data['attempt_id']);
        $this->authorizeAttempt($request, $attempt);
        $this->assertAttemptUser($attempt, $user);

        if ($attempt->completed_at) {
            return response()->json(['message' => 'Attempt already submitted'], 422);
        }

        $question = Question::query()->findOrFail($data['question_id']);
        $this->assertAiSpeakingQuestion($attempt, $question);

        $this->assertSpeakingAiNotSuspended($user);

        $out = $ai->nextTurn([], null, $user->id, 'attempt:'.$attempt->id.',q:'.$question->id);

        return response()->json($out);
    }

    public function step(Request $request, OpenAiIeltsSpeakingConversationService $ai)
    {
        $user = $this->requireAuthenticatedUser($request);

        $data = $request->validate([
            'attempt_id' => 'required|exists:attempts,id',
            'question_id' => 'required|exists:questions,id',
            'exchanges' => 'required|array|max:80',
            'exchanges.*.role' => 'required|string|in:examiner,candidate',
            'exchanges.*.text' => 'required|string|max:6000',
        ]);

        $attempt = Attempt::query()->findOrFail($data['attempt_id']);
        $this->authorizeAttempt($request, $attempt);
        $this->assertAttemptUser($attempt, $user);

        if ($attempt->completed_at) {
            return response()->json(['message' => 'Attempt already submitted'], 422);
        }

        $question = Question::query()->findOrFail($data['question_id']);
        $this->assertAiSpeakingQuestion($attempt, $question);

        $this->assertSpeakingAiNotSuspended($user);

        $full = $this->normalizeExchanges($data['exchanges']);
        if ($full === []) {
            throw ValidationException::withMessages([
                'exchanges' => ['Send the conversation from /start before calling step.'],
            ]);
        }

        $last = $full[count($full) - 1];
        if (($last['role'] ?? '') !== 'candidate') {
            throw ValidationException::withMessages([
                'exchanges' => ['The last entry must be the candidate (your latest transcript or prep marker).'],
            ]);
        }

        $latest = (string) ($last['text'] ?? '');
        $prior = array_slice($full, 0, -1);
        if ($prior === [] || ($prior[count($prior) - 1]['role'] ?? '') !== 'examiner') {
            throw ValidationException::withMessages([
                'exchanges' => ['Each candidate reply must follow an examiner turn. Call /start first.'],
            ]);
        }

        $contextRef = 'attempt:'.$attempt->id.',q:'.$question->id;
        if (! $user->isAdmin()) {
            $mod = app(OpenAiSpeakingModerationService::class)->screenCandidateText($latest, $user->id, $contextRef);
            if (($mod['violation'] ?? false) === true) {
                app(SpeakingAiSuspensionService::class)->suspendForContentPolicy($user);
                $user->refresh();

                throw new HttpResponseException($this->speakingSuspendedJsonResponse($user));
            }
        }

        $out = $ai->nextTurn($prior, $latest, $user->id, $contextRef);

        return response()->json($out);
    }

    private function requireAuthenticatedUser(Request $request): User
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');
        if (! $user) {
            throw new HttpResponseException(response()->json(['message' => 'Sign in required.', 'code' => 'auth_required'], 403));
        }

        return $user;
    }

    private function assertAttemptUser(Attempt $attempt, User $user): void
    {
        if ((int) $attempt->user_id !== (int) $user->id) {
            abort(403, 'Unauthorized');
        }
    }

    private function assertAiSpeakingQuestion(Attempt $attempt, Question $question): void
    {
        if (! IeltsAiSpeaking::isAiConversationQuestion($question)) {
            abort(422, 'This question is not an IELTS AI conversation speaking task.');
        }

        $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order')]);
        $allowedIds = $attempt->questionsInAttemptOrder()->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (! in_array((int) $question->id, $allowedIds, true)) {
            abort(422, 'This question is not part of this attempt.');
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $raw
     * @return list<array{role: string, text: string}>
     */
    private function normalizeExchanges(array $raw): array
    {
        $out = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            $role = (string) ($row['role'] ?? '');
            $text = trim((string) ($row['text'] ?? ''));
            if ($text === '') {
                continue;
            }
            if (! in_array($role, ['examiner', 'candidate'], true)) {
                continue;
            }
            $out[] = ['role' => $role, 'text' => $text];
        }

        return $out;
    }

    private function assertSpeakingAiNotSuspended(User $user): void
    {
        if ($user->isAdmin()) {
            return;
        }
        if (app(SpeakingAiSuspensionService::class)->isSuspended($user)) {
            throw new HttpResponseException($this->speakingSuspendedJsonResponse($user));
        }
    }

    private function speakingSuspendedJsonResponse(User $user): JsonResponse
    {
        $notice = trim((string) ($user->speaking_ai_suspension_notice ?? ''));
        if ($notice === '') {
            $notice = (string) config(
                'exam_access.speaking_ai_suspension_notice',
                'Speaking practice was disabled on your account because inappropriate or abusive language was detected.'
            );
        }

        return response()->json([
            'message' => $notice,
            'code' => 'speaking_ai_suspended',
            'speaking_ai_suspension_notice' => $notice,
        ], 403);
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
