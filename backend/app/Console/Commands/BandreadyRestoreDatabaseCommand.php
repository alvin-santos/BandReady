<?php

namespace App\Console\Commands;

use App\Support\CliBinary;
use App\Support\SqliteDatabasePath;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Throwable;

class BandreadyRestoreDatabaseCommand extends Command
{
    protected $signature = 'bandready:restore
                            {path : Backup directory created by bandready:backup (storage path or absolute)}
                            {--force : Required in production to confirm overwrite}';

    protected $description = 'Restore a database from a bandready:backup folder (manifest.json + sqlite or dump.sql).';

    public function handle(): int
    {
        $raw = $this->argument('path');
        $dir = $this->resolveBackupPath($raw);

        if (! File::isDirectory($dir)) {
            $this->error('Backup directory not found: '.$dir);

            return self::FAILURE;
        }

        $manifestPath = $dir.'/manifest.json';
        if (! File::exists($manifestPath)) {
            $this->error('manifest.json is missing — not a BandReady backup folder.');

            return self::FAILURE;
        }

        $manifest = json_decode(File::get($manifestPath), true);
        if (! is_array($manifest)) {
            $this->error('manifest.json is invalid.');

            return self::FAILURE;
        }

        $format = $manifest['format'] ?? '';
        $driver = config('database.connections.'.config('database.default').'.driver');

        if (app()->environment('production') && ! $this->option('force')) {
            $this->error('Refusing to restore in production without --force.');

            return self::FAILURE;
        }

        if (! $this->confirm('This will REPLACE the current database. Continue?')) {
            return self::SUCCESS;
        }

        try {
            match ($format) {
                'sqlite_file' => $this->restoreSqlite($dir, $manifest),
                'mysql_sql' => $this->restoreMysql($dir, $manifest),
                'pgsql_sql' => $this->restorePgsql($dir, $manifest),
                default => throw new \InvalidArgumentException('Unknown backup format: '.(string) $format),
            };
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info('Restore finished. Consider running php artisan migrate:status');

        return self::SUCCESS;
    }

    private function resolveBackupPath(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return '';
        }
        if (File::isDirectory($raw)) {
            return $raw;
        }
        $underStorage = storage_path('app/'.trim($raw, '/'));
        if (File::isDirectory($underStorage)) {
            return $underStorage;
        }

        return $raw;
    }

    private function restoreSqlite(string $dir, array $manifest): void
    {
        if (($manifest['driver'] ?? '') !== 'sqlite') {
            $this->warn('Backup was created with driver '.($manifest['driver'] ?? '?').'; current default is sqlite — proceeding.');
        }

        $file = $manifest['file'] ?? 'database.sqlite';
        $source = $dir.'/'.$file;
        if (! File::exists($source)) {
            throw new \RuntimeException("Backup file missing: {$file}");
        }

        $target = SqliteDatabasePath::resolveFromConfig(config('database.connections.sqlite'));

        if (File::exists($target)) {
            $bak = $target.'.pre-restore-'.now()->format('YmdHis');
            File::move($target, $bak);
            $this->line('Renamed existing DB to: '.$bak);
        }

        File::ensureDirectoryExists(dirname($target));
        if (! @copy($source, $target)) {
            throw new \RuntimeException('Could not copy backup into database path: '.$target);
        }

        $expected = $manifest['sha256'] ?? null;
        if (is_string($expected) && $expected !== '') {
            $actual = hash_file('sha256', $target);
            if (! hash_equals($expected, $actual)) {
                throw new \RuntimeException('SHA-256 mismatch after copy — file may be corrupted.');
            }
        }

        DB::purge();
        DB::reconnect();
        $this->info('SQLite database restored to: '.$target);
    }

    private function restoreMysql(string $dir, array $manifest): void
    {
        $config = config('database.connections.'.config('database.default'));
        $driver = $config['driver'] ?? '';
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            throw new \RuntimeException('Current database connection must be mysql or mariadb to restore this backup.');
        }

        $dump = $dir.'/dump.sql';
        if (! File::exists($dump)) {
            throw new \RuntimeException('dump.sql not found in backup directory.');
        }

        $expected = $manifest['sha256'] ?? null;
        if (is_string($expected) && $expected !== '') {
            $actual = hash_file('sha256', $dump);
            if (! hash_equals($expected, $actual)) {
                throw new \RuntimeException('dump.sql SHA-256 does not match manifest — file may be corrupted or wrong folder.');
            }
        }

        $mysql = CliBinary::find(['mysql', 'mysql.exe']);
        if ($mysql === null) {
            throw new \RuntimeException('mysql client not found in PATH or standard Windows install locations.');
        }

        $database = $config['database'] ?? '';
        $host = $config['host'] ?? '127.0.0.1';
        $port = (string) ($config['port'] ?? '3306');
        $username = $config['username'] ?? 'root';
        $password = (string) ($config['password'] ?? '');

        $args = [
            $mysql,
            '-h', $host,
            '-P', $port,
            '-u', $username,
        ];
        if ($password !== '') {
            $args[] = '-p'.$password;
        }
        $args[] = $database;

        $result = Process::timeout(3600)->input(File::get($dump))->run($args);

        if (! $result->successful()) {
            throw new \RuntimeException('mysql import failed: '.trim($result->errorOutput() ?: $result->output()));
        }

        $this->info('MySQL/MariaDB database restored.');
        DB::purge();
        DB::reconnect();
    }

    private function restorePgsql(string $dir, array $manifest): void
    {
        $config = config('database.connections.'.config('database.default'));
        if (($config['driver'] ?? '') !== 'pgsql') {
            throw new \RuntimeException('Current database connection must be pgsql to restore this backup.');
        }

        $psql = CliBinary::find(['psql', 'psql.exe']);
        if ($psql === null) {
            throw new \RuntimeException('psql not found in PATH or standard Windows PostgreSQL install locations.');
        }

        $dump = $dir.'/dump.sql';
        if (! File::exists($dump)) {
            throw new \RuntimeException('dump.sql not found in backup directory.');
        }

        $expected = $manifest['sha256'] ?? null;
        if (is_string($expected) && $expected !== '') {
            $actual = hash_file('sha256', $dump);
            if (! hash_equals($expected, $actual)) {
                throw new \RuntimeException('dump.sql SHA-256 does not match manifest.');
            }
        }

        $database = $config['database'] ?? '';
        $host = $config['host'] ?? '127.0.0.1';
        $port = (string) ($config['port'] ?? '5432');
        $username = $config['username'] ?? 'postgres';
        $password = (string) ($config['password'] ?? '');

        $env = array_merge($_ENV, $_SERVER, [
            'PGPASSWORD' => $password,
        ]);

        $args = [
            $psql,
            '-h', $host,
            '-p', $port,
            '-U', $username,
            '-d', $database,
            '-f', $dump,
        ];

        $result = Process::timeout(3600)->env($env)->run($args);

        if (! $result->successful()) {
            throw new \RuntimeException('psql restore failed: '.trim($result->errorOutput() ?: $result->output()));
        }

        $this->info('PostgreSQL database restored.');
        DB::purge();
        DB::reconnect();
    }
}
