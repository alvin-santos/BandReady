<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;

class ExamController extends Controller
{
    public function index()
    {
        $exams = Exam::query()->orderBy('id')->get();

        return response()->json($exams);
    }
}
