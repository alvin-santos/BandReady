<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use Illuminate\Http\Request;

class AdminExamController extends Controller
{
    public function index()
    {
        return response()->json(Exam::query()->orderBy('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:64|unique:exams,code',
            'type' => 'required|string|max:64',
        ]);

        $exam = Exam::query()->create($data);

        return response()->json($exam, 201);
    }

    public function update(Request $request, int $id)
    {
        $exam = Exam::query()->findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string|max:64|unique:exams,code,'.$exam->id,
            'type' => 'sometimes|string|max:64',
        ]);
        $exam->update($data);

        return response()->json($exam);
    }

    public function destroy(int $id)
    {
        Exam::query()->whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }
}
