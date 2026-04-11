<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Generates a scene image via OpenAI Images API, stores it on the configured disk (R2 or public), returns a URL for clients.
 */
class OpenAiImageGenerationService
{
    /**
     * Prefix applied to admin prompts to reduce policy issues (exam-style illustration).
     */
    private const STYLE_PREFIX = 'Educational exam practice illustration, clean realistic style, no text overlays, no logos, no recognizable real people or celebrities: ';

    /**
     * @return array{path: string, public_url: string, disk: string, revised_prompt?: string}
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

        $diskName = (string) config('openai.speaking_image_disk', 'public');
        $prefix = trim((string) config('openai.speaking_image_path_prefix', 'speaking-question-images'), '/');
        $dir = $prefix !== '' ? $prefix.'/' : '';
        $name = $dir.Str::uuid().'.'.$ext;

        $disk = Storage::disk($diskName);
        $disk->put($name, $bin->body());

        $publicUrl = $this->publicUrlForObject($diskName, $name);

        return [
            'path' => $name,
            'public_url' => $publicUrl,
            'disk' => $diskName,
            'revised_prompt' => $revised,
        ];
    }

    /**
     * Browser URL for a stored object (R2 includes /{bucket}/ when configured for *.r2.dev public URLs).
     */
    public function publicUrlForObject(string $diskName, string $objectKey): string
    {
        if ($diskName === 'r2') {
            return $this->buildR2PublicUrl($objectKey);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $adapter */
        $adapter = Storage::disk($diskName);

        return $adapter->url($objectKey);
    }

    /**
     * Remove a stored speaking image referenced by its public URL (local /storage or R2 public base URL).
     */
    public function deleteByPublicUrl(?string $publicUrl): void
    {
        if (! is_string($publicUrl) || $publicUrl === '') {
            return;
        }

        $rel = $this->publicDiskRelativePathFromImageUrl($publicUrl);
        if ($rel !== null) {
            Storage::disk('public')->delete($rel);

            return;
        }

        $key = $this->r2ObjectKeyFromUrl($publicUrl);
        if ($key !== null) {
            Storage::disk('r2')->delete($key);
        }
    }

    /**
     * If the URL points at the app public disk under a known question-image prefix, return the relative path.
     *
     * @return non-empty-string|null path relative to the public disk root
     */
    public function publicDiskRelativePathFromImageUrl(string $publicUrl): ?string
    {
        $path = parse_url($publicUrl, PHP_URL_PATH);
        if (! is_string($path)) {
            return null;
        }
        $prefix = '/storage/';
        if (! str_starts_with($path, $prefix)) {
            return null;
        }
        $rel = substr($path, strlen($prefix));
        if ($rel === '' || str_contains($rel, '..')) {
            return null;
        }
        foreach ($this->speakingImageKeyPrefixCandidates() as $ap) {
            if ($ap !== '' && str_starts_with($rel, $ap.'/')) {
                return $rel;
            }
        }

        return null;
    }

    /**
     * Whether this URL is already one of our R2 public URLs (object key resolvable).
     */
    public function isR2QuestionImageUrl(string $publicUrl): bool
    {
        return $this->r2ObjectKeyFromUrl($publicUrl) !== null;
    }

    /**
     * @return non-empty-string|null object key in the R2 bucket
     */
    private function r2ObjectKeyFromUrl(string $publicUrl): ?string
    {
        foreach ($this->r2PublicUrlPrefixesLongestFirst() as $prefix) {
            if (! str_starts_with($publicUrl, $prefix.'/')) {
                continue;
            }
            $key = substr($publicUrl, strlen($prefix) + 1);
            if ($key === '' || str_contains($key, '..')) {
                continue;
            }
            foreach ($this->speakingImageKeyPrefixCandidates() as $ap) {
                if ($ap !== '' && str_starts_with($key, $ap.'/')) {
                    return $key;
                }
            }
        }

        return null;
    }

    /**
     * Public browser URL for an R2 object (includes /{bucket}/ when url_include_bucket is true).
     */
    private function buildR2PublicUrl(string $objectKey): string
    {
        $trimmedKey = ltrim($objectKey, '/');
        foreach ($this->r2PublicUrlPrefixesLongestFirst() as $prefix) {
            if ($prefix !== '') {
                return $prefix.'/'.$trimmedKey;
            }
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $r2 */
        $r2 = Storage::disk('r2');

        return $r2->url($objectKey);
    }

    /**
     * URL prefixes to strip when resolving an object key, or the base to use when building a URL.
     * Longer prefix first so https://pub….r2.dev/{bucket}/… is matched before https://pub….r2.dev/.
     *
     * @return list<string>
     */
    private function r2PublicUrlPrefixesLongestFirst(): array
    {
        $base = rtrim((string) config('filesystems.disks.r2.url'), '/');
        if ($base === '') {
            return [];
        }
        $includeBucket = filter_var(config('filesystems.disks.r2.url_include_bucket', true), FILTER_VALIDATE_BOOLEAN);
        $bucket = trim((string) config('filesystems.disks.r2.bucket'), '/');
        $withBucket = $includeBucket && $bucket !== '' && ! str_ends_with($base, '/'.$bucket)
            ? $base.'/'.$bucket
            : null;

        if ($withBucket !== null && $withBucket !== $base) {
            return [$withBucket, $base];
        }

        return [$base];
    }

    /**
     * @return list<string>
     */
    private function speakingImageKeyPrefixCandidates(): array
    {
        $configured = trim((string) config('openai.speaking_image_path_prefix', 'speaking-question-images'), '/');

        return array_values(array_unique(array_filter([
            $configured,
            'speaking-question-images',
            'question-images',
        ])));
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
