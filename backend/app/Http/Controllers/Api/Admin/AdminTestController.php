<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Test;
use Illuminate\Http\Request;

class AdminTestController extends Controller
{
    public function index(Request $request)
    {
        $q = Test::query()->with(['exam', 'section'])->withCount('questions');
        if ($request->filled('exam_id')) {
            $q->where('exam_id', $request->integer('exam_id'));
        }

        return response()->json($q->orderBy('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'exam_id' => 'required|exists:exams,id',
            'section_id' => 'required|exists:sections,id',
            'title' => 'required|string|max:255',
            'difficulty' => 'nullable|string|max:32',
            'is_full_mock' => 'boolean',
            'practice_mode' => 'required|string|in:full,quick',
            'duration_minutes' => 'nullable|integer|min:1|max:600',
            'is_available' => 'boolean',
        ]);

        $test = Test::query()->create($data);

        return response()->json($test->load(['exam', 'section']), 201);
    }

    public function update(Request $request, int $id)
    {
        $test = Test::query()->findOrFail($id);
        $data = $request->validate([
            'exam_id' => 'sometimes|exists:exams,id',
            'section_id' => 'sometimes|exists:sections,id',
            'title' => 'sometimes|string|max:255',
            'difficulty' => 'nullable|string|max:32',
            'is_full_mock' => 'boolean',
            'practice_mode' => 'sometimes|string|in:full,quick',
            'duration_minutes' => 'nullable|integer|min:1|max:600',
            'is_available' => 'boolean',
            'questions_to_show' => 'nullable|integer|min:1|max:500',
            'ielts_speaking_picks' => 'nullable|array',
            'ielts_speaking_picks.part1_pool' => 'nullable|integer|min:0|max:50',
            'ielts_speaking_picks.part3_pool' => 'nullable|integer|min:0|max:50',
        ]);
        $test->update($data);

        return response()->json($test->load(['exam', 'section']));
    }

    public function destroy(int $id)
    {
        Test::query()->whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }
}
