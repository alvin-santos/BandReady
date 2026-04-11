<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\Request;

class TtsVoiceSettingsController extends Controller
{
    /** Public: keys disabled by admin (browser matches locally). */
    public function publicIndex()
    {
        $s = SiteSetting::current();
        $keys = $s->tts_disabled_voice_keys;

        return response()->json([
            'disabled_keys' => is_array($keys) ? array_values($keys) : [],
        ]);
    }
}
