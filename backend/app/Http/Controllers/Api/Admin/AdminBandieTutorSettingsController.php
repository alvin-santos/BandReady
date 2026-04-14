<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Support\BandieTutorTipDefaults;
use Illuminate\Http\Request;

class AdminBandieTutorSettingsController extends Controller
{
    public function show()
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
            'bandie_tutor_tips_using_defaults_compact' => $s->bandie_tutor_tips_compact === null,
            'bandie_tutor_tips_using_defaults_detailed' => $s->bandie_tutor_tips_detailed === null,
        ]);
    }

    public function update(Request $request)
    {
        if ($request->boolean('reset_bandie_tips_to_defaults')) {
            $data = $request->validate([
                'bandie_tutor_enabled' => 'required|boolean',
                'bandie_tips_detailed' => 'required|boolean',
                'reset_bandie_tips_to_defaults' => 'sometimes|boolean',
            ]);
            $s = SiteSetting::current();
            $s->bandie_tutor_enabled = $data['bandie_tutor_enabled'];
            $s->bandie_tips_detailed = $data['bandie_tips_detailed'];
            $s->bandie_tutor_tips_compact = null;
            $s->bandie_tutor_tips_detailed = null;
            $s->save();

            return $this->savedResponse($s);
        }

        $rules = [
            'bandie_tutor_enabled' => 'required|boolean',
            'bandie_tips_detailed' => 'required|boolean',
        ];
        foreach (BandieTutorTipDefaults::SECTIONS as $sec) {
            $rules['bandie_tutor_tips_compact.'.$sec] = 'nullable|array|max:60';
            $rules['bandie_tutor_tips_compact.'.$sec.'.*'] = 'nullable|string|max:2500';
            $rules['bandie_tutor_tips_detailed.'.$sec] = 'nullable|array|max:60';
            $rules['bandie_tutor_tips_detailed.'.$sec.'.*'] = 'nullable|string|max:2500';
        }
        $validated = $request->validate($rules);

        $cMerged = BandieTutorTipDefaults::merge(
            $validated['bandie_tutor_tips_compact'] ?? null,
            BandieTutorTipDefaults::compactDefaults()
        );
        $dMerged = BandieTutorTipDefaults::merge(
            $validated['bandie_tutor_tips_detailed'] ?? null,
            BandieTutorTipDefaults::detailedDefaults()
        );

        $s = SiteSetting::current();
        $s->bandie_tutor_enabled = $validated['bandie_tutor_enabled'];
        $s->bandie_tips_detailed = $validated['bandie_tips_detailed'];
        $s->bandie_tutor_tips_compact = $this->tipsEqual($cMerged, BandieTutorTipDefaults::compactDefaults())
            ? null
            : $cMerged;
        $s->bandie_tutor_tips_detailed = $this->tipsEqual($dMerged, BandieTutorTipDefaults::detailedDefaults())
            ? null
            : $dMerged;
        $s->save();

        return $this->savedResponse($s);
    }

    /**
     * @param  array<string, list<string>>  $a
     * @param  array<string, list<string>>  $b
     */
    private function tipsEqual(array $a, array $b): bool
    {
        return json_encode($a) === json_encode($b);
    }

    private function savedResponse(SiteSetting $s)
    {
        $compact = BandieTutorTipDefaults::merge(
            is_array($s->bandie_tutor_tips_compact) ? $s->bandie_tutor_tips_compact : null,
            BandieTutorTipDefaults::compactDefaults()
        );
        $detailed = BandieTutorTipDefaults::merge(
            is_array($s->bandie_tutor_tips_detailed) ? $s->bandie_tutor_tips_detailed : null,
            BandieTutorTipDefaults::detailedDefaults()
        );

        return response()->json([
            'message' => 'Bandie settings saved.',
            'bandie_tutor_enabled' => (bool) $s->bandie_tutor_enabled,
            'bandie_tips_detailed' => (bool) $s->bandie_tips_detailed,
            'bandie_tutor_tips_compact' => $compact,
            'bandie_tutor_tips_detailed' => $detailed,
            'bandie_tutor_tips_using_defaults_compact' => $s->bandie_tutor_tips_compact === null,
            'bandie_tutor_tips_using_defaults_detailed' => $s->bandie_tutor_tips_detailed === null,
        ]);
    }
}
