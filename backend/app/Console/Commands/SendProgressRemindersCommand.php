<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\ProgressReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;
use Throwable;

class SendProgressRemindersCommand extends Command
{
    protected $signature = 'bandready:send-progress-reminders
                            {--dry-run : List recipients without sending}
                            {--user= : Limit to a single user ID (for testing)}
                            {--force : Ignore the minimum interval since last reminder}';

    protected $description = 'Email verified learners a BandReady progress snapshot (scheduled weekly; respects anti-spam interval).';

    public function handle(): int
    {
        if (! config('bandready.progress_reminder_enabled', true)) {
            $this->warn('Progress reminders are disabled (BANDREADY_PROGRESS_REMINDER_ENABLED=false).');

            return self::SUCCESS;
        }

        $activityDays = config('bandready.progress_reminder_activity_days', 60);
        $intervalDays = config('bandready.progress_reminder_interval_days', 7);
        $force = (bool) $this->option('force');
        $dry = (bool) $this->option('dry-run');
        $onlyUser = $this->option('user');

        $query = User::query()
            ->whereNotNull('email_verified_at');

        if ($onlyUser !== null && $onlyUser !== '') {
            $query->whereKey((int) $onlyUser);
        }

        $query->whereHas('attempts', function ($q) use ($activityDays) {
            $q->whereNotNull('completed_at')
                ->whereNotNull('score')
                ->where('completed_at', '>=', now()->subDays($activityDays));
        });

        if (! $force) {
            $query->where(function ($q) use ($intervalDays) {
                $q->whereNull('progress_reminder_sent_at')
                    ->orWhere('progress_reminder_sent_at', '<', now()->subDays($intervalDays));
            });
        }

        $count = $query->count();
        if ($count === 0) {
            $this->info('No eligible users for progress reminders.');

            return self::SUCCESS;
        }

        $this->info("Eligible users: {$count}".($dry ? ' (dry-run — no mail sent)' : ''));

        $sent = 0;
        $failed = 0;

        $query->orderBy('id')->chunkById(100, function ($users) use ($dry, &$sent, &$failed) {
            foreach ($users as $user) {
                assert($user instanceof User);
                $stats = $this->buildStats($user);

                if ($dry) {
                    $this->line("[dry-run] #{$user->id} {$user->email} — completed_total={$stats['completed_total']}");
                    $sent++;

                    continue;
                }

                try {
                    Notification::send($user, new ProgressReminderNotification($stats));
                    $user->forceFill(['progress_reminder_sent_at' => now()])->saveQuietly();
                    $sent++;
                } catch (Throwable $e) {
                    $failed++;
                    $this->error("Failed user #{$user->id}: ".$e->getMessage());
                    report($e);
                }
            }
        });

        if (! $dry) {
            $this->info("Sent: {$sent}, failed: {$failed}");
        }

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return array{
     *   completed_total: int,
     *   completed_last_7_days: int,
     *   last_completed_at: ?string,
     *   last_score: ?float
     * }
     */
    private function buildStats(User $user): array
    {
        $completedTotal = $user->attempts()
            ->whereNotNull('completed_at')
            ->whereNotNull('score')
            ->count();
        $completedLast7 = $user->attempts()
            ->whereNotNull('completed_at')
            ->whereNotNull('score')
            ->where('completed_at', '>=', now()->subDays(7))
            ->count();
        $last = $user->attempts()
            ->whereNotNull('completed_at')
            ->whereNotNull('score')
            ->orderByDesc('completed_at')
            ->first();

        return [
            'completed_total' => $completedTotal,
            'completed_last_7_days' => $completedLast7,
            'last_completed_at' => $last?->completed_at?->timezone(config('app.timezone'))->toDateTimeString(),
            'last_score' => $last !== null ? (float) $last->score : null,
        ];
    }
}
