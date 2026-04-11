<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('ielts-ai-start', function (Request $request) {
            return Limit::perMinute(10)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('ielts-ai-step', function (Request $request) {
            return Limit::perMinute(90)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('speaking-transcribe', function (Request $request) {
            return Limit::perMinute(45)->by((string) ($request->user()?->id ?? $request->ip()));
        });
    }
}
