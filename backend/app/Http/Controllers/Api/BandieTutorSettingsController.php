<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Support\BandieTutorTipDefaults;

class BandieTutorSettingsController extends Controller
{
    /** Public: Bandie tutor flags and merged tip banks for the learner app. */
    public function publicIndex()
    {
        $s = SiteSetting::current();
        $compact = BandieTutorTipDefaults::merge(
            is_array($s->bandie_tutor_tips_compact) ? $s->bandie_tutor_tips_compact : null,
            BandieTutorTipDefaults::compactDefaults()
        );
        $detailed = BandieTutorTipDefaults::merge(
            is_array($s->bandie_tutor_tips_detailed) ? $s->bandie_tutor_tips_detailed : null,
            BandieTutorTipDefaults::detailedDefaults()
        );

        return response()->json([
            'bandie_tutor_enabled' => (bool) $s->bandie_tutor_enabled,
            'bandie_tips_detailed' => (bool) $s->bandie_tips_detailed,
            'bandie_tutor_tips_compact' => $compact,
            'bandie_tutor_tips_detailed' => $detailed,
        ]);
    }
}
