<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Lightweight classifier for foul / abusive / disruptive speaking transcripts (IELTS AI turns).
 */
final class OpenAiSpeakingModerationService
{
    public const PREP_MARKER = '[PREPARATION_TIME_COMPLETE]';

    /**
     * @return array{violation: bool, category: string}
     */
    public function screenCandidateText(string $text, ?int $userId, string $contextRef): array
    {
        $trimmed = trim($text);
        if ($trimmed === '' || $trimmed === self::PREP_MARKER || mb_strlen($trimmed) < 2) {
            return ['violation' => false, 'category' => 'none'];
        }

        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            Log::warning('OpenAI speaking moderation skipped: no API key', ['context_ref' => $contextRef]);

            return ['violation' => false, 'category' => 'none'];
        }

        $model = (string) config('openai.speaking_moderation_model', config('openai.model'));
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('openai.speaking_moderation_timeout', 20);
        $maxChars = (int) config('openai.speaking_moderation_max_chars', 4000);
        $body = mb_substr($trimmed, 0, $maxChars);

        $system = <<<'SYS'
You are a content moderator for an English exam practice app. The text is a speech-to-text transcript of one learner reply in an IELTS-style speaking interview.

Return a single JSON object (no markdown) with exactly:
- "violation" (boolean): true only for clear policy breaks: slurs, hate, sexual harassment or graphic insults directed at people, threats, or deliberate disruptive spam/gibberish that is obviously not a genuine exam attempt.
- "category" (string): one of "none", "profanity", "harassment", "disruptive".

violation MUST be false for: weak English, short answers, polite off-topic replies, normal fillers ("um", "I don't know"), frustration expressed without slurs, or non-native mistakes.
SYS;

        $requestPayload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => "Candidate reply transcript:\n".$body],
            ],
            'response_format' => ['type' => 'json_object'],
            'max_completion_tokens' => 80,
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
                Log::warning('OpenAI speaking moderation HTTP error', [
                    'status' => $httpResponse->status(),
                    'context_ref' => $contextRef,
                ]);

                return ['violation' => false, 'category' => 'none'];
            }

            $content = data_get($httpResponse->json(), 'choices.0.message.content');
            if (! is_string($content) || $content === '') {
                return ['violation' => false, 'category' => 'none'];
            }

            $decoded = json_decode($content, true);
            if (! is_array($decoded)) {
                return ['violation' => false, 'category' => 'none'];
            }

            $violation = (bool) ($decoded['violation'] ?? false);
            $cat = strtolower(trim((string) ($decoded['category'] ?? 'none')));
            if (! in_array($cat, ['none', 'profanity', 'harassment', 'disruptive'], true)) {
                $cat = $violation ? 'disruptive' : 'none';
            }
            if (! $violation) {
                $cat = 'none';
            }

            return ['violation' => $violation, 'category' => $cat];
        } catch (\Throwable $e) {
            $caught = $e;
            Log::warning('OpenAI speaking moderation failed', [
                'context_ref' => $contextRef,
                'error' => $e->getMessage(),
            ]);

            return ['violation' => false, 'category' => 'none'];
        } finally {
            app(OpenAiActivityLogger::class)->recordChatCompletion(
                'speaking_moderation',
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
}
