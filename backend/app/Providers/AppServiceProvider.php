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

        RateLimiter::for('study-plan', function (Request $request) {
            return Limit::perMinute(30)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('study-plan-openai', function (Request $request) {
            return Limit::perHour(8)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('interview-practice-status', function (Request $request) {
            return Limit::perMinute(30)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('interview-practice-start', function (Request $request) {
            return Limit::perMinute(6)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('interview-practice-read', function (Request $request) {
            return Limit::perMinute(60)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('interview-practice-transcribe', function (Request $request) {
            return Limit::perMinute(30)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('interview-practice-reply', function (Request $request) {
            return Limit::perMinute(40)->by((string) ($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('interview-practice-end', function (Request $request) {
            return Limit::perMinute(20)->by((string) ($request->user()?->id ?? $request->ip()));
        });
    }
}
