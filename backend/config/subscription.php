<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Simulated checkout (no payment gateway)
    |--------------------------------------------------------------------------
    |
    | When true, POST /subscription/simulate-checkout is allowed for local
    | testing. Disable in production when Stripe is live.
    |
    */
    'simulate_enabled' => filter_var(env('SUBSCRIPTION_SIMULATE_ENABLED', false), FILTER_VALIDATE_BOOL),

    /*
    |--------------------------------------------------------------------------
    | Stripe — one-time Pro checkout
    |--------------------------------------------------------------------------
    |
    | Create a one-time Price in the Stripe Dashboard and set STRIPE_PRICE_ID.
    | Webhook endpoint: POST /api/subscription/webhook (configure URL in Stripe).
    |
    */
    'stripe_secret' => env('STRIPE_SECRET'),
    'stripe_webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    'price_id' => env('STRIPE_PRICE_ID'),

    'pro_months' => (int) env('SUBSCRIPTION_PRO_MONTHS', 12),
];
