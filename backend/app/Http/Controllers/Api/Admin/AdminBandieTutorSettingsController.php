<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\Request;

class AdminBandieTutorSettingsController extends Controller
{
    public function show()
    {
        $s = SiteSetting::current();

        return response()->json([
            'bandie_tutor_enabled' => (bool) $s->bandie_tutor_enabled,
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'bandie_tutor_enabled' => 'required|boolean',
        ]);

        $s = SiteSetting::current();
        $s->bandie_tutor_enabled = $data['bandie_tutor_enabled'];
        $s->save();

        return response()->json([
            'message' => 'Bandie settings saved.',
            'bandie_tutor_enabled' => (bool) $s->bandie_tutor_enabled,
        ]);
    }
}
