<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Attempt;
use App\Models\SiteVisit;
use App\Models\Statistic;
use App\Models\Test;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminStatsController extends Controller
{
    public function dashboard()
    {
        $totalUsers = User::query()->count();
        $totalAttempts = Attempt::query()->whereNotNull('completed_at')->count();
        $activeUsers = User::query()->whereHas('attempts', fn ($q) => $q->where('started_at', '>=', now()->subDays(7)))->count();

        $popular = Attempt::query()
            ->select('test_id', DB::raw('count(*) as c'))
            ->whereNotNull('completed_at')
            ->groupBy('test_id')
            ->orderByDesc('c')
            ->first();

        $popularExam = null;
        if ($popular) {
            $t = Test::query()->with('exam')->find($popular->test_id);
            $popularExam = $t ? ['test' => $t, 'count' => $popular->c] : null;
        }

        $avgScore = Attempt::query()->whereNotNull('completed_at')->avg('score');

        $adClicks = DB::table('ads')->sum('clicks');

        $since7d = now()->subDays(7);
        $totalPageViews = SiteVisit::query()->count();
        $pageViews7d = SiteVisit::query()->where('created_at', '>=', $since7d)->count();
        $uniqueVisitors7d = (int) (DB::table('site_visits')
            ->where('created_at', '>=', $since7d)
            ->selectRaw('count(distinct visitor_id) as c')
            ->value('c') ?? 0);
        $loggedInVisits7d = SiteVisit::query()
            ->where('created_at', '>=', $since7d)
            ->whereNotNull('user_id')
            ->count();
        $distinctLoggedInUsers7d = (int) (DB::table('site_visits')
            ->where('created_at', '>=', $since7d)
            ->whereNotNull('user_id')
            ->selectRaw('count(distinct user_id) as c')
            ->value('c') ?? 0);

        return response()->json([
            'total_users' => $totalUsers,
            'total_attempts' => $totalAttempts,
            'active_users_7d' => $activeUsers,
            'most_taken' => $popularExam,
            'average_score' => $avgScore ? round((float) $avgScore, 2) : null,
            'ad_clicks' => (int) $adClicks,
            'total_page_views' => $totalPageViews,
            'page_views_7d' => $pageViews7d,
            'unique_visitors_7d' => $uniqueVisitors7d,
            'logged_in_page_views_7d' => $loggedInVisits7d,
            'logged_in_users_with_visits_7d' => $distinctLoggedInUsers7d,
        ]);
    }

    public function charts(Request $request)
    {
        $days = min($request->integer('days', 14), 90);
        $from = now()->subDays($days)->toDateString();

        $attemptsPerDay = Attempt::query()
            ->whereNotNull('completed_at')
            ->whereDate('completed_at', '>=', $from)
            ->select(DB::raw('DATE(completed_at) as d'), DB::raw('count(*) as c'))
            ->groupBy('d')
            ->orderBy('d')
            ->get();

        $usersPerDay = User::query()
            ->whereDate('created_at', '>=', $from)
            ->select(DB::raw('DATE(created_at) as d'), DB::raw('count(*) as c'))
            ->groupBy('d')
            ->orderBy('d')
            ->get();

        $statsRows = Statistic::query()
            ->where('date', '>=', $from)
            ->orderBy('date')
            ->get()
            ->groupBy('metric');

        $visitDay = $this->siteVisitDaySql();

        $pageViewsPerDay = SiteVisit::query()
            ->whereDate('created_at', '>=', $from)
            ->select(DB::raw("{$visitDay} as d"), DB::raw('count(*) as c'))
            ->groupBy(DB::raw($visitDay))
            ->orderBy('d')
            ->get();

        $uniqueVisitorsPerDay = SiteVisit::query()
            ->whereDate('created_at', '>=', $from)
            ->select(DB::raw("{$visitDay} as d"), DB::raw('count(distinct visitor_id) as c'))
            ->groupBy(DB::raw($visitDay))
            ->orderBy('d')
            ->get();

        $topPaths = SiteVisit::query()
            ->whereDate('created_at', '>=', $from)
            ->select('path', DB::raw('count(*) as c'))
            ->groupBy('path')
            ->orderByDesc('c')
            ->limit(12)
            ->get();

        $refExpr = $this->siteVisitReferrerLabelSql();
        $topReferrers = SiteVisit::query()
            ->whereDate('created_at', '>=', $from)
            ->select(DB::raw("{$refExpr} as referrer_label"), DB::raw('count(*) as c'))
            ->groupBy(DB::raw($refExpr))
            ->orderByDesc('c')
            ->limit(12)
            ->get();

        return response()->json([
            'attempts_per_day' => $attemptsPerDay,
            'users_per_day' => $usersPerDay,
            'statistics' => $statsRows,
            'page_views_per_day' => $pageViewsPerDay,
            'unique_visitors_per_day' => $uniqueVisitorsPerDay,
            'top_paths' => $topPaths,
            'top_referrers' => $topReferrers,
        ]);
    }

    public function examPopularity()
    {
        $rows = Attempt::query()
            ->join('tests', 'attempts.test_id', '=', 'tests.id')
            ->join('exams', 'tests.exam_id', '=', 'exams.id')
            ->whereNotNull('attempts.completed_at')
            ->select('exams.name', 'exams.code', DB::raw('count(*) as attempts_count'))
            ->groupBy('exams.id', 'exams.name', 'exams.code')
            ->orderByDesc('attempts_count')
            ->get();

        return response()->json($rows);
    }

    /**
     * Calendar-day bucketing for `site_visits.created_at` (driver-specific).
     */
    private function siteVisitDaySql(): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => '(site_visits.created_at::date)',
            'sqlite' => 'date(site_visits.created_at)',
            default => 'DATE(site_visits.created_at)',
        };
    }

    /**
     * Normalised label for grouping referrer URLs (empty → direct/unknown).
     */
    private function siteVisitReferrerLabelSql(): string
    {
        $r = 'site_visits.referrer';
        $empty = "'(direct or unknown)'";

        return "COALESCE(NULLIF(TRIM(COALESCE({$r}, '')), ''), {$empty})";
    }
}
