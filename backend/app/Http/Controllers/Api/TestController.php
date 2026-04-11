<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Test;
use App\Services\ExamAccessService;
use Illuminate\Http\Request;

class TestController extends Controller
{
    public function index(Request $request)
    {
        $q = Test::query()
            ->with(['exam', 'section'])
            ->join('sections', 'tests.section_id', '=', 'sections.id')
            ->orderBy('sections.sort_order')
            ->orderBy('sections.id')
            ->orderBy('tests.title')
            ->select('tests.*');

        if ($request->filled('exam_id')) {
            $q->where('tests.exam_id', $request->integer('exam_id'));
        }
        if ($request->filled('practice_mode')) {
            $q->where('tests.practice_mode', $request->string('practice_mode'));
        }
        if ($request->filled('section_id')) {
            $q->where('tests.section_id', $request->integer('section_id'));
        }

        $tests = $q->get();
        $user = $request->user('sanctum');
        $access = app(ExamAccessService::class);

        return response()->json($tests->map(function (Test $test) use ($user, $access) {
            $row = $test->toArray();
            $reason = $access->denyStartReason($test, $user);
            $row['locked'] = $reason !== null;
            $row['requires_subscription'] = $access->suggestProUnlock($test, $user);
            $row['lock_reason'] = match ($reason) {
                'guest_section' => 'guest_sign_in_required',
                'speaking_limit' => 'speaking_limit',
                'practice_mode_guest' => 'sign_in_required',
                'speaking_ai_suspended' => 'speaking_ai_suspended',
                default => null,
            };

            return $row;
        }));
    }

    public function show(int $id)
    {
        $test = Test::query()
            ->with(['exam', 'section', 'questions' => fn ($r) => $r->orderBy('order')])
            ->findOrFail($id);

        $payload = $test->toArray();
        foreach ($payload['questions'] as $i => $question) {
            unset($payload['questions'][$i]['correct_answer']);
        }

        return response()->json($payload);
    }
}
