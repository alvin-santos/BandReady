<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudyPlan;
use App\Models\User;
use App\Services\OpenAiStudyPlanService;
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
        if (! $user instanceof User || ! $user->isSubscribed()) {
            return response()->json(['message' => 'This feature is available for Pro users only.'], 403);
        }

        $plan = StudyPlan::query()->where('user_id', $user->id)->first();

        return response()->json([
            'study_plan' => $plan ? $this->serializePlan($plan) : null,
        ]);
    }

    public function store(Request $request, OpenAiStudyPlanService $openAi): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User || ! $user->isSubscribed()) {
            return response()->json(['message' => 'This feature is available for Pro users only.'], 403);
        }

        $validated = $this->validateCreatePayload($request);
        $existing = StudyPlan::query()->where('user_id', $user->id)->first();

        return $this->generateAndSave($user, $openAi, $validated, $existing !== null);
    }

    public function regenerate(Request $request, OpenAiStudyPlanService $openAi): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User || ! $user->isSubscribed()) {
            return response()->json(['message' => 'This feature is available for Pro users only.'], 403);
        }

        $existing = StudyPlan::query()->where('user_id', $user->id)->first();
        if ($existing === null) {
            return response()->json(['message' => 'No study plan found. Create one first.'], 404);
        }

        $validated = $this->validateRegeneratePayload($request, $existing);

        return $this->generateAndSave($user, $openAi, $validated, true);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User || ! $user->isSubscribed()) {
            return response()->json(['message' => 'This feature is available for Pro users only.'], 403);
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
                ['exam' => $examDate, 'days_remaining' => $daysRemaining] = $this->examWindowOrThrow($validated['exam_date']);
            } catch (ValidationException $e) {
                return response()->json([
                    'message' => $e->validator->errors()->first('exam_date') ?? 'Please choose a future exam date.',
                    'errors' => $e->errors(),
                ], 422);
            }
            $plan->exam_date = $examDate;
            $plan->days_remaining = $daysRemaining;
            $plan->plan_pacing = OpenAiStudyPlanService::planPacingKey($daysRemaining);
            $maxDay = $daysRemaining;
            $done = $plan->completed_days ?? [];
            $plan->completed_days = array_values(array_filter(
                array_map('intval', is_array($done) ? $done : []),
                static fn (int $d) => $d >= 1 && $d <= $maxDay
            ));
        }

        if (isset($validated['completed_days'])) {
            $max = (int) $plan->days_remaining;
            $clean = array_values(array_unique(array_map('intval', $validated['completed_days'])));
            $clean = array_values(array_filter($clean, static fn (int $d) => $d >= 1 && $d <= $max));
            sort($clean);
            $plan->completed_days = $clean;
        }

        $plan->save();

        Log::info('Study plan updated', ['user_id' => $user->id, 'fields' => array_keys($validated)]);

        return response()->json($this->serializePlan($plan));
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User || ! $user->isSubscribed()) {
            return response()->json(['message' => 'This feature is available for Pro users only.'], 403);
        }

        $deleted = StudyPlan::query()->where('user_id', $user->id)->delete();
        Log::info('Study plan deleted', ['user_id' => $user->id, 'deleted' => $deleted > 0]);

        return response()->json(['ok' => true]);
    }

    /**
     * @return array{exam: Carbon, days_remaining: int}
     */
    private function examWindowOrThrow(string $dateStr): array
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
        if ($daysRemaining > 90) {
            throw ValidationException::withMessages([
                'exam_date' => ['Exam date must be within 90 days.'],
            ]);
        }

        return ['exam' => $examDate, 'days_remaining' => $daysRemaining];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateCreatePayload(Request $request): array
    {
        $validated = $request->validate([
            'exam_type' => ['required', 'string', Rule::in(self::EXAM_TYPES)],
            'exam_date' => ['required', 'date'],
            'study_time' => ['required', 'string', Rule::in(self::STUDY_TIMES)],
            'current_level' => ['nullable', 'string', Rule::in(self::LEVELS)],
            'weak_areas' => ['nullable', 'array', 'max:16'],
            'weak_areas.*' => ['string', Rule::in(self::WEAK)],
        ]);

        try {
            $this->examWindowOrThrow($validated['exam_date']);
        } catch (ValidationException $e) {
            throw $e;
        }

        $validated['weak_areas'] = array_values(
            array_intersect(self::WEAK, $validated['weak_areas'] ?? [])
        );

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    private function validateRegeneratePayload(Request $request, StudyPlan $existing): array
    {
        $validated = $request->validate([
            'exam_type' => ['sometimes', 'string', Rule::in(self::EXAM_TYPES)],
            'exam_date' => ['sometimes', 'date'],
            'study_time' => ['sometimes', 'string', Rule::in(self::STUDY_TIMES)],
            'current_level' => ['nullable', 'string', Rule::in(self::LEVELS)],
            'weak_areas' => ['nullable', 'array', 'max:16'],
            'weak_areas.*' => ['string', Rule::in(self::WEAK)],
        ]);

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
        ];

        try {
            $this->examWindowOrThrow($merged['exam_date']);
        } catch (ValidationException $e) {
            throw $e;
        }

        return $merged;
    }

    private function regenSlotsRemaining(StudyPlan $model): int
    {
        $today = Carbon::today(config('app.timezone'));
        $win = $model->regenerate_window_date;
        if ($win === null || ! $win->isSameDay($today)) {
            return 5;
        }

        return max(0, 5 - (int) $model->regenerate_count_today);
    }

    private function bumpRegenerateCount(StudyPlan $model): void
    {
        $today = Carbon::today(config('app.timezone'));
        $win = $model->regenerate_window_date;
        if ($win === null || ! $win->isSameDay($today)) {
            $model->regenerate_count_today = 1;
            $model->regenerate_window_date = $today;
        } else {
            $model->regenerate_count_today = min(255, (int) $model->regenerate_count_today + 1);
        }
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function generateAndSave(User $user, OpenAiStudyPlanService $openAi, array $validated, bool $isReplacement): JsonResponse
    {
        try {
            ['exam' => $examDate, 'days_remaining' => $daysRemaining] = $this->examWindowOrThrow($validated['exam_date']);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first('exam_date') ?? 'Invalid exam date.',
                'errors' => $e->errors(),
            ], 422);
        }

        $planRow = StudyPlan::query()->where('user_id', $user->id)->first();
        if ($isReplacement && $planRow !== null && $this->regenSlotsRemaining($planRow) < 1) {
            return response()->json([
                'message' => 'You can regenerate your study plan up to 5 times per day. Try again tomorrow.',
            ], 429);
        }

        $pacingKey = OpenAiStudyPlanService::planPacingKey($daysRemaining);
        $pacingLabel = OpenAiStudyPlanService::planPacingLabel($daysRemaining);

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
            $text = $openAi->generatePlanText(
                $examLabel,
                $daysRemaining,
                $studyLabel,
                isset($validated['current_level']) ? (string) $validated['current_level'] : null,
                $weak,
                $pacingLabel,
                $user->id,
            );
        } catch (\Throwable $e) {
            Log::warning('Study plan OpenAI failure', [
                'user_id' => $user->id,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Unable to generate plan. Try again.'], 503);
        }

        DB::transaction(function () use ($user, $validated, $examDate, $daysRemaining, $weak, $text, $pacingKey, $isReplacement): void {
            $plan = StudyPlan::query()->where('user_id', $user->id)->lockForUpdate()->first();
            if ($isReplacement) {
                abort_unless($plan !== null, 500, 'Study plan could not be updated.');
                abort_unless($this->regenSlotsRemaining($plan) >= 1, 429, 'You can regenerate your study plan up to 5 times per day. Try again tomorrow.');
                $this->bumpRegenerateCount($plan);
            } else {
                $plan ??= new StudyPlan(['user_id' => $user->id]);
            }

            $plan->user_id = $user->id;
            $plan->exam_type = $validated['exam_type'];
            $plan->exam_date = $examDate->toDateString();
            $plan->days_remaining = $daysRemaining;
            $plan->study_time = $validated['study_time'];
            $plan->current_level = $validated['current_level'] ?? null;
            $plan->weak_areas = $weak;
            $plan->plan_text = $text;
            $plan->plan_pacing = $pacingKey;
            $plan->completed_days = [];
            $plan->save();
        });

        $fresh = StudyPlan::query()->where('user_id', $user->id)->first();
        if ($fresh === null) {
            return response()->json(['message' => 'Unable to save study plan. Try again.'], 500);
        }

        Log::info('Study plan generated', [
            'user_id' => $user->id,
            'days_remaining' => $daysRemaining,
            'replacement' => $isReplacement,
        ]);

        return response()->json($this->serializePlan($fresh));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePlan(StudyPlan $plan): array
    {
        $slots = $this->regenSlotsRemaining($plan);

        return [
            'plan' => $plan->plan_text,
            'days_remaining' => (int) $plan->days_remaining,
            'exam_date' => $plan->exam_date->toDateString(),
            'exam_type' => $plan->exam_type,
            'study_time' => $plan->study_time,
            'current_level' => $plan->current_level,
            'weak_areas' => $plan->weak_areas ?? [],
            'completed_days' => array_values(array_map('intval', $plan->completed_days ?? [])),
            'plan_pacing' => $plan->plan_pacing,
            'regenerations_remaining' => $slots,
        ];
    }
}
