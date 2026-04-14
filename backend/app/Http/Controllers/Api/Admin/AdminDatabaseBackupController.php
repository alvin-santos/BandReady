<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\DatabaseBackupR2;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

class AdminDatabaseBackupController extends Controller
{
    public function index()
    {
        if (! DatabaseBackupR2::configured()) {
            return response()->json([
                'configured' => false,
                'disk' => DatabaseBackupR2::disk(),
                'prefix' => DatabaseBackupR2::prefix(),
                'max_files' => DatabaseBackupR2::maxFiles(),
                'backups' => [],
            ]);
        }

        return response()->json([
            'configured' => true,
            'disk' => DatabaseBackupR2::disk(),
            'prefix' => DatabaseBackupR2::prefix(),
            'max_files' => DatabaseBackupR2::maxFiles(),
            'backups' => DatabaseBackupR2::listForApi(),
        ]);
    }

    public function run()
    {
        @set_time_limit(0);

        $exit = Artisan::call('bandready:backup', []);
        $output = trim(Artisan::output());

        if ($exit !== 0) {
            return response()->json([
                'ok' => false,
                'message' => 'The backup command did not finish successfully.',
                'output' => $output,
            ], 500);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Backup completed.',
            'output' => $output,
        ]);
    }

    public function downloadUrl(Request $request)
    {
        if (! DatabaseBackupR2::configured()) {
            return response()->json(['message' => 'Remote storage is not configured.'], 503);
        }

        $key = $request->query('key');
        if (! is_string($key) || $key === '') {
            return response()->json(['message' => 'Missing backup key.'], 422);
        }

        if (! DatabaseBackupR2::isAllowedBackupObjectKey($key)) {
            return response()->json(['message' => 'Invalid backup key.'], 403);
        }

        $disk = DatabaseBackupR2::disk();
        if (! Storage::disk($disk)->exists($key)) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        $filename = basename(str_replace('\\', '/', $key));
        $filename = preg_replace('/[\r\n"]/', '', $filename) ?: 'backup.zip';

        $minutes = (int) config('bandready.database_backup.download_url_ttl_minutes', 15);

        try {
            $url = Storage::disk($disk)->temporaryUrl(
                $key,
                now()->addMinutes($minutes),
                [
                    'ResponseContentDisposition' => 'attachment; filename="'.$filename.'"',
                ]
            );
        } catch (\Throwable) {
            return response()->json(['message' => 'Could not create a signed download URL.'], 500);
        }

        return response()->json([
            'url' => $url,
            'expires_in_minutes' => $minutes,
        ]);
    }
}
