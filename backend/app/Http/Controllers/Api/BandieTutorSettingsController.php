<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;

class BandieTutorSettingsController extends Controller
{
    /** Public: whether the Bandie tutor widget is shown site-wide. */
    public function publicIndex()
    {
        $s = SiteSetting::current();

        return response()->json([
            'bandie_tutor_enabled' => (bool) $s->bandie_tutor_enabled,
        ]);
    }
}
