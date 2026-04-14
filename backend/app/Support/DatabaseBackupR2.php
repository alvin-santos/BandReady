<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

final class DatabaseBackupR2
{
    /** Invisible object so the backup prefix exists as a “folder” in R2/S3 consoles (flat keys otherwise need no mkdir). */
    private const PREFIX_PLACEHOLDER = '.bandready-backups';

    public static function enabled(): bool
    {
        return (bool) config('bandready.database_backup.r2_enabled', true);
    }

    public static function configured(): bool
    {
        $disk = (string) config('bandready.database_backup.r2_disk', 'r2');
        $cfg = config("filesystems.disks.{$disk}");

        if (! is_array($cfg) || ($cfg['driver'] ?? '') !== 's3') {
            return false;
        }

        foreach (['bucket', 'endpoint', 'key', 'secret'] as $k) {
            if (! is_string($cfg[$k] ?? null) || trim($cfg[$k]) === '') {
                return false;
            }
        }

        return true;
    }

    public static function disk(): string
    {
        return (string) config('bandready.database_backup.r2_disk', 'r2');
    }

    public static function prefix(): string
    {
        $p = trim((string) config('bandready.database_backup.r2_prefix', 'database-backups'), '/');

        return $p !== '' ? $p : 'database-backups';
    }

    public static function maxFiles(): int
    {
        return max(1, (int) config('bandready.database_backup.r2_max_files', 10));
    }

    /**
     * Zip a backup directory and upload it to R2, then prune older archives.
     *
     * @return string Object key on the remote disk
     */
    public static function zipAndUpload(string $backupDir): string
    {
        $backupDir = rtrim($backupDir, DIRECTORY_SEPARATOR);
        $basename = basename($backupDir);
        if ($basename === '' || $basename === '.' || $basename === '..') {
            throw new \InvalidArgumentException('Invalid backup directory for upload.');
        }

        $zipName = $basename.'.zip';

        $zipPath = dirname($backupDir).DIRECTORY_SEPARATOR.'br-backup-'.Str::uuid().'.zip';
        self::zipDirectory($backupDir, $zipPath);

        try {
            $key = self::objectKey($zipName);
            $disk = self::disk();
            self::ensureBackupPrefixExists($disk);
            $stream = fopen($zipPath, 'r');
            if ($stream === false) {
                throw new \RuntimeException('Could not read zip for upload.');
            }
            try {
                Storage::disk($disk)->put($key, $stream);
            } finally {
                fclose($stream);
            }
            self::pruneExcess($disk);

            return $key;
        } finally {
            if (is_file($zipPath)) {
                @unlink($zipPath);
            }
        }
    }

    public static function objectKey(string $zipBasename): string
    {
        return self::prefix().'/'.ltrim($zipBasename, '/');
    }

    /** Whether the object key is under our backup prefix and safe to expose for presigned download. */
    public static function isAllowedBackupObjectKey(string $key): bool
    {
        $key = str_replace('\\', '/', $key);
        if ($key === '' || str_contains($key, '..')) {
            return false;
        }

        $expectedPrefix = self::prefix().'/';
        if (! str_starts_with($key, $expectedPrefix)) {
            return false;
        }

        return str_ends_with(strtolower($key), '.zip');
    }

    /**
     * @return list<array{key: string, name: string, size: int, last_modified: string}>
     */
    public static function listForApi(): array
    {
        if (! self::configured()) {
            return [];
        }

        $disk = self::disk();
        $prefix = self::prefix();

        return collect(Storage::disk($disk)->files($prefix))
            ->filter(fn (string $path) => str_ends_with(strtolower($path), '.zip'))
            ->map(function (string $path) use ($disk) {
                return [
                    'key' => $path,
                    'name' => basename($path),
                    'size' => Storage::disk($disk)->size($path),
                    'last_modified' => now()->setTimestamp(Storage::disk($disk)->lastModified($path))->toIso8601String(),
                ];
            })
            ->sortByDesc('last_modified')
            ->values()
            ->all();
    }

    private static function ensureBackupPrefixExists(string $disk): void
    {
        $marker = self::prefix().'/'.self::PREFIX_PLACEHOLDER;
        if (Storage::disk($disk)->exists($marker)) {
            return;
        }

        Storage::disk($disk)->put($marker, '');
    }

    private static function pruneExcess(string $disk): void
    {
        $prefix = self::prefix();
        $max = self::maxFiles();

        $rows = collect(Storage::disk($disk)->files($prefix))
            ->filter(fn (string $path) => str_ends_with(strtolower($path), '.zip'))
            ->map(fn (string $path) => [
                'path' => $path,
                'mtime' => Storage::disk($disk)->lastModified($path),
            ])
            ->sortByDesc('mtime')
            ->values();

        if ($rows->count() <= $max) {
            return;
        }

        foreach ($rows->slice($max) as $row) {
            Storage::disk($disk)->delete($row['path']);
        }
    }

    private static function zipDirectory(string $sourceDir, string $zipPath): void
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Could not create zip archive for remote backup.');
        }

        $sourceDir = rtrim($sourceDir, DIRECTORY_SEPARATOR);
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($sourceDir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($iterator as $file) {
            if (! $file instanceof \SplFileInfo || ! $file->isFile()) {
                continue;
            }
            $real = $file->getRealPath();
            if ($real === false) {
                continue;
            }
            $relative = substr($real, strlen($sourceDir) + 1);
            $relative = str_replace('\\', '/', $relative);
            $zip->addFile($real, $relative);
        }

        $zip->close();

        if (! is_file($zipPath)) {
            throw new \RuntimeException('Zip archive was not written.');
        }
    }
}
