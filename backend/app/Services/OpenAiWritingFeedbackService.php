<?php

namespace App\Services;

use App\Models\Question;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

/**
 * Essay feedback + 0–100 score for BandReady (Pro). Not a real IELTS/CELPIP band score.
 */
class OpenAiWritingFeedbackService
{
    /**
     * @return array{
     *   grading_mode: 'ai',
     *   overall_score_0_100: int,
     *   relevance_score_0_100: int,
     *   task_score_0_100: int,
     *   language_score_0_100: int,
     *   band_estimate: float,
     *   off_topic: bool,
     *   summary: string,
     *   strengths: list<string>,
     *   improvements: list<string>
     * }
     */
    public function evaluateEssay(Question $question, ?string $answer, ?int $userId = null, ?int $attemptId = null): array
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $trimmed = trim((string) $answer);
        if ($trimmed === '') {
            return $this->emptyFeedback();
        }

        $model = (string) config('openai.writing_model', config('openai.model'));
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('openai.writing_timeout', 90);
        $maxTokens = min(4096, (int) config('openai.max_completion_tokens', 4096));

        $prompt = $question->question_text;
        $rubric = trim((string) $question->correct_answer);
        $system = <<<'SYS'
You are an English exam writing tutor. The student answer is for practice only—not a high-stakes exam.

**Primary goal — English skills:** Judge **how they deliver written English**: grammatical range and accuracy, **breadth and precision of vocabulary**, sentence control, clarity, and coherence. That is the **main** basis for marks. Task response, organisation, and addressing the question still matter, but are **secondary** to language quality unless the essay ignores the task or is not a good-faith attempt.

**How to set scores:** `language_score_0_100` is the **anchor** for English quality. `overall_score_0_100` should **follow it closely** when the essay is at least broadly on-task (typically within about 10 points above or below `language_score_0_100`). Pull `overall_score_0_100` clearly lower only for strong off-topic behaviour, empty or copied filler, or almost no substantive answer. `relevance_score_0_100` and `task_score_0_100` inform the picture but must **not** override a strong language profile unless relevance is genuinely poor.

**User-facing wording (mandatory):** In `summary`, `strengths`, and `improvements`, write as a human tutor would. **Do not use the word “prompt” or “prompts”** (it sounds robotic). Use natural alternatives: “the task”, “the question”, “what you were asked”, “the topic”, “this essay”, “the assignment”.

Return a single JSON object with exactly these keys (no markdown):
- "overall_score_0_100" (integer 0–100): holistic quality **led by English delivery** (grammar, vocabulary, clarity, coherence), aligned with `language_score_0_100` as above; reduced if clearly off-topic or not a real attempt.
- "relevance_score_0_100" (integer 0–100): how well the answer addresses the task (low if off-topic or mostly unrelated).
- "task_score_0_100" (integer 0–100): task response / content development (ideas, structure for the genre)—secondary to language for the holistic mark.
- "language_score_0_100" (integer 0–100): vocabulary and grammar control—**main technical pillar** for this practice scoring.
- "band_estimate" (number): approximate IELTS-style band on a 0–9 scale in 0.5 steps (e.g. 6.0, 6.5). Indicative only; **language-weighted**.
- "off_topic" (boolean): true if the answer largely ignores the task or is not a good-faith attempt.
- "summary" (string): 2–4 sentences; prioritise grammar, vocabulary, and clarity; brief note on task fit if useful. **No word “prompt”.**
- "strengths" (array of 2–4 short strings). **No word “prompt”.**
- "improvements" (array of 2–4 short strings). **No word “prompt”.**

Be fair: short but on-topic answers can score moderately if English is solid; empty fluff should not score high. If the text is not English or is nonsensical, score near 0 and explain briefly.
SYS;

        $user = "Task / question the learner answered:\n".mb_substr($prompt, 0, 12000);
        if ($rubric !== '') {
            $user .= "\n\nRubric / model points (for your reference only):\n".mb_substr($rubric, 0, 8000);
        }
        $user .= "\n\nStudent answer:\n".mb_substr($trimmed, 0, (int) config('openai.essay_max_chars', 4000));

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
                Log::warning('OpenAI writing feedback HTTP error', [
                    'status' => $httpResponse->status(),
                    'body' => $httpResponse->body(),
                ]);
                throw new InvalidArgumentException('OpenAI API error: HTTP '.$httpResponse->status());
            }

            $content = data_get($httpResponse->json(), 'choices.0.message.content');
            if (! is_string($content) || $content === '') {
                throw new InvalidArgumentException('OpenAI returned an empty writing feedback response.');
            }

            $decoded = json_decode($content, true);
            if (! is_array($decoded)) {
                throw new InvalidArgumentException('OpenAI returned invalid JSON for writing feedback.');
            }

            return $this->normalizeFeedback($decoded);
        } catch (\Throwable $e) {
            $caught = $e;
            throw $e;
        } finally {
            $contextRef = $attemptId !== null ? 'attempt:'.$attemptId.',q:'.$question->id : 'q:'.$question->id;
            app(OpenAiActivityLogger::class)->recordChatCompletion(
                'writing_feedback',
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
        ];
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
            'summary' => 'No answer was submitted for this task.',
            'strengths' => [],
            'improvements' => ['Write a response that addresses the task.'],
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
        // Rough map: 0–100 → 0–9 (indicative only)
        return round(($overall / 100) * 9 * 2) / 2;
    }

    private function clamp(float|int $n, float|int $min, float|int $max): float
    {
        return max((float) $min, min((float) $max, (float) $n));
    }
}
