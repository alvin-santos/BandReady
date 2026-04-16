<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudyPlan;
use App\Models\User;
use App\Services\OpenAiStudyPlanService;
use App\Support\StudyPlanSchedule;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StudyPlanController extends Controller
{
    private const EXAM_TYPES = ['ielts_general', 'celpip_general'];

    private const STUDY_TIMES = ['30m', '1h', '2h', '3h_plus'];

    private const LEVELS = ['beginner', 'intermediate', 'advanced', 'not_sure'];

    private const WEAK = ['speaking', 'writing', 'reading', 'listening'];

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $plan = StudyPlan::query()->where('user_id', $user->id)->first();

        return response()->json([
            'study_plan' => $plan ? $this->serializePlan($plan) : null,
            'limits' => $this->studyPlanLimitsForUser($user),
        ]);
    }

    public function store(Request $request, OpenAiStudyPlanService $openAi): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $this->validateCreatePayload($request, $user);
        $existing = StudyPlan::query()->where('user_id', $user->id)->first();

        return $this->generateAndSave($user, $openAi, $validated, $existing !== null);
    }

    public function regenerate(Request $request, OpenAiStudyPlanService $openAi): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $existing = StudyPlan::query()->where('user_id', $user->id)->first();
        if ($existing === null) {
            return response()->json(['message' => 'No study plan found. Create one first.'], 404);
        }

        $validated = $this->validateRegeneratePayload($request, $existing, $user);

        return $this->generateAndSave($user, $openAi, $validated, true);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $plan = StudyPlan::query()->where('user_id', $user->id)->first();
        if ($plan === null) {
            return response()->json(['message' => 'No study plan found.'], 404);
        }

        if (! $request->hasAny(['exam_date', 'completed_days'])) {
            return response()->json(['message' => 'Nothing to update.'], 422);
        }

        $validated = $request->validate([
            'exam_date' => ['sometimes', 'required', 'date'],
            'completed_days' => ['sometimes', 'required', 'array', 'max:366'],
            'completed_days.*' => ['integer', 'min:1'],
        ]);

        if (isset($validated['exam_date'])) {
            try {
                ['exam' => $examDate, 'days_remaining' => $daysRemaining] = $this->examWindowOrThrow(
                    $validated['exam_date'],
                    $this->maxExamCalendarDays($user)
                );
            } catch (ValidationException $e) {
                return response()->json([
                    'message' => $e->validator->errors()->first('exam_date') ?? 'Please choose a future exam date.',
                    'errors' => $e->errors(),
                ], 422);
            }
            $plan->exam_date = $examDate;
            $plan->days_remaining = $daysRemaining;
            $plan->plan_pacing = OpenAiStudyPlanService::planPacingKey($daysRemaining);
            $mode = $plan->schedule_mode ?? 'everyday';
            if (! in_array($mode, StudyPlanSchedule::MODES, true)) {
                $mode = 'everyday';
            }
            $customIso = $mode === 'custom'
                ? StudyPlanSchedule::normalizeCustomDays($plan->schedule_custom_days ?? [])
                : null;
            $sessionDateList = StudyPlanSchedule::sessionDates(
                $examDate,
                Carbon::today(config('app.timezone')),
                $mode,
                $customIso
            );
            $sessions = count($sessionDateList);
            if ($sessions < 1) {
                return response()->json([
                    'message' => 'No study days fall between tomorrow and this exam date for your current schedule. Change the exam date or regenerate the plan with a different schedule.',
                ], 422);
            }
            $plan->study_session_count = $sessions;
            $plan->session_dates = $sessionDateList;
            $maxDay = $this->sessionTotal($plan);
            $done = $plan->completed_days ?? [];
            $plan->completed_days = array_values(array_filter(
                array_map('intval', is_array($done) ? $done : []),
                static fn (int $d) => $d >= 1 && $d <= $maxDay
            ));
        }

        if (isset($validated['completed_days'])) {
            $max = $this->sessionTotal($plan);
            $clean = array_values(array_unique(array_map('intval', $validated['completed_days'])));
            $clean = array_values(array_filter($clean, static fn (int $d) => $d >= 1 && $d <= $max));
            sort($clean);
            $plan->completed_days = $clean;
        }

        $plan->save();

        Log::info('Study plan updated', ['user_id' => $user->id, 'fields' => array_keys($validated)]);

        return response()->json(array_merge(
            $this->serializePlan($plan->fresh(['user'])),
            ['limits' => $this->studyPlanLimitsForUser($user->fresh())]
        ));
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $deleted = StudyPlan::query()->where('user_id', $user->id)->delete();
        Log::info('Study plan deleted', ['user_id' => $user->id, 'deleted' => $deleted > 0]);

        return response()->json(array_merge(
            ['ok' => true],
            ['limits' => $this->studyPlanLimitsForUser($user->fresh())]
        ));
    }

    private function maxExamCalendarDays(User $user): int
    {
        $n = $user->isSubscribed()
            ? (int) config('openai.study_plan_max_days_pro', 30)
            : (int) config('openai.study_plan_max_days_free', 21);

        return max(1, min(90, $n));
    }

    private function freeGenerationLimit(): int
    {
        return max(1, min(20, (int) config('openai.study_plan_free_generation_limit', 3)));
    }

    /**
     * @return array<string, mixed>
     */
    private function studyPlanLimitsForUser(User $user): array
    {
        $pro = $user->isSubscribed();
        $maxDays = $this->maxExamCalendarDays($user);
        $limit = $this->freeGenerationLimit();
        $used = (int) ($user->study_plan_free_generations_used ?? 0);

        return [
            'max_exam_days' => $maxDays,
            'is_pro' => $pro,
            'free_generation_limit' => $pro ? null : $limit,
            'free_generations_used' => $pro ? null : $used,
            'free_generations_remaining' => $pro ? null : max(0, $limit - $used),
        ];
    }

    /**
     * @return JsonResponse|null
     */
    private function freeStudyPlanQuotaBlockedResponse(User $user): ?JsonResponse
    {
        if ($user->isSubscribed()) {
            return null;
        }
        $user->refresh();
        if ((int) $user->study_plan_free_generations_used >= $this->freeGenerationLimit()) {
            return response()->json([
                'message' => 'You have used all free Smart Exam Planner generations. Upgrade to BandReady Pro for unlimited plans and a longer exam window (up to '.(int) config('openai.study_plan_max_days_pro', 30).' days).',
                'code' => 'study_plan_free_quota',
            ], 403);
        }

        return null;
    }

    /**
     * @return array{exam: Carbon, days_remaining: int}
     */
    private function examWindowOrThrow(string $dateStr, int $maxCalendarDays): array
    {
        $examDate = Carbon::parse($dateStr, config('app.timezone'))->startOfDay();
        $today = Carbon::today(config('app.timezone'));
        if ($examDate->lte($today)) {
            throw ValidationException::withMessages([
                'exam_date' => ['Please choose a future exam date.'],
            ]);
        }
        $daysRemaining = (int) $today->diffInDays($examDate);
        if ($daysRemaining < 1) {
            throw ValidationException::withMessages([
                'exam_date' => ['Please choose a future exam date.'],
            ]);
        }
        if ($daysRemaining > $maxCalendarDays) {
            throw ValidationException::withMessages([
                'exam_date' => ['Exam date is too far out for your plan. Pick a date within '.$maxCalendarDays.' days, or upgrade to Pro for a longer window.'],
            ]);
        }

        return ['exam' => $examDate, 'days_remaining' => $daysRemaining];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateCreatePayload(Request $request, User $user): array
    {
        $validated = $request->validate([
            'exam_type' => ['required', 'string', Rule::in(self::EXAM_TYPES)],
            'exam_date' => ['required', 'date'],
            'study_time' => ['required', 'string', Rule::in(self::STUDY_TIMES)],
            'current_level' => ['nullable', 'string', Rule::in(self::LEVELS)],
            'weak_areas' => ['nullable', 'array', 'max:16'],
            'weak_areas.*' => ['string', Rule::in(self::WEAK)],
            'schedule_mode' => ['required', 'string', Rule::in(StudyPlanSchedule::MODES)],
            'schedule_custom_days' => ['nullable', 'required_if:schedule_mode,custom', 'array', 'min:1', 'max:7'],
            'schedule_custom_days.*' => ['integer', Rule::in([1, 2, 3, 4, 5, 6, 7])],
        ]);

        try {
            $this->examWindowOrThrow($validated['exam_date'], $this->maxExamCalendarDays($user));
        } catch (ValidationException $e) {
            throw $e;
        }

        $validated['weak_areas'] = array_values(
            array_intersect(self::WEAK, $validated['weak_areas'] ?? [])
        );

        $mode = $validated['schedule_mode'];
        $validated['schedule_custom_days'] = $mode === 'custom'
            ? StudyPlanSchedule::normalizeCustomDays($validated['schedule_custom_days'] ?? [])
            : null;
        if ($mode === 'custom' && $validated['schedule_custom_days'] === []) {
            throw ValidationException::withMessages([
                'schedule_custom_days' => ['Pick at least one day for a custom schedule.'],
            ]);
        }

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    private function validateRegeneratePayload(Request $request, StudyPlan $existing, User $user): array
    {
        $validated = $request->validate([
            'exam_type' => ['sometimes', 'string', Rule::in(self::EXAM_TYPES)],
            'exam_date' => ['sometimes', 'date'],
            'study_time' => ['sometimes', 'string', Rule::in(self::STUDY_TIMES)],
            'current_level' => ['nullable', 'string', Rule::in(self::LEVELS)],
            'weak_areas' => ['nullable', 'array', 'max:16'],
            'weak_areas.*' => ['string', Rule::in(self::WEAK)],
            'schedule_mode' => ['sometimes', 'string', Rule::in(StudyPlanSchedule::MODES)],
            'schedule_custom_days' => ['nullable', 'array', 'min:1', 'max:7'],
            'schedule_custom_days.*' => ['integer', Rule::in([1, 2, 3, 4, 5, 6, 7])],
        ]);

        $mode = $validated['schedule_mode'] ?? ($existing->schedule_mode ?? 'everyday');
        if (! in_array($mode, StudyPlanSchedule::MODES, true)) {
            $mode = 'everyday';
        }
        $custom = null;
        if ($mode === 'custom') {
            $raw = array_key_exists('schedule_custom_days', $validated)
                ? ($validated['schedule_custom_days'] ?? [])
                : ($existing->schedule_custom_days ?? []);
            $custom = StudyPlanSchedule::normalizeCustomDays(is_array($raw) ? $raw : []);
        }

        $merged = [
            'exam_type' => $validated['exam_type'] ?? $existing->exam_type,
            'exam_date' => $validated['exam_date'] ?? $existing->exam_date->toDateString(),
            'study_time' => $validated['study_time'] ?? $existing->study_time,
            'current_level' => array_key_exists('current_level', $validated)
                ? $validated['current_level']
                : $existing->current_level,
            'weak_areas' => array_key_exists('weak_areas', $validated)
                ? array_values(array_intersect(self::WEAK, $validated['weak_areas'] ?? []))
                : ($existing->weak_areas ?? []),
            'schedule_mode' => $mode,
            'schedule_custom_days' => $custom,
        ];

        if ($merged['schedule_mode'] === 'custom' && ($merged['schedule_custom_days'] ?? []) === []) {
            throw ValidationException::withMessages([
                'schedule_custom_days' => ['Pick at least one day for a custom schedule.'],
            ]);
        }

        try {
            $this->examWindowOrThrow($merged['exam_date'], $this->maxExamCalendarDays($user));
        } catch (ValidationException $e) {
            throw $e;
        }

        return $merged;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function generateAndSave(User $user, OpenAiStudyPlanService $openAi, array $validated, bool $isReplacement): JsonResponse
    {
        $maxDays = $this->maxExamCalendarDays($user);
        try {
            ['exam' => $examDate, 'days_remaining' => $daysRemaining] = $this->examWindowOrThrow($validated['exam_date'], $maxDays);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first('exam_date') ?? 'Invalid exam date.',
                'errors' => $e->errors(),
            ], 422);
        }

        $blocked = $this->freeStudyPlanQuotaBlockedResponse($user);
        if ($blocked !== null) {
            return $blocked;
        }

        $mode = $validated['schedule_mode'] ?? 'everyday';
        if (! in_array($mode, StudyPlanSchedule::MODES, true)) {
            $mode = 'everyday';
        }
        $customIso = $mode === 'custom'
            ? StudyPlanSchedule::normalizeCustomDays($validated['schedule_custom_days'] ?? [])
            : null;
        if ($mode === 'custom' && $customIso === []) {
            return response()->json(['message' => 'Pick at least one day for a custom schedule.'], 422);
        }

        $sessionDateList = StudyPlanSchedule::sessionDates(
            $examDate,
            Carbon::today(config('app.timezone')),
            $mode,
            $customIso
        );
        $sessions = count($sessionDateList);
        if ($sessions < 1) {
            return response()->json([
                'message' => 'No study days fall between tomorrow and your exam for this schedule. Try a different schedule or exam date.',
            ], 422);
        }

        $pacingKey = OpenAiStudyPlanService::planPacingKey($daysRemaining);
        $pacingLabel = OpenAiStudyPlanService::planPacingLabel($daysRemaining);
        $scheduleSummary = StudyPlanSchedule::describe($mode, $customIso);

        $examLabel = match ($validated['exam_type']) {
            'ielts_general' => 'IELTS General',
            'celpip_general' => 'CELPIP General',
            default => $validated['exam_type'],
        };
        $studyLabel = match ($validated['study_time']) {
            '30m' => '30 minutes',
            '1h' => '1 hour',
            '2h' => '2 hours',
            '3h_plus' => '3+ hours',
            default => $validated['study_time'],
        };

        $weak = is_array($validated['weak_areas'] ?? null) ? $validated['weak_areas'] : [];

        try {
            $generated = $openAi->generatePlanText(
                $examLabel,
                $daysRemaining,
                $sessions,
                $scheduleSummary,
                $studyLabel,
                isset($validated['current_level']) ? (string) $validated['current_level'] : null,
                $weak,
                $pacingLabel,
                $user->id,
            );
            $planSummary = $generated['summary'];
            $text = $generated['plan_text'];
        } catch (\Throwable $e) {
            Log::warning('Study plan OpenAI failure', [
                'user_id' => $user->id,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Unable to generate plan. Try again.'], 503);
        }

        DB::transaction(function () use ($user, $validated, $examDate, $daysRemaining, $sessions, $sessionDateList, $mode, $customIso, $weak, $planSummary, $text, $pacingKey, $isReplacement): void {
            $plan = StudyPlan::query()->where('user_id', $user->id)->lockForUpdate()->first();
            if ($isReplacement) {
                abort_unless($plan !== null, 500, 'Study plan could not be updated.');
            } else {
                $plan ??= new StudyPlan(['user_id' => $user->id]);
            }

            $plan->user_id = $user->id;
            $plan->exam_type = $validated['exam_type'];
            $plan->exam_date = $examDate->toDateString();
            $plan->days_remaining = $daysRemaining;
            $plan->study_session_count = $sessions;
            $plan->session_dates = $sessionDateList;
            $plan->schedule_mode = $mode;
            $plan->schedule_custom_days = $mode === 'custom' ? $customIso : null;
            $plan->study_time = $validated['study_time'];
            $plan->current_level = $validated['current_level'] ?? null;
            $plan->weak_areas = $weak;
            $plan->plan_summary = $planSummary !== '' ? $planSummary : null;
            $plan->plan_text = $text;
            $plan->plan_pacing = $pacingKey;
            $plan->completed_days = [];
            $plan->save();

            if (! $user->isSubscribed()) {
                User::query()->whereKey($user->id)->increment('study_plan_free_generations_used');
            }
        });

        $fresh = StudyPlan::query()->where('user_id', $user->id)->first();
        if ($fresh === null) {
            return response()->json(['message' => 'Unable to save study plan. Try again.'], 500);
        }

        Log::info('Study plan generated', [
            'user_id' => $user->id,
            'days_remaining' => $daysRemaining,
            'study_session_count' => $sessions,
            'schedule_mode' => $mode,
            'replacement' => $isReplacement,
        ]);

        return response()->json(array_merge(
            $this->serializePlan($fresh->loadMissing('user')),
            ['limits' => $this->studyPlanLimitsForUser($user->fresh())]
        ));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePlan(StudyPlan $plan): array
    {
        $plan->loadMissing('user');

        $mode = $plan->schedule_mode ?? 'everyday';
        $custom = $mode === 'custom' ? StudyPlanSchedule::normalizeCustomDays($plan->schedule_custom_days ?? []) : null;

        return [
            'plan' => $plan->plan_text,
            'plan_summary' => $plan->plan_summary !== null && $plan->plan_summary !== '' ? (string) $plan->plan_summary : null,
            'days_remaining' => (int) $plan->days_remaining,
            'study_session_count' => $this->sessionTotal($plan),
            'exam_date' => $plan->exam_date->toDateString(),
            'exam_type' => $plan->exam_type,
            'study_time' => $plan->study_time,
            'current_level' => $plan->current_level,
            'weak_areas' => $plan->weak_areas ?? [],
            'schedule_mode' => $mode,
            'schedule_custom_days' => $custom ?? [],
            'schedule_summary' => StudyPlanSchedule::describe($mode, $custom),
            'session_dates' => $this->resolveSessionDatesForPlan($plan),
            'completed_days' => array_values(array_map('intval', $plan->completed_days ?? [])),
            'plan_pacing' => $plan->plan_pacing,
        ];
    }

    private function sessionTotal(StudyPlan $plan): int
    {
        $n = (int) ($plan->study_session_count ?? 0);

        return $n > 0 ? $n : max(1, (int) $plan->days_remaining);
    }

    /**
     * @return list<string>
     */
    private function resolveSessionDatesForPlan(StudyPlan $plan): array
    {
        $stored = $plan->session_dates ?? null;
        if (is_array($stored) && $stored !== []) {
            return array_values(array_map(static fn ($d) => (string) $d, $stored));
        }

        $mode = $plan->schedule_mode ?? 'everyday';
        if (! in_array($mode, StudyPlanSchedule::MODES, true)) {
            $mode = 'everyday';
        }
        $custom = $mode === 'custom'
            ? StudyPlanSchedule::normalizeCustomDays($plan->schedule_custom_days ?? [])
            : null;

        return StudyPlanSchedule::sessionDates(
            $plan->exam_date,
            Carbon::today(config('app.timezone')),
            $mode,
            $custom
        );
    }
}
