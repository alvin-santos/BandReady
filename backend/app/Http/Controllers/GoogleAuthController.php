<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(): RedirectResponse
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (\Throwable $e) {
            $code = str_contains(strtolower($class = $e::class), 'invalidstate')
                || str_contains(strtolower($e->getMessage()), 'state')
                ? 'state'
                : '1';
            if ($code === 'state') {
                Log::notice('Google OAuth state error', ['message' => $e->getMessage()]);
            } else {
                Log::warning('Google OAuth failed', ['exception' => $class, 'message' => $e->getMessage()]);
            }

            return redirect()->away($frontend.'/login?google_error='.$code);
        }

        $email = $googleUser->getEmail();
        if (! is_string($email) || trim($email) === '') {
            return redirect()->away($frontend.'/login?google_error=email');
        }

        $googleId = (string) $googleUser->getId();
        $name = $googleUser->getName() ?: Str::before($email, '@');
        $avatar = $googleUser->getAvatar();

        $user = User::query()->where('google_id', $googleId)->first();

        if ($user === null) {
            $existing = User::query()->where('email', $email)->first();
            if ($existing !== null) {
                if ($existing->google_id !== null && $existing->google_id !== $googleId) {
                    return redirect()->away($frontend.'/login?google_error=account');
                }
                $existing->google_id = $googleId;
                if (is_string($avatar) && $avatar !== '') {
                    $existing->google_avatar = $avatar;
                }
                if (! $existing->hasVerifiedEmail()) {
                    $existing->markEmailAsVerified();
                }
                $existing->save();
                $user = $existing;
            } else {
                $user = User::query()->create([
                    'name' => $name,
                    'email' => $email,
                    'password' => Hash::make(Str::random(64)),
                    'role' => 'user',
                    'google_id' => $googleId,
                    'google_avatar' => is_string($avatar) ? $avatar : null,
                    'email_verified_at' => now(),
                ]);
            }
        } else {
            if (is_string($avatar) && $avatar !== '') {
                $user->google_avatar = $avatar;
            }
            if (! $user->hasVerifiedEmail()) {
                $user->markEmailAsVerified();
            }
            $user->save();
        }

        $token = $user->createToken('spa')->plainTextToken;

        return redirect()->away($frontend.'/auth/google#'.'token='.rawurlencode($token));
    }
}
