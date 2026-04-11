<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Progress reminder emails
    |--------------------------------------------------------------------------
    |
    | Scheduled by Laravel (see bootstrap/app.php). Requires a system cron that
    | runs `php artisan schedule:run` every minute.
    |
    */

    'progress_reminder_enabled' => (bool) env('BANDREADY_PROGRESS_REMINDER_ENABLED', true),

    /** Minimum days between reminder emails per user (anti-spam). */
    'progress_reminder_interval_days' => (int) env('BANDREADY_REMINDER_INTERVAL_DAYS', 7),

    /** Only users with a completed scored attempt in this many days receive reminders. */
    'progress_reminder_activity_days' => (int) env('BANDREADY_REMINDER_ACTIVITY_DAYS', 60),

    /** Optional: default recipient for `php artisan bandready:test-email` when no address is passed. */
    'mail_test_address' => env('MAIL_TEST_ADDRESS'),

];
