<?php

namespace App\Services;

use App\Models\Attempt;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class LeaderboardBuilder
{
    private const LIMIT = 100;

    /**
     * @return array{
     *   enabled: bool,
     *   message?: string,
     *   exam_code?: string|null,
     *   practice_mode?: string|null,
     *   entries?: list<array{rank: int, display_name: string, score: float, is_fake: bool, is_you: bool}>,
     *   your_rank?: array{rank: int, score: float, display_name: string, in_top_100: bool}|null
     * }
     */
    public function build(?string $examCode, ?string $practiceMode, ?User $viewer): array
    {
        $settings = SiteSetting::current();

        if (! $settings->rankings_public_enabled) {
            return [
                'enabled' => false,
                'message' => 'Public rankings are currently disabled.',
            ];
        }

        $examCode = $examCode !== null && $examCode !== '' ? $examCode : null;
        $practiceMode = $practiceMode !== null && $practiceMode !== '' ? $practiceMode : null;

        $realRows = $this->realUserRows($examCode, $practiceMode);
        $fakeRows = collect();

        if ($settings->rankings_merge_fake) {
            $raw = $settings->rankings_fake_entries ?? [];
            if (is_array($raw) && $raw !== []) {
                $fakeRows = $this->filterFakeEntries(collect($raw), $examCode, $practiceMode);
            }
        }

        $merged = $realRows->concat($fakeRows)->sort(function ($a, $b) {
            $s = $b['score'] <=> $a['score'];
            if ($s !== 0) {
                return $s;
            }

            return strcmp($a['sort_name'], $b['sort_name']);
        })->values();

        $ranked = $merged->map(function ($row, $index) {
            $row['rank'] = $index + 1;

            return $row;
        });

        $yourRank = null;
        if ($viewer && $viewer->role === 'user') {
            $yourRank = $this->resolveViewerRank($ranked, $viewer);
        }

        $top100 = $ranked->take(self::LIMIT)->map(function ($row) use ($viewer) {
            $uid = $row['user_id'] ?? null;

            return [
                'rank' => $row['rank'],
                'display_name' => $row['display_name'],
                'score' => round((float) $row['score'], 2),
                'is_fake' => (bool) ($row['is_fake'] ?? false),
                'is_you' => $viewer && $uid && (int) $viewer->id === (int) $uid,
            ];
        })->values()->all();

        return [
            'enabled' => true,
            'exam_code' => $examCode,
            'practice_mode' => $practiceMode,
            'entries' => $top100,
            'your_rank' => $yourRank,
        ];
    }

    private function realUserRows(?string $examCode, ?string $practiceMode): Collection
    {
        $query = Attempt::query()
            ->whereNotNull('completed_at')
            ->whereNotNull('score')
            ->whereNotNull('user_id')
            ->whereHas('user', function ($q) {
                $q->where('role', 'user');
            })
            ->whereHas('test', function ($q) use ($examCode, $practiceMode) {
                if ($examCode) {
                    $q->whereHas('exam', fn ($e) => $e->where('code', $examCode));
                }
                if ($practiceMode) {
                    $q->where('practice_mode', $practiceMode);
                }
            });

        $aggregates = $query
            ->selectRaw('user_id, AVG(score) as avg_score')
            ->groupBy('user_id')
            ->get();

        $users = User::query()
            ->whereIn('id', $aggregates->pluck('user_id'))
            ->get()
            ->keyBy('id');

        return $aggregates->map(function ($row) use ($users) {
            $user = $users->get($row->user_id);
            if (! $user) {
                return null;
            }

            return [
                'user_id' => (int) $row->user_id,
                'display_name' => $this->maskName($user->name),
                'sort_name' => Str::lower($this->maskName($user->name)),
                'score' => (float) $row->avg_score,
                'is_fake' => false,
            ];
        })->filter()->values();
    }

    private function filterFakeEntries(Collection $entries, ?string $examCode, ?string $practiceMode): Collection
    {
        return $entries->filter(function ($row) use ($examCode, $practiceMode) {
            if (! isset($row['display_name'], $row['score'])) {
                return false;
            }

            return $this->fakeMatchesFilters($examCode, $practiceMode, $row);
        })->map(function ($row) {
            $name = (string) $row['display_name'];

            return [
                'user_id' => null,
                'display_name' => $name,
                'sort_name' => Str::lower($name),
                'score' => (float) $row['score'],
                'is_fake' => true,
            ];
        })->values();
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function fakeMatchesFilters(?string $examCode, ?string $practiceMode, array $row): bool
    {
        $ec = $row['exam_code'] ?? null;
        $pm = $row['practice_mode'] ?? null;

        if ($examCode !== null) {
            if ($ec !== null && $ec !== $examCode) {
                return false;
            }
        } elseif ($ec !== null) {
            return false;
        }

        if ($practiceMode !== null) {
            if ($pm !== null && $pm !== $practiceMode) {
                return false;
            }
        } elseif ($pm !== null) {
            return false;
        }

        return true;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $ranked  Full sorted list with rank key
     */
    private function resolveViewerRank(Collection $ranked, User $viewer): ?array
    {
        $row = $ranked->first(function ($r) use ($viewer) {
            return isset($r['user_id']) && (int) $r['user_id'] === (int) $viewer->id;
        });

        if (! $row) {
            return null;
        }

        $rank = (int) $row['rank'];
        $inTop = $rank <= self::LIMIT;

        return [
            'rank' => $rank,
            'score' => round((float) $row['score'], 2),
            'display_name' => $this->maskName($viewer->name),
            'in_top_100' => $inTop,
        ];
    }

    public function maskName(string $name): string
    {
        $name = trim($name);
        if ($name === '') {
            return 'Learner';
        }
        $parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY);
        if ($parts === false || count($parts) === 0) {
            return 'Learner';
        }
        if (count($parts) === 1) {
            return $parts[0];
        }
        $last = array_pop($parts);
        $first = implode(' ', $parts);
        $initial = Str::upper(Str::substr($last, 0, 1));

        return $first.' '.$initial.'.';
    }
}
