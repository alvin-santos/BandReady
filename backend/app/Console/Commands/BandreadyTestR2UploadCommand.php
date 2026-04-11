<?php

namespace App\Console\Commands;

use App\Services\OpenAiImageGenerationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

class BandreadyTestR2UploadCommand extends Command
{
    protected $signature = 'bandready:test-r2-upload
                            {--disk=r2 : Filesystem disk name (see config/filesystems.php)}
                            {--prefix=r2-connection-tests : Key prefix for the test object}
                            {--keep : Leave the uploaded object in the bucket (default: delete after success)}';

    protected $description = 'Upload a small text object to the configured disk (R2 by default) to verify credentials and endpoint.';

    public function handle(): int
    {
        $diskName = trim((string) $this->option('disk'));
        if ($diskName === '') {
            $this->error('Option --disk must be non-empty.');

            return self::FAILURE;
        }

        $prefix = trim((string) $this->option('prefix'), '/');
        $stamp = now()->timezone(config('app.timezone'))->toIso8601String();
        $key = ($prefix !== '' ? $prefix.'/' : '').'bandready-test-'.Str::uuid().'.txt';
        $body = "BandReady R2 upload test\nGenerated at: {$stamp}\n";

        try {
            $disk = Storage::disk($diskName);
        } catch (InvalidArgumentException $e) {
            $this->error('Unknown disk: '.$diskName);

            return self::FAILURE;
        }

        $this->info("Disk: {$diskName}");
        $this->line('Object key: '.$key);

        if ($diskName === 'r2') {
            $cfg = config('filesystems.disks.r2', []);
            $bucket = $cfg['bucket'] ?? null;
            $endpoint = $cfg['endpoint'] ?? null;
            $url = $cfg['url'] ?? null;
            $this->line('Bucket: '.(is_string($bucket) && $bucket !== '' ? $bucket : '(empty — set R2_BUCKET or AWS_BUCKET)'));
            $this->line('Endpoint: '.(is_string($endpoint) && $endpoint !== '' ? $endpoint : '(empty — set R2_ENDPOINT or AWS_ENDPOINT)'));
            $this->line('Public URL base (R2_URL): '.(is_string($url) && $url !== '' ? $url : '(empty — set R2_URL or AWS_URL for browser URLs)'));
            $inc = filter_var($cfg['url_include_bucket'] ?? true, FILTER_VALIDATE_BOOLEAN);
            $this->line('URL include bucket segment: '.($inc ? 'yes (default for *.r2.dev)' : 'no'));
        }

        try {
            $disk->put($key, $body);
        } catch (\Throwable $e) {
            $this->error('Upload failed: '.$e->getMessage());

            return self::FAILURE;
        }

        if (! $disk->exists($key)) {
            $this->error('Upload reported success but object does not exist at key: '.$key);

            return self::FAILURE;
        }

        $publicUrl = $this->resolvePublicUrl($diskName, $key);
        $this->info('Upload OK.');
        $this->line('Public URL: '.$publicUrl);

        if ($this->option('keep')) {
            $this->comment('Left object in bucket (--keep).');

            return self::SUCCESS;
        }

        try {
            $disk->delete($key);
        } catch (\Throwable $e) {
            $this->warn('Uploaded OK but delete failed: '.$e->getMessage());
            $this->warn('Remove manually: '.$key);

            return self::FAILURE;
        }

        $this->info('Test object deleted.');

        return self::SUCCESS;
    }

    private function resolvePublicUrl(string $diskName, string $key): string
    {
        try {
            return app(OpenAiImageGenerationService::class)->publicUrlForObject($diskName, $key);
        } catch (\Throwable) {
            return '(could not build URL — check R2_URL / AWS_URL on the disk)';
        }
    }
}
