<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LeaderboardBuilder;
use Illuminate\Http\Request;

class PublicRankingController extends Controller
{
    public function __construct(
        private LeaderboardBuilder $leaderboard
    ) {}

    public function index(Request $request)
    {
        $examCode = $request->query('exam_code');
        $practiceMode = $request->query('practice_mode');
        if (is_string($examCode) && $examCode === '') {
            $examCode = null;
        }
        if (is_string($practiceMode) && $practiceMode === '') {
            $practiceMode = null;
        }

        $viewer = $request->user('sanctum');

        return response()->json($this->leaderboard->build($examCode, $practiceMode, $viewer));
    }
}
