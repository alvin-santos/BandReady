<?php

namespace App\Services;

use App\Models\InterviewPracticeSession;
use App\Support\InterviewPracticePrompts;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class OpenAiInterviewPracticeFeedbackService
{
    /**
     * @param  \Illuminate\Support\Collection<int, \App\Models\InterviewPracticeMessage>  $messages
     * @return array{
     *   overall_score_0_100: int,
     *   summary: string,
     *   strengths: list<string>,
     *   improvements: list<string>,
     *   speaking_pace_note: string|null
     * }
     */
    public function scoreSession(InterviewPracticeSession $session, $messages): array
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $model = (string) config('openai.speaking_model', config('openai.model'));
        $url = config('openai.base_url').'/chat/completions';
        $timeout = min(120, (int) config('interview_practice.openai_timeout', 75) + 30);
        $maxTokens = min(1200, (int) config('openai.max_completion_tokens', 4096));

        $typeLabel = InterviewPracticePrompts::typeLabel((string) $session->interview_type);
        $lines = [];
        foreach ($messages as $m) {
            $tag = $m->role === 'ai' ? 'Interviewer' : 'Candidate';
            $lines[] = $tag.': '.$m->body;
        }
        $transcript = implode("\n\n", $lines);

        $system = <<<'SYS'
You review a **mock voice interview** transcript (candidate text came from speech recognition). You cannot hear audio.

Return a single JSON object (no markdown) with exactly:
- "overall_score_0_100" (integer 0–100): holistic practice performance vs the interview type (not a real employer score).
- "summary" (string): 2–4 sentences of encouragement + honest overview.
- "strengths" (array of 2–4 short strings).
- "improvements" (array of 2–4 short actionable strings).
- "speaking_pace_note" (string or null): one sentence hint about pacing/clarity if evident from transcript; else null.

Be fair to non-native English. Do not claim you heard pronunciation.
SYS;

        $user = "Interview type: {$typeLabel}\nDifficulty: {$session->difficulty}\n\nTranscript:\n".$transcript;

        $response = Http::withToken($key)
            ->timeout($timeout)
            ->acceptJson()
            ->post($url, [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $system],
                    ['role' => 'user', 'content' => $user],
                ],
                'response_format' => ['type' => 'json_object'],
                'max_completion_tokens' => $maxTokens,
            ]);

        if (! $response->successful()) {
            Log::warning('OpenAI interview feedback HTTP error', [
                'status' => $response->status(),
            ]);

            return $this->fallbackFeedback();
        }

        $content = data_get($response->json(), 'choices.0.message.content');
        if (! is_string($content) || trim($content) === '') {
            return $this->fallbackFeedback();
        }

        $decoded = json_decode($content, true);
        if (! is_array($decoded)) {
            return $this->fallbackFeedback();
        }

        $score = (int) ($decoded['overall_score_0_100'] ?? 0);
        $score = max(0, min(100, $score));
        $summary = trim((string) ($decoded['summary'] ?? ''));
        if ($summary === '') {
            $summary = 'Thanks for practicing — keep building specificity and examples in your answers.';
        }

        $strengths = $decoded['strengths'] ?? [];
        $improvements = $decoded['improvements'] ?? [];
        if (! is_array($strengths)) {
            $strengths = [];
        }
        if (! is_array($improvements)) {
            $improvements = [];
        }

        $strengths = array_values(array_filter(array_map(fn ($s) => trim((string) $s), $strengths)));
        $improvements = array_values(array_filter(array_map(fn ($s) => trim((string) $s), $improvements)));

        $pace = $decoded['speaking_pace_note'] ?? null;
        $pace = is_string($pace) && trim($pace) !== '' ? trim($pace) : null;

        return [
            'overall_score_0_100' => $score,
            'summary' => $summary,
            'strengths' => array_slice($strengths, 0, 6),
            'improvements' => array_slice($improvements, 0, 6),
            'speaking_pace_note' => $pace,
        ];
    }

    /**
     * @return array{
     *   overall_score_0_100: int,
     *   summary: string,
     *   strengths: list<string>,
     *   improvements: list<string>,
     *   speaking_pace_note: string|null
     * }
     */
    private function fallbackFeedback(): array
    {
        return [
            'overall_score_0_100' => 0,
            'summary' => 'We could not generate detailed AI feedback this time, but your session was saved. Try again in a moment.',
            'strengths' => [],
            'improvements' => [],
            'speaking_pace_note' => null,
        ];
    }
}
