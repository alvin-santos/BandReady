<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Support\CelpipOfficialTaskCatalog;
use Illuminate\Http\Request;

class AdminExamNavSettingsController extends Controller
{
    public function show()
    {
        $s = SiteSetting::current();

        return response()->json([
            'celpip_default_questions_per_task' => $s->celpip_default_questions_per_task,
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'celpip_default_questions_per_task' => 'nullable|array',
        ]);

        $normalized = $this->normalizeCelpipDefaultCounts($data['celpip_default_questions_per_task'] ?? null);

        $s = SiteSetting::current();
        $s->celpip_default_questions_per_task = $normalized;
        $s->save();

        return response()->json([
            'message' => 'CELPIP task defaults saved.',
            'celpip_default_questions_per_task' => $s->celpip_default_questions_per_task,
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $raw
     * @return array<string, array<string, int>>|null
     */
    private function normalizeCelpipDefaultCounts(?array $raw): ?array
    {
        if ($raw === null || $raw === []) {
            return null;
        }
        $out = [];
        foreach ($raw as $section => $map) {
            if (! is_string($section) || ! isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$section])) {
                continue;
            }
            if (! is_array($map)) {
                continue;
            }
            $validNums = array_keys(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$section]);
            $sec = [];
            foreach ($map as $k => $v) {
                if ($v === null || $v === '') {
                    continue;
                }
                if (! is_numeric($k) || ! is_numeric($v)) {
                    continue;
                }
                $tn = (int) $k;
                if (! in_array($tn, $validNums, true)) {
                    continue;
                }
                $sec[(string) $tn] = max(0, min(500, (int) $v));
            }
            if ($sec !== []) {
                $out[$section] = $sec;
            }
        }

        return $out === [] ? null : $out;
    }
}
