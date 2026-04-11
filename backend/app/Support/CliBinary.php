<?php

namespace App\Support;

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\ExecutableFinder;

final class CliBinary
{
    /**
     * @param  list<string>  $names  e.g. ['pg_dump', 'pg_dump.exe']
     */
    public static function find(array $names): ?string
    {
        $finder = new ExecutableFinder();
        foreach ($names as $name) {
            $path = $finder->find($name);
            if (is_string($path) && File::exists($path)) {
                return $path;
            }
        }

        if (PHP_OS_FAMILY !== 'Windows') {
            return null;
        }

        foreach ($names as $name) {
            $exe = str_ends_with(strtolower($name), '.exe') ? $name : $name.'.exe';
            if (str_starts_with($name, 'pg_') || str_contains(strtolower($name), 'psql')) {
                foreach (['17', '16', '15', '14', '13'] as $ver) {
                    $candidate = 'C:\\Program Files\\PostgreSQL\\'.$ver.'\\bin\\'.$exe;
                    if (File::exists($candidate)) {
                        return $candidate;
                    }
                }
                $globs = glob('C:\\Program Files\\PostgreSQL\\*\\bin\\'.$exe) ?: [];
                if (count($globs) > 0) {
                    rsort($globs);

                    return $globs[0];
                }
            }
            if (str_contains($name, 'mysql')) {
                foreach (['8.4', '8.0', '5.7'] as $ver) {
                    $candidate = 'C:\\Program Files\\MySQL\\MySQL Server '.$ver.'\\bin\\'.$exe;
                    if (File::exists($candidate)) {
                        return $candidate;
                    }
                }
            }
        }

        return null;
    }
}
