<?php

namespace App\Services;

use App\Models\Question;
use App\Support\IeltsAiSpeaking;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

/**
 * Feedback on a speaking-task transcript (Pro). Pronunciation is not observed—only the text from STT.
 */
class OpenAiSpeakingFeedbackService
{
    /**
     * @return array<string, mixed>
     */
    public function evaluateSpeaking(Question $question, ?string $transcript, ?int $userId = null, ?int $attemptId = null): array
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $trimmed = trim((string) $transcript);
        if ($trimmed === '') {
            return $this->emptyFeedback();
        }

        $model = (string) config('openai.speaking_model', config('openai.writing_model', config('openai.model')));
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('openai.speaking_feedback_timeout', 90);
        $maxTokens = min(4096, (int) config('openai.max_completion_tokens', 4096));
        $maxChars = IeltsAiSpeaking::isAiConversationQuestion($question)
            ? (int) config('openai.speaking_conversation_max_chars', 16000)
            : (int) config('openai.speaking_max_chars', 4000);

        $prompt = $question->question_text;
        $rubric = trim((string) $question->correct_answer);
        $visual = $this->formatSpeakingVisualContext($question);
        $isAiInterview = IeltsAiSpeaking::isAiConversationQuestion($question);
        $system = <<<'SYS'
You are an English exam speaking tutor. The student response is an automatic **speech-to-text transcript** of what they said in a practice app—not a high-stakes exam. You cannot hear audio; do not claim to judge pronunciation or accent.

**Primary goal — English skills:** Judge **how they deliver English in the transcript**: grammatical accuracy and control, **range and precision of vocabulary**, clarity, coherence, and how naturally ideas are linked. That is the **main** basis for marks. Task fit, structure, and relevance are still useful, but **secondary** to language quality unless the answer ignores the task entirely.

**Topic / picture tasks:** If the task involves describing a scene or image, the transcript should stay **reasonably on topic** (the scenario and what they were asked to do). Do **not** treat scoring as “how many objects from the image they named.” A fluent, grammatical answer that addresses the situation appropriately can score well even if it omits minor visual details. Reserve low relevance or off_topic only for answers that ignore the task, are largely unrelated, or are not a good-faith attempt.

**How to set scores:** `language_score_0_100` is the **anchor** for English quality. `overall_score_0_100` should **follow it closely** when the response is at least broadly on-task (typically within about 10 points above or below `language_score_0_100`). Pull `overall_score_0_100` clearly lower only for strong off-topic behaviour, not a good-faith attempt, or almost no substantive content. `relevance_score_0_100` and `task_score_0_100` inform the picture but must **not** override a strong language profile unless relevance is genuinely poor.

**User-facing wording (mandatory):** In `summary`, `strengths`, and `improvements`, write as a human tutor would. **Do not use the word “prompt” or “prompts”** (it sounds robotic). Use natural alternatives: “the task”, “the question”, “what you were asked”, “the topic”, “this speaking item”, “the scenario”.

Return a single JSON object with exactly these keys (no markdown):
- "overall_score_0_100" (integer 0–100): holistic quality **led by English delivery** (grammar, vocabulary, clarity, coherence), aligned with `language_score_0_100` as above; reduced if clearly off-topic or not a real attempt.
- "relevance_score_0_100" (integer 0–100): whether the answer fits the task and scenario **in a broad sense**—on-topic and responsive—not pixel-perfect description accuracy.
- "task_score_0_100" (integer 0–100): development and structure of ideas appropriate for a spoken answer (flow, elaboration), from text—secondary to language for the holistic mark.
- "language_score_0_100" (integer 0–100): vocabulary and grammar in the transcript—**main technical pillar** for this practice scoring.
- "band_estimate" (number): approximate IELTS-style speaking band on 0–9 in 0.5 steps, indicative only from text (**language-weighted**).
- "off_topic" (boolean): true only if the transcript largely ignores the task/scenario or is not a good-faith attempt—not merely because every detail of a scene was not listed.
- "summary" (string): 2–4 sentences; prioritise grammar, vocabulary, and clarity; brief note on topic fit if useful. **No word “prompt”.**
- "strengths" (array of 2–4 short strings). **No word “prompt”.**
- "improvements" (array of 2–4 short strings). **No word “prompt”.**
- "content_policy_violation" (boolean): true only if **candidate / learner words** in the transcript contain slurs, severe profanity used as abuse or insult, hate, threats, or are obvious disruptive spam with no good-faith attempt at the speaking task. Must be **false** for weak English, civil off-topic answers, fillers, or normal mistakes.
- "content_policy_category" (string): exactly one of "none", "profanity", "harassment", "disruptive". Use "none" when content_policy_violation is false.

If the transcript is gibberish or not English, score near 0 and explain briefly. Still set content_policy_violation to false unless it is also abusive as above.
SYS;

