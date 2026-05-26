<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Console\Command;

class SendTestVerificationEmailCommand extends Command
{
    protected $signature = 'bandready:test-verification-email
                            {email? : Recipient user email (must exist in users table)}
                            {--user= : User ID instead of email}';

    protected $description = 'Send the BandReady email-verification message (custom Blade template) for testing MAIL_* settings.';

    public function handle(): int
    {
        $user = $this->resolveUser();
        if ($user === null) {
            return self::FAILURE;
        }

        $user->notify(new VerifyEmailNotification);

        $this->info(sprintf(
            'Verification email sent to %s (user #%d, mailer: %s).',
            $user->email,
            $user->id,
            config('mail.default')
        ));
        $this->line('Signed link uses APP_URL: '.config('app.url'));
        if (config('mail.default') === 'log') {
            $this->comment('Mail driver is "log" — open storage/logs/laravel.log to inspect the message.');
        }

        return self::SUCCESS;
    }

    private function resolveUser(): ?User
    {
        $userId = $this->option('user');
        if ($userId !== null && $userId !== '') {
            $user = User::query()->find((int) $userId);
            if ($user === null) {
                $this->error('No user found with id '.$userId.'.');

                return null;
            }

            return $user;
        }

        $email = $this->argument('email');
        if ($email === null || trim((string) $email) === '') {
            $email = config('bandready.mail_test_address');
        }
        if ($email === null || trim((string) $email) === '') {
            $email = User::query()->orderBy('id')->value('email');
        }
        if ($email === null || trim((string) $email) === '') {
            $this->error('Provide an email, --user=ID, set MAIL_TEST_ADDRESS, or seed at least one user.');

            return null;
        }

        $email = trim((string) $email);
        $user = User::query()->where('email', $email)->first();
        if ($user === null) {
            $this->error('No user found with email '.$email.'. Verification links require a database user row.');

            return null;
        }

        return $user;
    }
}
