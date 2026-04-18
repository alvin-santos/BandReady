<?php

namespace App\Services;

use App\Models\InterviewPracticeSession;
use App\Support\InterviewPracticePrompts;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAiInterviewPracticeFeedbackService
{
    /**
     * OpenAI-generated post-session assessment from the full transcript (STT text only).
     *
     * @param  \Illuminate\Support\Collection<int, \App\Models\InterviewPracticeMessage>  $messages
     * @return array<string, mixed>
     */
    public function scoreSession(InterviewPracticeSession $session, $messages): array
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            Log::warning('OpenAI interview feedback skipped: no API key');

            return array_merge($this->fallbackFeedback(), [
                'summary' => 'Assessment was skipped because OPENAI_API_KEY is not configured on the server.',
            ]);
        }

        $model = (string) config('openai.interview_feedback_model', config('openai.speaking_model', config('openai.model')));
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('openai.interview_feedback_timeout', 120);
        $maxTokens = min(
            4096,
            (int) config('openai.interview_feedback_max_completion_tokens', 2048),
            (int) config('openai.max_completion_tokens', 4096)
        );

        $typeLabel = InterviewPracticePrompts::typeLabel((string) $session->interview_type);
        $lines = [];
        foreach ($messages as $m) {
            $tag = $m->role === 'ai' ? 'Interviewer (Bandie)' : 'Candidate';
            $lines[] = $tag.': '.$m->body;
        }
        $transcript = implode("\n\n", $lines);

        $system = <<<'SYS'
You are an expert interview coach. The transcript is from a **mock voice interview** in a practice app: candidate lines are **automatic speech-to-text** (may contain errors). You cannot hear audio — judge only from the text.

Your job is to **assess and score** the candidate’s practice performance for this interview type and difficulty. This is **not** a real employer decision and **not** an official exam score.

Return a **single JSON object** (no markdown) with exactly these keys:
- "overall_score_0_100" (integer 0–100): holistic practice performance.
- "relevance_0_100" (integer 0–100): how well answers addressed the interviewer’s questions and the scenario.
- "communication_0_100" (integer 0–100): clarity, coherence, professional tone, and logical flow in the transcript.
- "substance_0_100" (integer 0–100): depth, examples, specificity, and structure of ideas.
- "summary" (string): 2–4 sentences — encouraging but honest.
- "strengths" (array of 2–5 short strings).
- "improvements" (array of 2–5 short actionable strings).
- "speaking_pace_note" (string or null): one sentence about pacing/clarity **only if** the transcript suggests rushed or very sparse answers; else null.

Calibration: align expectations with the stated **difficulty** (easy = be generous; hard = be demanding). Be fair to non-native English. Do not claim you judged pronunciation or accent.
SYS;

        $difficulty = (string) $session->difficulty;
        $custom = trim((string) ($session->custom_role ?? ''));
        $roleLine = $custom !== '' ? "Custom role context: {$custom}\n" : '';

        $user = <<<USR
Interview type: {$typeLabel}
Difficulty: {$difficulty}
{$roleLine}
Full transcript (chronological):

{$transcript}
USR;

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

        $out = [
            'feedback_source' => 'openai',
            'model_used' => $model,
            'overall_score_0_100' => $this->clampInt($decoded['overall_score_0_100'] ?? 0),
            'relevance_0_100' => array_key_exists('relevance_0_100', $decoded) ? $this->clampInt($decoded['relevance_0_100']) : null,
            'communication_0_100' => array_key_exists('communication_0_100', $decoded) ? $this->clampInt($decoded['communication_0_100']) : null,
            'substance_0_100' => array_key_exists('substance_0_100', $decoded) ? $this->clampInt($decoded['substance_0_100']) : null,
            'summary' => trim((string) ($decoded['summary'] ?? '')),
            'strengths' => [],
            'improvements' => [],
            'speaking_pace_note' => null,
        ];

        if ($out['summary'] === '') {
            $out['summary'] = 'Thanks for practicing — keep building specificity and examples in your answers.';
        }

        $strengths = $decoded['strengths'] ?? [];
        $improvements = $decoded['improvements'] ?? [];
        if (! is_array($strengths)) {
            $strengths = [];
        }
        if (! is_array($improvements)) {
            $improvements = [];
        }

        $out['strengths'] = array_slice(
            array_values(array_filter(array_map(fn ($s) => trim((string) $s), $strengths))),
            0,
            6
        );
        $out['improvements'] = array_slice(
            array_values(array_filter(array_map(fn ($s) => trim((string) $s), $improvements))),
            0,
            6
        );

        $pace = $decoded['speaking_pace_note'] ?? null;
        $out['speaking_pace_note'] = is_string($pace) && trim($pace) !== '' ? trim($pace) : null;

        return $out;
    }

    private function clampInt(mixed $v): int
    {
        $n = (int) $v;

        return max(0, min(100, $n));
    }

    /**
     * @return array<string, mixed>
     */
    private function fallbackFeedback(): array
    {
        return [
            'feedback_source' => 'unavailable',
            'model_used' => null,
            'overall_score_0_100' => 0,
            'relevance_0_100' => null,
            'communication_0_100' => null,
            'substance_0_100' => null,
            'summary' => 'OpenAI could not generate assessment this time (network or API issue). Your session is still saved — try ending the session again in a moment, or check OPENAI_API_KEY.',
            'strengths' => [],
            'improvements' => [],
            'speaking_pace_note' => null,
        ];
    }
}
