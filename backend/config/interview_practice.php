<?php

return [

    'interview_types' => [
        'general_job',
        'customer_service',
        'software_developer',
        'fresh_graduate',
        'sales',
        'manager_supervisor',
        'nurse_healthcare',
        'ielts_speaking',
        'celpip_speaking',
        'custom_role',
    ],

    'difficulties' => ['easy', 'normal', 'hard'],

    'limits' => [
        'free' => [
            'max_duration_seconds' => 300,
            'max_turns' => 10,
            'sessions_per_day' => 1,
            'cooldown_seconds' => 2,
            'min_answer_chars' => 12,
            'min_answer_words' => 3,
            'max_empty_streak' => 5,
        ],
        'pro' => [
            'max_duration_seconds' => 3600,
            'max_turns' => 80,
            'sessions_per_day' => 50,
            'cooldown_seconds' => 1,
            'min_answer_chars' => 8,
            'min_answer_words' => 2,
            'max_empty_streak' => 12,
        ],
    ],

    'silence_timeout_seconds' => 15,

    'openai_timeout' => (int) env('OPENAI_INTERVIEW_PRACTICE_TIMEOUT', 75),

    'max_message_chars' => 6000,

    'max_custom_role_chars' => 200,
];
