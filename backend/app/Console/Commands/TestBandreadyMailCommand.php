<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\ProgressReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;

class TestBandreadyMailCommand extends Command
{
    protected $signature = 'bandready:test-email
                            {email? : Recipient address (defaults to MAIL_TEST_ADDRESS or first verified user)}
                            {--progress : Send a sample progress-reminder email instead of a plain ping}';

    protected $description = 'Send a test email to verify MAIL_* configuration (uses the log driver by default).';

    public function handle(): int
    {
        $email = $this->argument('email');
        if ($email === null || trim((string) $email) === '') {
            $email = config('bandready.mail_test_address');
        }
        if ($email === null || trim((string) $email) === '') {
            $fallback = User::query()->whereNotNull('email_verified_at')->orderBy('id')->value('email');
            $email = $fallback;
        }
        if ($email === null || trim((string) $email) === '') {
            $this->error('Provide an email argument, set MAIL_TEST_ADDRESS in .env, or seed a verified user.');

            return self::FAILURE;
        }

        $email = trim((string) $email);

        if ($this->option('progress')) {
            $stats = [
                'completed_total' => 12,
                'completed_last_7_days' => 3,
                'last_completed_at' => now()->timezone(config('app.timezone'))->toDateTimeString(),
                'last_score' => 78.5,
            ];

            Notification::route('mail', $email)->notify(new ProgressReminderNotification($stats));
            $this->info('Sample progress reminder sent to '.$email.' (driver: '.config('mail.default').').');

            return self::SUCCESS;
        }

        $appUrl = config('app.url');
        $frontendUrl = config('app.frontend_url');
        $mailer = config('mail.default');
        $body = sprintf(
            "BandReady mail test\n\nTime: %s\nApp: %s\nFrontend: %s\nMailer: %s\n",
            now()->toIso8601String(),
            $appUrl,
            $frontendUrl,
            $mailer
        );

        Mail::raw($body, function ($message) use ($email) {
            $message->to($email)->subject('BandReady mail test');
        });

        $this->info('Test message sent to '.$email.' (driver: '.config('mail.default').'). Check logs if using the log mailer.');

        return self::SUCCESS;
    }
}
