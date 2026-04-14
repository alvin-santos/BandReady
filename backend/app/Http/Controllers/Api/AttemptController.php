<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Answer;
use App\Models\Attempt;
use App\Models\Question;
use App\Models\SiteSetting;
use App\Models\Test;
use App\Models\User;
use App\Services\ExamAccessService;
use App\Services\IeltsSpeakingInterviewOrder;
use App\Services\OpenAiSpeakingFeedbackService;
use App\Services\OpenAiWritingFeedbackService;
use App\Services\QuestionGrader;
use App\Services\SpeakingAiSuspensionService;
use App\Services\StatisticsRecorder;
use App\Support\CelpipTestQuestionLimits;
use App\Support\IeltsAiSpeaking;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AttemptController extends Controller
{
    public function start(Request $request)
    {
        $data = $request->validate([
            'test_id' => 'required|exists:tests,id',
            'guest_session' => 'nullable|uuid',
            'strict_mode' => 'sometimes|boolean',
            'forward_only' => 'sometimes|boolean',
        ]);

        $test = Test::query()->with('section')->findOrFail($data['test_id']);
        /** @var User|null $user */
        $user = $request->user('sanctum');

        if (! $test->is_available) {
            return response()->json(['message' => 'This test is not available yet.'], 422);
        }

        if (! $user && ! in_array($test->practice_mode, ['quick', 'full'], true)) {
            return response()->json(['message' => 'Sign in to access this test mode.', 'code' => 'auth_required'], 403);
        }

        $access = app(ExamAccessService::class);
        $deny = $access->denyStartReason($test, $user);
        if ($deny !== null) {
            return response()->json([
                'message' => $access->denyStartMessage($deny),
                'code' => $access->denyStartCode($deny),
            ], 403);
        }

        $guestSession = $data['guest_session'] ?? null;
        if (! $user) {
            $guestSession = $guestSession ?? (string) Str::uuid();
        }

        $duration = $test->duration_minutes ?? $test->section?->duration_minutes ?? 60;
        $timeLimit = $duration * 60;

        $strict = (bool) ($data['strict_mode'] ?? false);
        if ($strict && ! $user) {
            $strict = false;
        }

        $forwardOnly = (bool) ($data['forward_only'] ?? false);
        if ($forwardOnly && ! $user) {
            $forwardOnly = false;
        }

        $canonical = $test->questions()->orderBy('order')->get();
        $ieltsOrder = IeltsSpeakingInterviewOrder::orderedQuestionIds($test, $canonical);
        $fromIeltsSpeakingOrder = $ieltsOrder !== null && count($ieltsOrder) > 0;
        if ($fromIeltsSpeakingOrder) {
            $orderIds = $ieltsOrder;
        } else {
            $siteDefaults = SiteSetting::current()->celpip_default_questions_per_task;
            $siteDefaults = is_array($siteDefaults) ? $siteDefaults : null;
            $effectiveCaps = CelpipTestQuestionLimits::mergeSiteDefaultsWithTestCaps(
                $test->celpip_questions_per_task,
                $test->section?->name,
                $siteDefaults
            );
            $pool = CelpipTestQuestionLimits::applyPerTaskCaps($canonical, $effectiveCaps);
            if ($pool->isEmpty()) {
                return response()->json([
                    'message' => 'This test has no questions to show. Adjust per-task limits or add questions.',
                    'code' => 'empty_question_pool',
                ], 422);
            }
            $orderIds = $pool->pluck('id')->all();
            $cap = $test->questions_to_show;
            if ($cap !== null && $cap > 0 && count($orderIds) > $cap) {
                $orderIds = $this->pickQuestionIdsRespectingImageMinimum($pool, $cap);
            } elseif (! $this->questionPoolUsesCelpipTasks($pool)) {
                // Preserve bank `order` / per-task merge order for CELPIP-style tests; shuffle only generic banks.
                shuffle($orderIds);
            }
        }

        // IELTS speaking order bypassed the generic cap branch above — still honour admin `questions_to_show`.
        $capShow = $test->questions_to_show;
        if ($fromIeltsSpeakingOrder && $capShow !== null && $capShow > 0 && count($orderIds) > $capShow) {
            $aiIds = $canonical
                ->filter(fn (Question $q) => IeltsAiSpeaking::isAiConversationQuestion($q))
                ->pluck('id')
                ->values()
                ->all();
            if ($capShow === 1 && count($aiIds) === 1) {
                $orderIds = [(int) $aiIds[0]];
            } else {
                $orderIds = array_values(array_slice($orderIds, 0, $capShow));
            }
        }

        $attempt = Attempt::query()->create([
            'user_id' => $user?->id,
            'test_id' => $test->id,
            'guest_session' => $guestSession,
            'started_at' => now(),
            'time_limit_seconds' => $timeLimit,
            'strict_mode' => $strict,
            'forward_only' => $forwardOnly,
            'forward_only_min_allowed_index' => 0,
            'question_order' => $orderIds,
        ]);

        $attempt->load('test.questions');
        $revealAuthoringKey = $user !== null && $user->isAdmin();
        $questionsPayload = $attempt->questionsInAttemptOrder()
            ->map(fn (Question $q) => $this->questionPublic($q, $revealAuthoringKey))
            ->values();
        if ($revealAuthoringKey) {
            $questionsPayload = $this->withAdminAuthoringColumnsFromDatabase($questionsPayload);
        }

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'test_id' => $attempt->test_id,
                'guest_session' => $attempt->guest_session,
                'started_at' => $attempt->started_at,
                'time_limit_seconds' => $attempt->time_limit_seconds,
                'strict_mode' => (bool) $attempt->strict_mode,
                'forward_only' => (bool) $attempt->forward_only,
                'forward_only_min_allowed_index' => (int) $attempt->forward_only_min_allowed_index,
            ],
            'test' => [
                'id' => $test->id,
                'title' => $test->title,
                'practice_mode' => $test->practice_mode,
                'exam' => $test->exam,
                'section' => $test->section,
            ],
            'questions' => $questionsPayload,
            'limits' => [
                'essay_max_chars' => (int) config('openai.essay_max_chars', 4000),
                'speaking_max_chars' => (int) config('openai.speaking_max_chars', 4000),
                'speaking_conversation_max_chars' => (int) config('openai.speaking_conversation_max_chars', 16000),
                'speaking_max_seconds' => (int) config('openai.speaking_max_record_seconds', 180),
            ],
        ]);
    }

    public function saveAnswer(Request $request)
    {
        $data = $request->validate([
            'attempt_id' => 'required|exists:attempts,id',
            'question_id' => 'required|exists:questions,id',
            'answer' => 'nullable|string',
            'is_flagged' => 'boolean',
        ]);

        $attempt = Attempt::query()->findOrFail($data['attempt_id']);
        $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order')]);
        $this->authorizeAttempt($request, $attempt);

        if ($attempt->completed_at) {
            return response()->json(['message' => 'Attempt already submitted'], 422);
        }

        $allowedIds = $attempt->questionsInAttemptOrder()->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (! in_array((int) $data['question_id'], $allowedIds, true)) {
            return response()->json(['message' => 'This question is not part of this attempt.'], 422);
        }

        if ($attempt->forward_only) {
            $pos = $this->questionIndexInAttempt($attempt, (int) $data['question_id']);
            if ($pos !== null && $pos < (int) $attempt->forward_only_min_allowed_index) {
                return response()->json(['message' => 'Earlier questions are locked in forward-only mode.'], 422);
            }
        }

        $question = Question::query()->findOrFail($data['question_id']);
        if ($question->type === 'essay' && isset($data['answer']) && is_string($data['answer'])) {
            $max = (int) config('openai.essay_max_chars', 4000);
            if (Str::length($data['answer']) > $max) {
                return response()->json([
                    'message' => "Essay cannot exceed {$max} characters.",
                    'code' => 'essay_too_long',
                ], 422);
            }
        }
        if ($question->type === 'speaking_prompt' && isset($data['answer']) && is_string($data['answer'])) {
            $max = IeltsAiSpeaking::isAiConversationQuestion($question)
                ? (int) config('openai.speaking_conversation_max_chars', 16000)
                : (int) config('openai.speaking_max_chars', 4000);
            if (Str::length($data['answer']) > $max) {
                return response()->json([
                    'message' => "Speaking transcript cannot exceed {$max} characters.",
                    'code' => 'speaking_too_long',
                ], 422);
            }
        }

        Answer::query()->updateOrCreate(
            [
                'attempt_id' => $attempt->id,
                'question_id' => $data['question_id'],
            ],
            [
                'answer' => $data['answer'] ?? null,
                'is_flagged' => $data['is_flagged'] ?? false,
            ]
        );

        $flags = Answer::query()
            ->where('attempt_id', $attempt->id)
            ->where('is_flagged', true)
            ->pluck('question_id')
            ->all();
        $attempt->update(['flagged_question_ids' => $flags]);

        return response()->json(['ok' => true]);
    }

    public function submit(Request $request)
    {
        $data = $request->validate([
            'attempt_id' => 'required|exists:attempts,id',
            'time_spent_seconds' => 'nullable|integer|min:0',
        ]);

        $attempt = Attempt::query()->with(['test.questions', 'answers', 'user'])->findOrFail($data['attempt_id']);
        $this->authorizeAttempt($request, $attempt);

        if ($attempt->completed_at) {
            return response()->json(['message' => 'Already submitted'], 422);
        }

        $timeSpent = $data['time_spent_seconds'] ?? 0;

        return DB::transaction(function () use ($attempt, $timeSpent) {
            $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order'), 'user']);
            $questions = $attempt->questionsInAttemptOrder();
            $totalWeight = 0.0;
            $earned = 0.0;

            $user = $attempt->user;
            $subjectiveAiEligible = $user && ($user->isSubscribed() || $user->isAdmin());
            /** @var OpenAiWritingFeedbackService $writingAi */
            $writingAi = app(OpenAiWritingFeedbackService::class);
            /** @var OpenAiSpeakingFeedbackService $speakingAi */
            $speakingAi = app(OpenAiSpeakingFeedbackService::class);

            foreach ($questions as $question) {
                $answerRow = Answer::query()->firstOrCreate(
                    [
                        'attempt_id' => $attempt->id,
                        'question_id' => $question->id,
                    ],
                    ['is_flagged' => false]
                );
                $ans = $answerRow->answer;

                $graded = QuestionGrader::grade($question, $ans);
                $subjective = QuestionGrader::estimateSubjectivePoints($question, $ans);

                if ($question->type === 'essay') {
                    $totalWeight += 1.0;
                    if ($subjectiveAiEligible) {
                        try {
                            $feedbackPayload = $writingAi->evaluateEssay($question, $ans, $user?->id, $attempt->id);
                            $subjective = QuestionGrader::subjectivePointsFromWritingAi($feedbackPayload);
                        } catch (\Throwable $e) {
                            Log::warning('Essay AI grading failed', [
                                'attempt_id' => $attempt->id,
                                'question_id' => $question->id,
                                'error' => $e->getMessage(),
                            ]);
                            $subjective = QuestionGrader::estimateSubjectivePoints($question, $ans);
                            $feedbackPayload = [
                                'grading_mode' => 'heuristic',
                                'ai_unavailable' => true,
                                'message' => 'AI feedback was unavailable; score uses a completion estimate.',
                            ];
                        }
                    } else {
                        $feedbackPayload = [
                            'grading_mode' => 'heuristic',
                            'message' => $user
                                ? 'AI writing feedback requires an active Pro subscription; score uses a completion estimate.'
                                : 'Sign in with Pro for AI writing feedback; score uses a completion estimate.',
                        ];
                    }
                    $answerRow->update([
                        'is_correct' => null,
                        'writing_feedback' => $feedbackPayload,
                    ]);
                    $earned += $subjective;
                } elseif ($question->type === 'speaking_prompt') {
                    $totalWeight += 1.0;
                    if ($subjectiveAiEligible) {
                        try {
                            $feedbackPayload = $speakingAi->evaluateSpeaking($question, $ans, $user?->id, $attempt->id);
                            $subjective = QuestionGrader::subjectivePointsFromWritingAi($feedbackPayload);
                            if ($user && ($feedbackPayload['content_policy_violation'] ?? false)) {
                                app(SpeakingAiSuspensionService::class)->suspendForContentPolicy($user);
                            }
                        } catch (\Throwable $e) {
                            Log::warning('Speaking AI grading failed', [
                                'attempt_id' => $attempt->id,
                                'question_id' => $question->id,
                                'error' => $e->getMessage(),
                            ]);
                            $subjective = QuestionGrader::estimateSubjectivePoints($question, $ans);
                            $feedbackPayload = [
                                'grading_mode' => 'heuristic',
                                'ai_unavailable' => true,
                                'message' => 'AI feedback was unavailable; score uses a completion estimate.',
                            ];
                        }
                    } else {
                        $feedbackPayload = [
                            'grading_mode' => 'heuristic',
                            'message' => $user
                                ? 'AI speaking feedback requires an active Pro subscription; score uses a completion estimate.'
                                : 'Sign in with Pro for AI speaking feedback; score uses a completion estimate.',
                        ];
                    }
                    $answerRow->update([
                        'is_correct' => null,
                        'speaking_feedback' => $feedbackPayload,
                    ]);
                    $earned += $subjective;
                } else {
                    $totalWeight += 1.0;
                    $earned += $graded ? 1.0 : 0.0;
                    $answerRow->update(['is_correct' => $graded]);
                }
            }

            $score = $totalWeight > 0 ? round(100 * ($earned / $totalWeight), 2) : 0.0;

            $attempt->update([
                'completed_at' => now(),
                'score' => $score,
                'time_spent_seconds' => $timeSpent,
            ]);

            StatisticsRecorder::recordAttempt($score, true);

            return response()->json([
                'attempt_id' => $attempt->id,
                'score' => $score,
                'redirect' => '/results/'.$attempt->id,
            ]);
        });
    }

    public function advanceForwardOnly(Request $request, int $id)
    {
        $data = $request->validate([
            'min_allowed_index' => 'required|integer|min:0',
        ]);

        $attempt = Attempt::query()->findOrFail($id);
        $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order')]);
        $this->authorizeAttempt($request, $attempt);

        if (! $attempt->forward_only) {
            return response()->json(['message' => 'This attempt is not forward-only.'], 422);
        }

        if ($attempt->completed_at) {
            return response()->json(['message' => 'Attempt already submitted'], 422);
        }

        $total = $attempt->questionsInAttemptOrder()->count();
        $newMin = (int) $data['min_allowed_index'];
        $oldMin = (int) $attempt->forward_only_min_allowed_index;

        if ($newMin < $oldMin) {
            return response()->json(['message' => 'Cannot unlock earlier questions.'], 422);
        }

        if ($total > 0 && $newMin > $total - 1) {
            return response()->json(['message' => 'Invalid question index.'], 422);
        }

        $attempt->update(['forward_only_min_allowed_index' => $newMin]);

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'forward_only' => true,
                'forward_only_min_allowed_index' => $newMin,
            ],
        ]);
    }

    public function resume(Request $request, int $id)
    {
        $attempt = Attempt::query()->with(['test.exam', 'test.section'])->findOrFail($id);
        $this->authorizeAttempt($request, $attempt);

        if ($attempt->completed_at) {
            return response()->json(['message' => 'Attempt completed'], 422);
        }

        $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order')]);
        /** @var User|null $viewer */
        $viewer = $request->user('sanctum');
        $revealAuthoringKey = $viewer !== null && $viewer->isAdmin();
        $questions = $attempt->questionsInAttemptOrder()->map(fn (Question $q) => $this->questionPublic($q, $revealAuthoringKey));
        if ($revealAuthoringKey) {
            $questions = $this->withAdminAuthoringColumnsFromDatabase($questions);
        }

        $answers = Answer::query()
            ->where('attempt_id', $attempt->id)
            ->get()
            ->keyBy('question_id');

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'test_id' => $attempt->test_id,
                'guest_session' => $attempt->guest_session,
                'started_at' => $attempt->started_at,
                'time_limit_seconds' => $attempt->time_limit_seconds,
                'strict_mode' => (bool) $attempt->strict_mode,
                'forward_only' => (bool) $attempt->forward_only,
                'forward_only_min_allowed_index' => (int) $attempt->forward_only_min_allowed_index,
                'flagged_question_ids' => $attempt->flagged_question_ids ?? [],
            ],
            'test' => [
                'id' => $attempt->test->id,
                'title' => $attempt->test->title,
                'practice_mode' => $attempt->test->practice_mode,
                'exam' => $attempt->test->exam,
                'section' => $attempt->test->section,
            ],
            'questions' => $questions,
            'saved_answers' => $answers,
            'limits' => [
                'essay_max_chars' => (int) config('openai.essay_max_chars', 4000),
                'speaking_max_chars' => (int) config('openai.speaking_max_chars', 4000),
                'speaking_conversation_max_chars' => (int) config('openai.speaking_conversation_max_chars', 16000),
                'speaking_max_seconds' => (int) config('openai.speaking_max_record_seconds', 180),
            ],
        ]);
    }

    public function active(Request $request)
    {
        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json(null);
        }

        $attempt = Attempt::query()
            ->where('user_id', $user->id)
            ->whereNull('completed_at')
            ->latest('started_at')
            ->first();

        if (! $attempt) {
            return response()->json(null);
        }

        $test = Test::query()->with(['exam', 'section', 'questions' => fn ($q) => $q->orderBy('order')])->find($attempt->test_id);

        return response()->json([
            'attempt' => $attempt,
            'test' => $test ? $this->stripCorrectFromTestForAttempt($attempt, $test) : null,
        ]);
    }

    /**
     * When subsampling questions for an attempt, prefer at least two items that have a scene image (`image_url`),
     * if the pool has enough image questions and the cap allows (e.g. cap ≥ 2, or cap = 1 → at most one image).
     *
     * @param  Collection<int, Question>  $questionsOrdered
     * @return list<int>
     */
    /**
     * True when the pool includes official-style CELPIP task numbers — attempt order should follow the bank, not shuffle().
     *
     * @param  Collection<int, Question>  $pool
     */
    private function questionPoolUsesCelpipTasks(Collection $pool): bool
    {
        return $pool->contains(fn (Question $q) => $q->celpip_task_number !== null && (int) $q->celpip_task_number >= 1);
    }

    private function pickQuestionIdsRespectingImageMinimum(Collection $questionsOrdered, int $cap): array
    {
        $allIds = $questionsOrdered->pluck('id')->values()->all();
        $imageIds = $questionsOrdered
            ->filter(function (Question $q) {
                $u = $q->image_url;

                return is_string($u) && trim($u) !== '';
            })
            ->pluck('id')
            ->shuffle()
            ->values()
            ->all();

        $needFromImage = min(2, count($imageIds), $cap);
        $picked = array_slice($imageIds, 0, $needFromImage);
        $rest = array_values(array_diff($allIds, $picked));
        shuffle($rest);
        $picked = array_merge($picked, array_slice($rest, 0, $cap - count($picked)));
        shuffle($picked);

        return $picked;
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

    /**
     * @param  bool  $includeAuthoringFields  When true (admin viewing an in-progress attempt), include keyed answers and author explanations.
     * @return array<string, mixed>
     */
    private function questionPublic(Question $q, bool $includeAuthoringFields = false): array
    {
        $a = $q->toArray();
        if (! $includeAuthoringFields) {
            unset($a['correct_answer'], $a['explanation']);
        }

        return $a;
    }

    /**
     * Re-read correct_answer / explanation from the questions table so admins always see persisted keys
     * (avoids any relation-cache or serialization quirks on the in-memory Question rows).
     *
     * @param  Collection<int, array<string, mixed>>  $questionsPayload
     * @return Collection<int, array<string, mixed>>
     */
    private function withAdminAuthoringColumnsFromDatabase(Collection $questionsPayload): Collection
    {
        $ids = $questionsPayload->pluck('id')->filter()->map(fn ($id) => (int) $id)->unique()->values()->all();
        if ($ids === []) {
            return $questionsPayload;
        }

        $rows = Question::query()
            ->whereIn('id', $ids)
            ->get(['id', 'correct_answer', 'explanation'])
            ->keyBy('id');

        return $questionsPayload->map(function (array $q) use ($rows) {
            $id = (int) ($q['id'] ?? 0);
            $row = $rows->get($id);
            if (! $row) {
                return $q;
            }
            $q['correct_answer'] = $row->correct_answer;
            $q['explanation'] = $row->explanation;

            return $q;
        });
    }

    private function stripCorrectFromTestForAttempt(Attempt $attempt, Test $test): array
    {
        $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order')]);
        $payload = $test->toArray();
        $payload['questions'] = $attempt->questionsInAttemptOrder()->map(function (Question $q) {
            $a = $q->toArray();
            unset($a['correct_answer']);

            return $a;
        })->values()->all();

        return $payload;
    }

    private function questionIndexInAttempt(Attempt $attempt, int $questionId): ?int
    {
        $attempt->loadMissing(['test.questions' => fn ($q) => $q->orderBy('order')]);
        $ids = $attempt->questionsInAttemptOrder()->pluck('id')->all();
        $pos = array_search($questionId, $ids, true);

        return $pos === false ? null : (int) $pos;
    }
}
