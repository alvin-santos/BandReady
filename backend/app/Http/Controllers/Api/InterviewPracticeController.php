<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewPracticeMessage;
use App\Models\InterviewPracticeSession;
use App\Models\User;
use App\Services\OpenAiInterviewPracticeFeedbackService;
use App\Services\OpenAiInterviewPracticeService;
use App\Services\OpenAiSpeechToTextService;
use App\Services\OpenAiSpeakingModerationService;
use App\Services\SpeakingAiSuspensionService;
use App\Support\InterviewPracticePrompts;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class InterviewPracticeController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user = $this->requireVerifiedUser($request);
        $limits = $this->limitsFor($user);
        $today = Carbon::today();
        $sessionsToday = InterviewPracticeSession::query()
            ->where('user_id', $user->id)
            ->whereDate('started_at', $today)
            ->count();
        $cap = (int) $limits['sessions_per_day'];
        $canStart = $sessionsToday < $cap;

        return response()->json([
            'is_subscribed' => $user->isSubscribed(),
            'limits' => $limits,
            'sessions_today' => $sessionsToday,
            'sessions_remaining_today' => max(0, $cap - $sessionsToday),
            'can_start' => $canStart,
        ]);
    }

    public function start(Request $request, OpenAiInterviewPracticeService $ai): JsonResponse
    {
        $user = $this->requireVerifiedUser($request);
        $this->assertSpeakingAiNotSuspended($user);

        $types = config('interview_practice.interview_types', []);
        $diffs = config('interview_practice.difficulties', []);

        $data = $request->validate([
            'interview_type' => 'required|string|in:'.implode(',', $types),
            'difficulty' => 'required|string|in:'.implode(',', $diffs),
            'custom_role' => 'nullable|string|max:'.(int) config('interview_practice.max_custom_role_chars', 200),
        ]);

        if ($data['interview_type'] === 'custom_role') {
            $role = trim((string) ($data['custom_role'] ?? ''));
            if ($role === '') {
                throw ValidationException::withMessages([
                    'custom_role' => ['Enter a job role for custom practice.'],
                ]);
            }
        }

        $limits = $this->limitsFor($user);
        $today = Carbon::today();
        $sessionsToday = InterviewPracticeSession::query()
            ->where('user_id', $user->id)
            ->whereDate('started_at', $today)
            ->count();
        if ($sessionsToday >= (int) $limits['sessions_per_day']) {
            return response()->json([
                'message' => $user->isSubscribed()
                    ? 'You have reached today’s interview practice session limit.'
                    : 'Free accounts get one AI interview practice session per day. Upgrade to BandReady Pro for more.',
                'code' => 'daily_limit',
            ], 422);
        }

        try {
            $session = DB::transaction(function () use ($user, $data, $limits) {
                InterviewPracticeSession::query()
                    ->where('user_id', $user->id)
                    ->where('status', 'active')
                    ->update([
                        'status' => 'superseded',
                        'ended_at' => now(),
                    ]);

                return InterviewPracticeSession::query()->create([
                    'user_id' => $user->id,
                    'interview_type' => $data['interview_type'],
                    'difficulty' => $data['difficulty'],
                    'custom_role' => $data['interview_type'] === 'custom_role'
                        ? trim((string) ($data['custom_role'] ?? ''))
                        : null,
                    'status' => 'active',
                    'started_at' => now(),
                    'max_duration_seconds' => (int) $limits['max_duration_seconds'],
                    'max_turns' => (int) $limits['max_turns'],
                    'user_turns' => 0,
                    'empty_streak' => 0,
                    'last_ai_at' => null,
                ]);
            });
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => 'Could not start session. Try again.'], 500);
        }

        try {
            $out = $ai->opening($session);
        } catch (Throwable $e) {
            $session->update(['status' => 'stopped_user', 'ended_at' => now()]);

            return response()->json(['message' => 'Interview AI is unavailable. Try again shortly.'], 503);
        }

        $text = $out['message'];
        $session->refresh();
        DB::transaction(function () use ($session, $text) {
            InterviewPracticeMessage::query()->create([
                'interview_practice_session_id' => $session->id,
                'role' => 'ai',
                'body' => $text,
                'created_at' => now(),
            ]);
            $session->update(['last_ai_at' => now()]);
        });

        return response()->json($this->sessionPayload($session->fresh(['messages'])));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $this->requireVerifiedUser($request);
        $session = InterviewPracticeSession::query()
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->with('messages')
            ->firstOrFail();

        return response()->json($this->sessionPayload($session));
    }

    public function transcribe(Request $request, int $id, OpenAiSpeechToTextService $stt): JsonResponse
    {
        $user = $this->requireVerifiedUser($request);
        $session = $this->loadActiveSession($user, $id);

        $data = $request->validate([
            'audio' => 'required|file|max:25600',
        ]);

        $file = $request->file('audio');
        if ($file === null) {
            return response()->json(['message' => 'Audio file missing.'], 422);
        }

        $contextRef = 'interview_practice:'.$session->id;
        try {
            $transcript = $stt->transcribe($file, $user->id, $contextRef);
        } catch (Throwable $e) {
            $this->bumpEmptyStreak($session);

            return response()->json([
                'message' => 'I didn’t catch that. Please try again.',
                'code' => 'transcribe_failed',
            ], 422);
        }

        $max = (int) config('openai.speaking_max_chars', 4000);
        if (mb_strlen($transcript) > $max) {
            $transcript = mb_substr($transcript, 0, $max);
        }

        return response()->json(['transcript' => $transcript]);
    }

    public function reply(Request $request, int $id, OpenAiInterviewPracticeService $ai): JsonResponse
    {
        $user = $this->requireVerifiedUser($request);
        $session = $this->loadActiveSession($user, $id);
        $this->assertSpeakingAiNotSuspended($user);

        $data = $request->validate([
            'text' => 'required|string|max:'.(int) config('interview_practice.max_message_chars', 6000),
        ]);

        $text = trim($data['text']);
        if ($text === '') {
            $this->bumpEmptyStreak($session);

            return response()->json([
                'message' => 'I didn’t catch that. Please try again.',
                'code' => 'empty_answer',
            ], 422);
        }

        $limits = $this->limitsFor($user);
        if (! $this->passesCooldown($session, (int) $limits['cooldown_seconds'])) {
            return response()->json([
                'message' => 'Please wait a moment before sending your next reply.',
                'code' => 'cooldown',
            ], 429);
        }

        $limitCheck = $this->checkSessionLimits($session, $limits);
        if ($limitCheck !== null) {
            return $limitCheck;
        }

        if (! $this->passesMinAnswer($text, $limits)) {
            return response()->json([
                'message' => 'Could you provide more details?',
                'code' => 'answer_too_short',
            ], 422);
        }

        if (! $user->isAdmin()) {
            $mod = app(OpenAiSpeakingModerationService::class)->screenCandidateText(
                $text,
                $user->id,
                'interview_practice:'.$session->id
            );
            if (($mod['violation'] ?? false) === true) {
                app(SpeakingAiSuspensionService::class)->suspendForContentPolicy($user);
                $user->refresh();

                throw new HttpResponseException($this->speakingSuspendedJsonResponse($user));
            }
        }

        try {
            DB::transaction(function () use ($session, $text) {
                InterviewPracticeMessage::query()->create([
                    'interview_practice_session_id' => $session->id,
                    'role' => 'user',
                    'body' => $text,
                    'created_at' => now(),
                ]);
                $session->update([
                    'user_turns' => (int) $session->user_turns + 1,
                    'empty_streak' => 0,
                ]);
            });
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => 'Could not save your reply.'], 500);
        }

        $session->refresh();
        $prior = $session->messages()->orderBy('id')->get()->all();
        $history = array_slice($prior, 0, -1);

        try {
            $out = $ai->afterCandidate($session, $history, $text);
        } catch (Throwable $e) {
            $last = $session->messages()->orderByDesc('id')->first();
            if ($last && $last->role === 'user') {
                $last->delete();
                $session->update([
                    'user_turns' => max(0, (int) $session->user_turns - 1),
                ]);
            }

            return response()->json(['message' => 'Interview AI is unavailable. Try again shortly.'], 503);
        }

        $aiText = $out['message'];
        DB::transaction(function () use ($session, $aiText) {
            InterviewPracticeMessage::query()->create([
                'interview_practice_session_id' => $session->id,
                'role' => 'ai',
                'body' => $aiText,
                'created_at' => now(),
            ]);
            $session->update(['last_ai_at' => now()]);
        });

        $session->refresh();
        $this->maybeAutoComplete($session);

        return response()->json($this->sessionPayload($session->fresh(['messages'])));
    }

    public function end(Request $request, int $id, OpenAiInterviewPracticeFeedbackService $feedback): JsonResponse
    {
        $user = $this->requireVerifiedUser($request);
        $session = InterviewPracticeSession::query()
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->with('messages')
            ->firstOrFail();

        $data = $request->validate([
            'reason' => 'nullable|string|max:64',
            'with_feedback' => 'sometimes|boolean',
        ]);

        $withFeedback = ($data['with_feedback'] ?? true) === true;

        if (! $session->isActive()) {
            if ($withFeedback && $session->feedback_json === null && $session->messages->count() >= 2) {
                try {
                    $fb = $feedback->scoreSession($session, $session->messages);
                    $session->update(['feedback_json' => $fb]);
                } catch (Throwable $e) {
                    report($e);
                }
            }

            return response()->json($this->sessionPayload($session->fresh(['messages'])));
        }

        $reason = (string) ($data['reason'] ?? 'stopped_user');
        $statusMap = [
            'silence_timeout' => 'silence_timeout',
            'time_limit' => 'time_limit',
            'turn_limit' => 'turn_limit',
            'empty_abuse' => 'empty_abuse',
        ];
        $status = $statusMap[$reason] ?? 'stopped_user';

        $session->update([
            'status' => $status,
            'ended_at' => now(),
        ]);
        $session->refresh();

        if ($withFeedback && $session->messages->count() >= 2 && $session->feedback_json === null) {
            try {
                $fb = $feedback->scoreSession($session, $session->messages);
                $session->update(['feedback_json' => $fb]);
            } catch (Throwable $e) {
                report($e);
            }
        }

        return response()->json($this->sessionPayload($session->fresh(['messages'])));
    }

    private function maybeAutoComplete(InterviewPracticeSession $session): void
    {
        $session->refresh();
        if (! $session->isActive()) {
            return;
        }

        $elapsed = $session->started_at ? $session->started_at->diffInSeconds(now()) : 0;
        if ($elapsed >= (int) $session->max_duration_seconds) {
            $session->update(['status' => 'time_limit', 'ended_at' => now()]);

            return;
        }

        if ((int) $session->user_turns >= (int) $session->max_turns) {
            $session->update(['status' => 'turn_limit', 'ended_at' => now()]);
        }
    }

    private function bumpEmptyStreak(InterviewPracticeSession $session): void
    {
        $session->refresh();
        $session->loadMissing('user');
        $user = $session->user;
        if (! $user instanceof User) {
            return;
        }
        $limits = $this->limitsFor($user);
        $maxEmpty = (int) $limits['max_empty_streak'];
        $next = (int) $session->empty_streak + 1;
        $session->update(['empty_streak' => $next]);
        if ($next >= $maxEmpty && $session->isActive()) {
            $session->update(['status' => 'empty_abuse', 'ended_at' => now()]);
        }
    }

    private function checkSessionLimits(InterviewPracticeSession $session, array $limits): ?JsonResponse
    {
        if (! $session->isActive()) {
            return response()->json([
                'message' => 'This session has already ended.',
                'code' => 'session_ended',
            ], 422);
        }

        if ((int) $session->empty_streak >= (int) $limits['max_empty_streak']) {
            return response()->json([
                'message' => 'Too many empty attempts — session ended.',
                'code' => 'empty_abuse',
            ], 422);
        }

        $elapsed = $session->started_at ? $session->started_at->diffInSeconds(now()) : 0;
        if ($elapsed >= (int) $session->max_duration_seconds) {
            $session->update(['status' => 'time_limit', 'ended_at' => now()]);

            return response()->json(array_merge([
                'message' => 'Time is up for this practice session.',
                'code' => 'time_limit',
            ], $this->sessionPayload($session->fresh(['messages']))), 422);
        }

        if ((int) $session->user_turns >= (int) $session->max_turns) {
            $session->update(['status' => 'turn_limit', 'ended_at' => now()]);

            return response()->json(array_merge([
                'message' => 'You have reached the maximum number of answers for this session.',
                'code' => 'turn_limit',
            ], $this->sessionPayload($session->fresh(['messages']))), 422);
        }

        return null;
    }

    private function passesCooldown(InterviewPracticeSession $session, int $cooldownSeconds): bool
    {
        if ($session->last_ai_at === null) {
            return true;
        }

        return $session->last_ai_at->copy()->addSeconds($cooldownSeconds)->isPast();
    }

    private function passesMinAnswer(string $text, array $limits): bool
    {
        $minC = (int) $limits['min_answer_chars'];
        $minW = (int) $limits['min_answer_words'];
        if (mb_strlen($text) < $minC) {
            return false;
        }
        $words = preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY);

        return is_array($words) && count($words) >= $minW;
    }

    private function loadActiveSession(User $user, int $id): InterviewPracticeSession
    {
        $session = InterviewPracticeSession::query()
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        if (! $session->isActive()) {
            abort(422, 'Session is not active.');
        }

        return $session;
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionPayload(InterviewPracticeSession $session): array
    {
        $session->loadMissing(['messages']);
        $elapsed = $session->started_at ? $session->started_at->diffInSeconds(now()) : 0;
        $remaining = max(0, (int) $session->max_duration_seconds - $elapsed);

        $messages = $session->messages->map(fn (InterviewPracticeMessage $m) => [
            'id' => $m->id,
            'role' => $m->role,
            'body' => $m->body,
            'created_at' => $m->created_at?->toIso8601String(),
        ])->values()->all();

        $duration = null;
        if ($session->ended_at && $session->started_at) {
            $duration = max(0, $session->ended_at->diffInSeconds($session->started_at));
        }

        return [
            'session' => [
                'id' => $session->id,
                'interview_type' => $session->interview_type,
                'interview_type_label' => InterviewPracticePrompts::typeLabel((string) $session->interview_type),
                'difficulty' => $session->difficulty,
                'custom_role' => $session->custom_role,
                'status' => $session->status,
                'is_active' => $session->isActive(),
                'started_at' => $session->started_at?->toIso8601String(),
                'ended_at' => $session->ended_at?->toIso8601String(),
                'duration_seconds' => $duration,
                'max_duration_seconds' => (int) $session->max_duration_seconds,
                'remaining_seconds' => $session->isActive() ? $remaining : 0,
                'max_turns' => (int) $session->max_turns,
                'user_turns' => (int) $session->user_turns,
                'feedback' => $session->feedback_json,
            ],
            'messages' => $messages,
        ];
    }

    /** @return array<string, int|string> */
    private function limitsFor(User $user): array
    {
        $key = $user->isSubscribed() ? 'pro' : 'free';

        return config('interview_practice.limits.'.$key, config('interview_practice.limits.free'));
    }

    private function requireVerifiedUser(Request $request): User
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');
        if (! $user) {
            throw new HttpResponseException(response()->json(['message' => 'Sign in required.', 'code' => 'auth_required'], 403));
        }
        if (! $user->hasVerifiedEmail()) {
            throw new HttpResponseException(response()->json(['message' => 'Verify your email to use interview practice.', 'code' => 'email_unverified'], 403));
        }

        return $user;
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
}