        $user = "Task / question the learner answered:\n".mb_substr($prompt, 0, 12000);
        if ($visual !== '') {
            $user .= "\n\n".$visual;
        }
        if ($rubric !== '') {
            $user .= "\n\nRubric / model points (for your reference only):\n".mb_substr($rubric, 0, 8000);
        }
        if ($isAiInterview) {
            $user .= "\n\nContext: This was a **full IELTS-style AI mock interview** (Parts 1–3). The transcript includes examiner lines and the candidate’s turns (from speech-to-text). Grade the candidate’s English **across all candidate turns**. For **content_policy_violation**, judge **only the candidate’s** words, not the examiner script.";
        }
        $transcriptBody = $isAiInterview
            ? $this->flattenStoredIeltsAiTranscript($trimmed, $maxChars)
            : mb_substr($trimmed, 0, $maxChars);
        $user .= "\n\nTranscript (from speech recognition):\n".$transcriptBody;

        $requestPayload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ],
            'response_format' => ['type' => 'json_object'],
            'max_completion_tokens' => $maxTokens,
        ];

        $startedAt = microtime(true);
        $httpResponse = null;
        $caught = null;

        try {
            $httpResponse = Http::withToken($key)
                ->timeout($timeout)
                ->acceptJson()
                ->post($url, $requestPayload);

            if (! $httpResponse->successful()) {
                Log::warning('OpenAI speaking feedback HTTP error', [
                    'status' => $httpResponse->status(),
                    'body' => $httpResponse->body(),
                ]);
                throw new InvalidArgumentException('OpenAI API error: HTTP '.$httpResponse->status());
            }

            $content = data_get($httpResponse->json(), 'choices.0.message.content');
            if (! is_string($content) || $content === '') {
                throw new InvalidArgumentException('OpenAI returned an empty speaking feedback response.');
            }

            $decoded = json_decode($content, true);
            if (! is_array($decoded)) {
                throw new InvalidArgumentException('OpenAI returned invalid JSON for speaking feedback.');
            }

            return $this->normalizeFeedback($decoded);
        } catch (\Throwable $e) {
            $caught = $e;
            throw $e;
        } finally {
            $contextRef = $attemptId !== null ? 'attempt:'.$attemptId.',q:'.$question->id : 'q:'.$question->id;
            app(OpenAiActivityLogger::class)->recordChatCompletion(
                'speaking_feedback',
                $userId,
                $contextRef,
                $url,
                $requestPayload,
                $httpResponse,
                (microtime(true) - $startedAt) * 1000,
                $caught,
            );
        }
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    private function normalizeFeedback(array $raw): array
    {
        $overall = (int) round($this->clamp($raw['overall_score_0_100'] ?? 0, 0, 100));
        $rel = (int) round($this->clamp($raw['relevance_score_0_100'] ?? $overall, 0, 100));
        $task = (int) round($this->clamp($raw['task_score_0_100'] ?? $overall, 0, 100));
        $lang = (int) round($this->clamp($raw['language_score_0_100'] ?? $overall, 0, 100));
        $off = (bool) ($raw['off_topic'] ?? false);
        if ($off) {
            $overall = min($overall, 40);
        }

        $band = isset($raw['band_estimate']) ? (float) $raw['band_estimate'] : $this->scoreToBand($overall);
        $band = round($band * 2) / 2;
        $band = $this->clamp($band, 0, 9);

        $strengths = $raw['strengths'] ?? [];
        $improvements = $raw['improvements'] ?? [];
        if (! is_array($strengths)) {
            $strengths = [];
        }
        if (! is_array($improvements)) {
            $improvements = [];
        }
        $strengths = array_values(array_filter(array_map('strval', $strengths)));
        $improvements = array_values(array_filter(array_map('strval', $improvements)));
        $strengths = array_slice($strengths, 0, 4);
        $improvements = array_slice($improvements, 0, 4);

        $summary = $this->sanitizeUserFacingFeedbackText(trim((string) ($raw['summary'] ?? '')));
        if ($summary === '') {
            $summary = 'See strengths and improvements below.';
        }
        $strengths = array_map(fn (string $s) => $this->sanitizeUserFacingFeedbackText($s), $strengths);
        $improvements = array_map(fn (string $s) => $this->sanitizeUserFacingFeedbackText($s), $improvements);

        $policyV = (bool) ($raw['content_policy_violation'] ?? false);
        $policyCat = strtolower(trim((string) ($raw['content_policy_category'] ?? 'none')));
        if (! in_array($policyCat, ['none', 'profanity', 'harassment', 'disruptive'], true)) {
            $policyCat = $policyV ? 'disruptive' : 'none';
        }
        if (! $policyV) {
            $policyCat = 'none';
        }

        return [
            'grading_mode' => 'ai',
            'overall_score_0_100' => $overall,
            'relevance_score_0_100' => $rel,
            'task_score_0_100' => $task,
            'language_score_0_100' => $lang,
            'band_estimate' => $band,
            'off_topic' => $off,
            'summary' => $summary,
            'strengths' => $strengths,
            'improvements' => $improvements,
            'content_policy_violation' => $policyV,
            'content_policy_category' => $policyCat,
        ];
    }

    private function flattenStoredIeltsAiTranscript(string $stored, int $maxChars): string
    {
        $decoded = json_decode($stored, true);
        if (! is_array($decoded) || ! isset($decoded['exchanges']) || ! is_array($decoded['exchanges'])) {
            return mb_substr($stored, 0, $maxChars);
        }
        $lines = [];
        foreach ($decoded['exchanges'] as $ex) {
            if (! is_array($ex)) {
                continue;
            }
            $role = (($ex['role'] ?? '') === 'candidate') ? 'Candidate' : 'Examiner';
            $t = trim((string) ($ex['text'] ?? ''));
            if ($t !== '') {
                $lines[] = $role.': '.$t;
            }
        }

        return mb_substr(implode("\n\n", $lines), 0, $maxChars);
    }

    private function formatSpeakingVisualContext(Question $question): string
    {
        $opts = $question->options_json;
        if (! is_array($opts)) {
            $opts = [];
        }
        $speaking = isset($opts['speaking']) && is_array($opts['speaking']) ? $opts['speaking'] : [];
        $mode = isset($speaking['celpip_mode']) && is_string($speaking['celpip_mode']) ? $speaking['celpip_mode'] : '';
        $lines = [];
        if ($question->image_url) {
            $lines[] = 'The task included an on-screen image (AI-generated for practice). You cannot see the image. Use the reference below only to check **broad topical fit**—whether the speaker is clearly discussing the intended situation—not to score how completely they inventory every visual detail.';
            if ($mode === 'scenario') {
                $lines[] = 'Task style: scenario (e.g. describing to someone on the phone)—reward natural, coherent English that fits the role; do not require exhaustive object lists.';
            } elseif ($mode === 'describe') {
                $lines[] = 'Task style: describe the scene—reward clear English and on-topic description, not a checklist of every item in the picture.';
            }
            $genPrompt = isset($speaking['image_generation_prompt']) && is_string($speaking['image_generation_prompt'])
                ? trim($speaking['image_generation_prompt'])
                : '';
            if ($genPrompt !== '') {
                $lines[] = 'Scene brief (topic context only): '.mb_substr($genPrompt, 0, 1500);
            }
            $ctx = isset($speaking['image_context']) && is_string($speaking['image_context']) ? trim($speaking['image_context']) : '';
            if ($ctx !== '') {
                $lines[] = 'Optional topic anchors (not a required checklist): '.mb_substr($ctx, 0, 1200);
            }
        }

        return $lines === [] ? '' : implode("\n", $lines);
    }

    private function emptyFeedback(): array
    {
        return [
            'grading_mode' => 'ai',
            'overall_score_0_100' => 0,
            'relevance_score_0_100' => 0,
            'task_score_0_100' => 0,
            'language_score_0_100' => 0,
            'band_estimate' => 0.0,
            'off_topic' => true,
            'summary' => 'No transcript was available for this task.',
            'strengths' => [],
            'improvements' => ['Record again with a clear spoken answer to the task.'],
            'content_policy_violation' => false,
            'content_policy_category' => 'none',
        ];
    }

    /**
     * Replace wording that sounds template-generated; keep feedback natural for learners.
     */
    private function sanitizeUserFacingFeedbackText(string $text): string
    {
        if ($text === '') {
            return '';
        }
        $out = preg_replace('/\bprompts\b/i', 'tasks', $text) ?? $text;
        $out = preg_replace('/\bprompt\b/i', 'task', $out) ?? $out;

        return $out;
    }

    private function scoreToBand(int $overall): float
    {
        return round(($overall / 100) * 9 * 2) / 2;
    }

    private function clamp(float|int $n, float|int $min, float|int $max): float
    {
        return max((float) $min, min((float) $max, (float) $n));
    }
}
