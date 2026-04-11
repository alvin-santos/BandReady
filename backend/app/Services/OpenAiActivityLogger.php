<?php

namespace App\Services;

use App\Models\OpenaiActivityLog;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Persists OpenAI HTTP calls for usage transparency (request/response bodies + token usage).
 */
class OpenAiActivityLogger
{
    public function recordChatCompletion(
        string $contextType,
        ?int $userId,
        ?string $contextRef,
        string $endpoint,
        array $requestPayload,
        ?Response $response,
        float $durationMs,
        ?Throwable $failure = null,
    ): void {
        if (! (bool) config('openai.log_activity', true)) {
            return;
        }

        try {
            $httpStatus = $response?->status();
            $model = isset($requestPayload['model']) ? (string) $requestPayload['model'] : null;

            $responsePayload = null;
            if ($response !== null) {
                $json = $response->json();
                $responsePayload = is_array($json) ? $json : ['_raw' => $response->body()];
            }

            $success = $failure === null
                && $response !== null
                && $response->successful();

            $errorMessage = $failure?->getMessage();
            if ($errorMessage === null && $response !== null && ! $response->successful()) {
                $errorMessage = 'HTTP '.$response->status();
                $body = $response->body();
                if ($body !== '' && strlen($body) < 2000) {
                    $errorMessage .= ' — '.$body;
                }
            }

            $promptTokens = null;
            $completionTokens = null;
            $totalTokens = null;
            if (is_array($responsePayload) && isset($responsePayload['usage']) && is_array($responsePayload['usage'])) {
                $u = $responsePayload['usage'];
                $promptTokens = isset($u['prompt_tokens']) ? (int) $u['prompt_tokens'] : null;
                $completionTokens = isset($u['completion_tokens']) ? (int) $u['completion_tokens'] : null;
                $totalTokens = isset($u['total_tokens']) ? (int) $u['total_tokens'] : null;
            }

            OpenaiActivityLog::query()->create([
                'user_id' => $userId,
                'context_type' => $contextType,
                'context_ref' => $contextRef,
                'endpoint' => mb_substr($endpoint, 0, 512),
                'model' => $model,
                'http_status' => $httpStatus,
                'success' => $success,
                'error_message' => $errorMessage !== '' ? $errorMessage : null,
                'prompt_tokens' => $promptTokens,
                'completion_tokens' => $completionTokens,
                'total_tokens' => $totalTokens,
                'duration_ms' => (int) round($durationMs),
                'request_payload' => $requestPayload,
                'response_payload' => $responsePayload,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to persist OpenAI activity log', [
                'context_type' => $contextType,
                'message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Whisper / audio transcriptions: request payload excludes raw bytes (file meta only).
     */
    public function recordSpeechTranscription(
        ?int $userId,
        ?string $contextRef,
        string $endpoint,
        array $requestMeta,
        ?Response $response,
        float $durationMs,
        ?Throwable $failure = null,
    ): void {
        if (! (bool) config('openai.log_activity', true)) {
            return;
        }

        try {
            $httpStatus = $response?->status();
            $model = isset($requestMeta['model']) ? (string) $requestMeta['model'] : null;

            $responsePayload = null;
            if ($response !== null) {
                $json = $response->json();
                $responsePayload = is_array($json) ? $json : ['_raw' => $response->body()];
            }

            $success = $failure === null
                && $response !== null
                && $response->successful();

            $errorMessage = $failure?->getMessage();
            if ($errorMessage === null && $response !== null && ! $response->successful()) {
                $errorMessage = 'HTTP '.$response->status();
                $body = $response->body();
                if ($body !== '' && strlen($body) < 2000) {
                    $errorMessage .= ' — '.$body;
                }
            }

            OpenaiActivityLog::query()->create([
                'user_id' => $userId,
                'context_type' => 'speech_to_text',
                'context_ref' => $contextRef,
                'endpoint' => mb_substr($endpoint, 0, 512),
                'model' => $model,
                'http_status' => $httpStatus,
                'success' => $success,
                'error_message' => $errorMessage !== '' ? $errorMessage : null,
                'prompt_tokens' => null,
                'completion_tokens' => null,
                'total_tokens' => null,
                'duration_ms' => (int) round($durationMs),
                'request_payload' => $requestMeta,
                'response_payload' => $responsePayload,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to persist OpenAI speech transcription log', [
                'message' => $e->getMessage(),
            ]);
        }
    }
}
