<?php

namespace App\Notifications;

use App\Support\EmailVerificationUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class VerifyEmailNotification extends Notification
{
    use Queueable;

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        /** @var MustVerifyEmail $notifiable */
        $verificationUrl = EmailVerificationUrl::for($notifiable);
        $appName = (string) config('app.name', 'BandReady');

        return (new MailMessage)
            ->subject("Verify your {$appName} email")
            ->view('emails.verify-email', [
                'userName' => $notifiable->name ?? 'there',
                'verificationUrl' => $verificationUrl,
                'expireMinutes' => EmailVerificationUrl::expireMinutes(),
                'appName' => $appName,
                'frontendUrl' => rtrim((string) config('app.frontend_url'), '/'),
            ]);
    }
}
