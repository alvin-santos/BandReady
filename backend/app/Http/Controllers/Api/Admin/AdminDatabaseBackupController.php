<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\DatabaseBackupR2;
use Illuminate\Support\Facades\Artisan;

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
}
