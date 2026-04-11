<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Section;
use Illuminate\Http\Request;

class AdminSectionController extends Controller
{
    public function index(Request $request)
    {
        $q = Section::query()->with('exam');
        if ($request->filled('exam_id')) {
            $q->where('exam_id', $request->integer('exam_id'));
        }

        return response()->json($q->orderBy('sort_order')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'exam_id' => 'required|exists:exams,id',
            'name' => 'required|string|max:255',
            'duration_minutes' => 'required|integer|min:1|max:600',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $section = Section::query()->create($data);

        return response()->json($section, 201);
    }

    public function update(Request $request, int $id)
    {
        $section = Section::query()->findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'duration_minutes' => 'sometimes|integer|min:1|max:600',
            'sort_order' => 'nullable|integer|min:0',
        ]);
        $section->update($data);

        return response()->json($section);
    }

    public function destroy(int $id)
    {
        Section::query()->whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }
}
