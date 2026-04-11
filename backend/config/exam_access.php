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

];
