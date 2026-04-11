<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\Request;

class AdminTtsVoiceSettingsController extends Controller
{
    public function show()
    {
        $s = SiteSetting::current();
        $keys = $s->tts_disabled_voice_keys;

        return response()->json([
            'disabled_keys' => is_array($keys) ? array_values($keys) : [],
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'disabled_keys' => 'required|array|max:500',
            'disabled_keys.*' => 'required|string|max:512',
        ]);

        $s = SiteSetting::current();
        $s->tts_disabled_voice_keys = array_values(array_unique($data['disabled_keys']));
        $s->save();

        return response()->json([
            'message' => 'TTS voice blocklist saved.',
            'disabled_keys' => $s->tts_disabled_voice_keys,
        ]);
    }
}
