<?php

namespace App\Console\Commands;

use App\Support\CliBinary;
use App\Support\SqliteDatabasePath;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use Throwable;

class BandreadyBackupDatabaseCommand extends Command
{
    protected $signature = 'bandready:backup
                            {--output= : Directory under storage/app (default: backups/bandready-TIMESTAMP)}
                            {--name= : Optional label included in folder name}';

    protected $description = 'Back up the application database (SQLite file copy or SQL dump for MySQL/MariaDB/PostgreSQL).';

    public function handle(): int
    {
        $connection = config('database.default');
        $config = config("database.connections.{$connection}");

        if (! is_array($config)) {
            $this->error('Database connection config is missing.');

            return self::FAILURE;
        }

        $driver = $config['driver'] ?? '';

        $baseDir = storage_path('app/'.trim($this->option('output') ?: '', '/'));
        if ($this->option('output')) {
            File::ensureDirectoryExists($baseDir);
        } else {
            $label = $this->option('name');
            $suffix = $label ? Str::slug($label) : now()->format('Y-m-d_His');
            $baseDir = storage_path('app/backups/bandready-'.$suffix);
            if (File::isDirectory($baseDir)) {
                $baseDir .= '-'.Str::random(4);
            }
            File::ensureDirectoryExists($baseDir);
        }

        $manifest = [
            'app_name' => config('app.name'),
            'connection' => $connection,
            'driver' => $driver,
            'created_at' => now()->toIso8601String(),
            'laravel' => app()->version(),
        ];

        try {
            match ($driver) {
                'sqlite' => $this->backupSqlite($config, $baseDir, $manifest),
                'mysql', 'mariadb' => $this->backupMysqlFamily($config, $baseDir, $manifest),
                'pgsql' => $this->backupPgsql($config, $baseDir, $manifest),
                default => throw new \InvalidArgumentException("Unsupported driver [{$driver}]. Use sqlite, mysql, mariadb, or pgsql."),
            };
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        File::put($baseDir.'/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");

        $this->info('Backup written to: '.$baseDir);
        $this->line('Restore with: php artisan bandready:restore "'.str_replace('\\', '/', $baseDir).'"');

        return self::SUCCESS;
    }

    private function backupSqlite(array $config, string $baseDir, array &$manifest): void
    {
        $path = SqliteDatabasePath::resolveFromConfig($config);

        $target = $baseDir.'/database.sqlite';
        if (! @copy($path, $target)) {
            throw new \RuntimeException('Could not copy SQLite database to backup.');
        }

        $manifest['format'] = 'sqlite_file';
        $manifest['original_path'] = $path;
        $manifest['file'] = 'database.sqlite';
        $manifest['bytes'] = File::size($target);
        $manifest['sha256'] = hash_file('sha256', $target);
    }

    private function backupMysqlFamily(array $config, string $baseDir, array &$manifest): void
    {
        $binary = CliBinary::find(['mysqldump', 'mysqldump.exe']);
        if ($binary === null) {
            throw new \RuntimeException(
                'mysqldump was not found in PATH. Install MySQL client tools, or add its bin directory to PATH.'
            );
        }

        $database = $config['database'] ?? '';
        $host = $config['host'] ?? '127.0.0.1';
        $port = (string) ($config['port'] ?? '3306');
        $username = $config['username'] ?? 'root';
        $password = (string) ($config['password'] ?? '');

        $dumpPath = $baseDir.'/dump.sql';

        $args = [
            $binary,
            '--single-transaction',
            '--quick',
            '--routines',
            '--events',
            '--result-file='.$dumpPath,
            '-h', $host,
            '-P', $port,
            '-u', $username,
        ];
        if ($password !== '') {
            $args[] = '-p'.$password;
        }
        $args[] = $database;

        $result = Process::timeout(3600)->run($args);

        if (! $result->successful()) {
            throw new \RuntimeException('mysqldump failed: '.trim($result->errorOutput() ?: $result->output()));
        }

        if (! File::exists($dumpPath)) {
            throw new \RuntimeException('mysqldump did not create dump.sql.');
        }

        $manifest['format'] = 'mysql_sql';
        $manifest['file'] = 'dump.sql';
        $manifest['database'] = $database;
        $manifest['bytes'] = File::size($dumpPath);
        $manifest['sha256'] = hash_file('sha256', $dumpPath);
    }

    private function backupPgsql(array $config, string $baseDir, array &$manifest): void
    {
        $binary = CliBinary::find(['pg_dump', 'pg_dump.exe']);
        if ($binary === null) {
            throw new \RuntimeException(
                'pg_dump was not found. On Windows, add PostgreSQL\'s bin folder to PATH (e.g. '.
                '"C:\\Program Files\\PostgreSQL\\16\\bin") or install the PostgreSQL client tools.'
            );
        }

        $database = $config['database'] ?? '';
        $host = $config['host'] ?? '127.0.0.1';
        $port = (string) ($config['port'] ?? '5432');
        $username = $config['username'] ?? 'postgres';
        $password = (string) ($config['password'] ?? '');

        $dumpPath = $baseDir.'/dump.sql';

        $env = array_merge($_ENV, $_SERVER, [
            'PGPASSWORD' => $password,
        ]);

        $args = [
            $binary,
            '-h', $host,
            '-p', $port,
            '-U', $username,
            '-F', 'p',
            '-f', $dumpPath,
            $database,
        ];

        $result = Process::timeout(3600)->env($env)->run($args);

        if (! $result->successful()) {
            throw new \RuntimeException('pg_dump failed: '.trim($result->errorOutput() ?: $result->output()));
        }

        $manifest['format'] = 'pgsql_sql';
        $manifest['file'] = 'dump.sql';
        $manifest['database'] = $database;
        $manifest['bytes'] = File::size($dumpPath);
        $manifest['sha256'] = hash_file('sha256', $dumpPath);
    }
}
