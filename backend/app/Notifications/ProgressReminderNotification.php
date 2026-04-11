<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ProgressReminderNotification extends Notification
{
    use Queueable;

    /**
     * @param  array{
     *   completed_total:int,
     *   completed_last_7_days:int,
     *   last_completed_at:?string,
     *   last_score:?float
     * }  $stats
     */
    public function __construct(public array $stats)
    {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = $notifiable->name ?? 'there';
        $base = rtrim((string) config('app.frontend_url'), '/');

        $lines = [
            'Here is a quick snapshot of your recent BandReady practice.',
            '**Completed tests (all time):** '.$this->stats['completed_total'],
            '**Completed in the last 7 days:** '.$this->stats['completed_last_7_days'],
        ];
        if (! empty($this->stats['last_completed_at'])) {
            $lines[] = '**Last finished attempt:** '.$this->stats['last_completed_at'];
        }
        if (isset($this->stats['last_score'])) {
            $lines[] = '**Approx. score on that attempt:** '.$this->stats['last_score'].'%';
        }
        $lines[] = 'Open your dashboard for readiness and per-skill signals, or start a new timed run when you are ready.';

        $message = (new MailMessage)
            ->subject('Your BandReady progress')
            ->greeting('Hi '.$name.',')
            ->lines($lines);

        return $message
            ->action('Open dashboard', $base.'/dashboard')
            ->line('Tip: use **Analytics** after you sign in to see trends by day and skill.')
            ->salutation('Good luck with your prep — '.config('app.name'));
    }
}
