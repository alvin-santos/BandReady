<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use Throwable;

class OpenAiSpeechToTextService
{
    public function transcribe(UploadedFile $file, ?int $userId, string $contextRef): string
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $model = (string) config('openai.whisper_model', 'whisper-1');
        $url = rtrim((string) config('openai.base_url', 'https://api.openai.com/v1'), '/').'/audio/transcriptions';
        $timeout = (int) config('openai.whisper_timeout', 120);

        $contents = $file->get();
        $original = $file->getClientOriginalName() ?: 'audio.webm';
        $mime = $file->getMimeType() ?: 'application/octet-stream';
        $size = $file->getSize();

        $requestMeta = [
            'model' => $model,
            'original_filename' => $original,
            'size_bytes' => $size,
            'mime' => $mime,
        ];

        $startedAt = microtime(true);
        $response = null;
        $caught = null;

        try {
            $response = Http::withToken($key)
                ->timeout($timeout)
                ->attach('file', $contents, $original)
                ->post($url, [
                    'model' => $model,
                    'language' => 'en',
                    'response_format' => 'json',
                ]);

            if (! $response->successful()) {
                Log::warning('OpenAI Whisper HTTP error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                throw new InvalidArgumentException('Speech-to-text failed: HTTP '.$response->status());
            }

            $text = $response->json('text');
            if (! is_string($text)) {
                $text = trim((string) data_get($response->json(), 'text'));
            }
            if ($text === '') {
                throw new InvalidArgumentException('Speech-to-text returned empty text.');
            }

            return trim($text);
        } catch (Throwable $e) {
            $caught = $e;
            throw $e;
        } finally {
            /** @var OpenAiActivityLogger $logger */
            $logger = app(OpenAiActivityLogger::class);
            $logger->recordSpeechTranscription(
                $userId,
                $contextRef,
                $url,
                $requestMeta,
                $response,
                (microtime(true) - $startedAt) * 1000,
                $caught,
            );
        }
    }
}
