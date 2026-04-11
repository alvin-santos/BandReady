<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Generates a scene image via OpenAI Images API, stores it on the public disk, returns a URL path for clients.
 */
class OpenAiImageGenerationService
{
    /**
     * Prefix applied to admin prompts to reduce policy issues (exam-style illustration).
     */
    private const STYLE_PREFIX = 'Educational exam practice illustration, clean realistic style, no text overlays, no logos, no recognizable real people or celebrities: ';

    /**
     * @return array{path: string, public_url: string, revised_prompt?: string}
     */
    public function generateAndStore(string $userPrompt): array
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $trimmed = trim($userPrompt);
        if ($trimmed === '') {
            throw new InvalidArgumentException('Image prompt is empty.');
        }

        $model = (string) config('openai.image_model', 'dall-e-3');
        $size = (string) config('openai.image_size', '1024x1024');
        $timeout = (int) config('openai.image_timeout', 120);
        $baseUrl = rtrim((string) config('openai.base_url'), '/');

        $fullPrompt = self::STYLE_PREFIX.$trimmed;

        $response = Http::withToken($key)
            ->timeout($timeout)
            ->acceptJson()
            ->post($baseUrl.'/images/generations', [
                'model' => $model,
                'prompt' => mb_substr($fullPrompt, 0, 4000),
                'n' => 1,
                'size' => $size,
            ]);

        if (! $response->successful()) {
            $body = $response->json();
            $msg = is_array($body) ? ($body['error']['message'] ?? $response->body()) : $response->body();
            Log::warning('OpenAI image generation failed', ['status' => $response->status(), 'body' => $body]);
            throw new InvalidArgumentException('Image generation failed: '.Str::limit((string) $msg, 500));
        }

        $data = $response->json('data');
        if (! is_array($data) || ! isset($data[0]['url'])) {
            throw new InvalidArgumentException('Unexpected image API response.');
        }

        $remoteUrl = $data[0]['url'];
        $revised = isset($data[0]['revised_prompt']) ? (string) $data[0]['revised_prompt'] : null;

        $bin = Http::timeout($timeout)->get($remoteUrl);
        if (! $bin->successful()) {
            throw new InvalidArgumentException('Could not download generated image.');
        }

        $ext = 'png';
        $ct = $bin->header('Content-Type');
        if (is_string($ct) && str_contains($ct, 'jpeg')) {
            $ext = 'jpg';
        }

        $name = 'question-images/'.Str::uuid().'.'.$ext;
        Storage::disk('public')->put($name, $bin->body());

        $publicUrl = Storage::disk('public')->url($name);

        return [
            'path' => $name,
            'public_url' => $publicUrl,
            'revised_prompt' => $revised,
        ];
    }

    /**
     * Short reference for AI speaking feedback (what the scene is about), without vision API.
     *
     * @return string non-empty or empty string on failure
     */
    public function describeSceneForGrader(string $imagePrompt): string
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            return '';
        }

        $model = (string) config('openai.model', 'gpt-4o-mini');
        $baseUrl = rtrim((string) config('openai.base_url'), '/');
        $timeout = min(60, (int) config('openai.timeout', 180));

        $system = 'You help ESL exam graders. Given a short image-generation prompt for a speaking test, output 3–6 short phrases (comma-separated) listing concrete things a candidate might mention when describing the scene. No full sentences. Max 400 characters.';

        try {
            $response = Http::withToken($key)
                ->timeout($timeout)
                ->acceptJson()
                ->post($baseUrl.'/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => mb_substr(trim($imagePrompt), 0, 2000)],
                    ],
                    'max_completion_tokens' => 300,
                ]);

            if (! $response->successful()) {
                return '';
            }

            $text = $response->json('choices.0.message.content');

            return is_string($text) ? trim(mb_substr($text, 0, 800)) : '';
        } catch (\Throwable) {
            return '';
        }
    }
}
