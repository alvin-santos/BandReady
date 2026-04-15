<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class UserTtsVoiceSettingsController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $keys = $user->tts_disabled_voice_keys;

        return response()->json([
            'user_disabled_keys' => is_array($keys) ? array_values($keys) : [],
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'disabled_keys' => 'required|array|max:500',
            'disabled_keys.*' => 'required|string|max:512',
        ]);

        $user->tts_disabled_voice_keys = array_values(array_unique($data['disabled_keys']));
        $user->save();

        return response()->json([
            'message' => 'Your TTS voice preferences were saved.',
            'user_disabled_keys' => $user->tts_disabled_voice_keys,
        ]);
    }
}
