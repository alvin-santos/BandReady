<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Sections guests may start (no account)
    |--------------------------------------------------------------------------
    |
    | Comma-separated list in EXAM_ACCESS_GUEST_SECTIONS env, or use the default.
    | Matching is case-insensitive. Guests may only use quick/full practice modes
    | (see AttemptController).
    |
    */
    'guest_section_names' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('EXAM_ACCESS_GUEST_SECTIONS', 'Reading,Writing'))
    ))),

    /*
    |--------------------------------------------------------------------------
    | Free (signed-in, non-Pro) speaking attempts
    |--------------------------------------------------------------------------
    |
    | Total number of Speaking tests a free user may start (counts existing attempts
    | linked to a Speaking section). Pro and admin users are unlimited.
    |
    */
    'free_speaking_attempt_limit' => (int) env('EXAM_ACCESS_FREE_SPEAKING_LIMIT', 3),

    /*
    |--------------------------------------------------------------------------
    | Speaking AI suspension notice (user profile + API errors)
    |--------------------------------------------------------------------------
    |
    | Shown when inappropriate language or abuse is detected in AI speaking flows.
    | Do not include profanity or user-submitted text here.
    |
    */
    'speaking_ai_suspension_notice' => (string) env(
        'EXAM_ACCESS_SPEAKING_AI_SUSPENSION_NOTICE',
        'Speaking practice was disabled on your account because inappropriate or abusive language was detected in your speaking practice. This applies to all Speaking tests. If you believe this is a mistake, contact us via the Contact page.'
    ),

];
