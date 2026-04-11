<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\Request;

class AdminRankingSettingsController extends Controller
{
    public function show()
    {
        $s = SiteSetting::current();

        return response()->json([
            'rankings_public_enabled' => $s->rankings_public_enabled,
            'rankings_merge_fake' => $s->rankings_merge_fake,
            'rankings_fake_entries' => $s->rankings_fake_entries ?? [],
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'rankings_public_enabled' => 'required|boolean',
            'rankings_merge_fake' => 'required|boolean',
            'rankings_fake_entries' => 'required|array',
            'rankings_fake_entries.*.display_name' => 'required|string|max:120',
            'rankings_fake_entries.*.score' => 'required|numeric|min:0|max:100',
            'rankings_fake_entries.*.exam_code' => 'nullable|string|max:64',
            'rankings_fake_entries.*.practice_mode' => 'nullable|string|in:full,quick',
        ]);

        $s = SiteSetting::current();
        $s->fill([
            'rankings_public_enabled' => $data['rankings_public_enabled'],
            'rankings_merge_fake' => $data['rankings_merge_fake'],
            'rankings_fake_entries' => $data['rankings_fake_entries'],
        ]);
        $s->save();

        return response()->json([
            'message' => 'Ranking settings saved.',
            'rankings_public_enabled' => $s->rankings_public_enabled,
            'rankings_merge_fake' => $s->rankings_merge_fake,
            'rankings_fake_entries' => $s->rankings_fake_entries ?? [],
        ]);
    }
}
