<?php

namespace App\Support;

use Illuminate\Support\Facades\File;

/**
 * Resolves the on-disk path for Laravel's SQLite database config (handles relative DB_DATABASE values).
 */
final class SqliteDatabasePath
{
    public static function resolveFromConfig(array $config): string
    {
        $path = $config['database'] ?? database_path('database.sqlite');
        if (! is_string($path) || $path === ':memory:') {
            throw new \InvalidArgumentException('SQLite is set to :memory: or has no database path — cannot backup or restore.');
        }

        if (File::exists($path)) {
            return (string) (realpath($path) ?: $path);
        }

        $trim = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        $candidates = array_unique(array_filter([
            $trim,
            database_path($trim),
            database_path(basename($trim)),
            base_path($trim),
            base_path('database'.DIRECTORY_SEPARATOR.basename($trim)),
        ]));

        foreach ($candidates as $c) {
            if ($c !== '' && File::exists($c)) {
                return (string) (realpath($c) ?: $c);
            }
        }

        throw new \RuntimeException('SQLite database file not found. Config path was: '.$path);
    }
}
