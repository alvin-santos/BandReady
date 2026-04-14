<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Test;
use Illuminate\Support\Facades\DB;

class AdminQuestionBankStatsController extends Controller
{
    public function index()
    {
        $byTask = DB::table('questions')
            ->join('tests', 'tests.id', '=', 'questions.test_id')
            ->join('sections', 'sections.id', '=', 'tests.section_id')
            ->select(
                'sections.name as section_name',
                'questions.celpip_task_number',
                'questions.celpip_task_label',
                DB::raw('COUNT(questions.id) as question_count')
            )
            ->groupBy('sections.name', 'questions.celpip_task_number', 'questions.celpip_task_label')
            ->orderBy('section_name')
            ->orderByRaw('CASE WHEN questions.celpip_task_number IS NULL THEN 1 ELSE 0 END')
            ->orderBy('questions.celpip_task_number')
            ->orderBy('questions.celpip_task_label')
            ->get();

        $byTest = DB::table('tests')
            ->join('sections', 'sections.id', '=', 'tests.section_id')
            ->join('exams', 'exams.id', '=', 'tests.exam_id')
            ->leftJoin('questions', 'questions.test_id', '=', 'tests.id')
            ->select(
                'tests.id as test_id',
                'tests.title as test_title',
                'exams.id as exam_id',
                'exams.name as exam_name',
                'exams.code as exam_code',
                'sections.name as section_name',
                DB::raw('COUNT(questions.id) as question_count')
            )
            ->groupBy(
                'tests.id',
                'tests.title',
                'tests.exam_id',
                'tests.section_id',
                'sections.name',
                'exams.id',
                'exams.name',
                'exams.code'
            )
            ->orderBy('exam_name')
            ->orderBy('section_name')
            ->orderBy('test_title')
            ->get();

        $byExam = DB::table('exams')
            ->leftJoin('tests', 'tests.exam_id', '=', 'exams.id')
            ->leftJoin('questions', 'questions.test_id', '=', 'tests.id')
            ->select(
                'exams.id as exam_id',
                'exams.name as exam_name',
                'exams.code as exam_code',
                DB::raw('COUNT(DISTINCT tests.id) as test_count'),
                DB::raw('COUNT(questions.id) as question_count')
            )
            ->groupBy('exams.id', 'exams.name', 'exams.code')
            ->orderBy('exam_name')
            ->get();

        return response()->json([
            'totals' => [
                'questions' => Question::query()->count(),
                'tests' => Test::query()->count(),
                'exams' => Exam::query()->count(),
            ],
            'by_task' => $byTask,
            'by_test' => $byTest,
            'by_exam' => $byExam,
        ]);
    }
}
