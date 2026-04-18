<?php

/*
| When the React app uses VITE_API_URL (e.g. http://localhost:8000), the browser sends a
| cross-origin request from http://localhost:5173. Some stacks do not treat allowed_origins
| ["*"] the same as an explicit origin for preflight + Authorization, so we merge known dev
| origins and FRONTEND_URL when running locally.
|
| Optional: CORS_ALLOWED_ORIGINS="http://localhost:5174,http://192.168.1.10:5173"
*/

$fromEnv = array_values(array_filter(
    preg_split('/\s*,\s*/', (string) env('CORS_ALLOWED_ORIGINS', ''), -1, PREG_SPLIT_NO_EMPTY) ?: [],
    static fn (string $o): bool => $o !== ''
));

$fromFrontend = [];
$fe = trim((string) env('FRONTEND_URL', ''));
if ($fe !== '') {
    $fromFrontend[] = rtrim($fe, '/');
}

$localDefaults = [];
if (in_array((string) env('APP_ENV'), ['local', 'development'], true)) {
    $localDefaults = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];
}

$merged = array_values(array_unique(array_merge($fromEnv, $fromFrontend, $localDefaults)));
$allowedOrigins = $merged !== [] ? $merged : ['*'];

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
