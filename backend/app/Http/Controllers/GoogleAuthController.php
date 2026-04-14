<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
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

    public function callback(): RedirectResponse|Response
    {
        $oauthDebug = (bool) config('app.google_oauth_debug');

        // SPA origin only — not APP_URL (API). Set FRONTEND_URL in .env (e.g. https://band-ready.com).
        $frontend = rtrim((string) config('app.frontend_url'), '/');
        if ($frontend === '') {
            throw new \RuntimeException(
                'FRONTEND_URL is empty. Set FRONTEND_URL in .env to your SPA base URL. After Google validates at '.
                rtrim((string) config('app.url'), '/').'/auth/google/callback, users are redirected here with the token.'
            );
        }

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

            if ($oauthDebug) {
                return $this->googleOAuthDebugResponse([
                    'step' => 'Socialite::user() failed (before user lookup)',
                    'google_error_redirect_code' => $code,
                    'would_redirect_to' => $frontend.'/login?google_error='.$code,
                    'exception_class' => $class,
                    'exception_message' => $e->getMessage(),
                    'app_url' => (string) config('app.url'),
                    'frontend_url' => $frontend,
                    'request_query' => request()->query->all(),
                ]);
            }

            return redirect()->away($frontend.'/login?google_error='.$code);
        }

        $email = $googleUser->getEmail();
        if (! is_string($email) || trim($email) === '') {
            if ($oauthDebug) {
                return $this->googleOAuthDebugResponse([
                    'step' => 'Google returned no usable email',
                    'would_redirect_to' => $frontend.'/login?google_error=email',
                    'app_url' => (string) config('app.url'),
                    'frontend_url' => $frontend,
                    'google_profile' => [
                        'id' => $googleUser->getId(),
                        'name' => $googleUser->getName(),
                        'email' => $email,
                    ],
                ]);
            }

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
                    if ($oauthDebug) {
                        return $this->googleOAuthDebugResponse([
                            'step' => 'Email already linked to a different Google account',
                            'would_redirect_to' => $frontend.'/login?google_error=account',
                            'app_url' => (string) config('app.url'),
                            'frontend_url' => $frontend,
                            'existing_user_id' => $existing->id,
                            'existing_google_id' => $existing->google_id,
                            'attempted_google_id' => $googleId,
                        ]);
                    }

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

        if ($oauthDebug) {
            $fragment = 'token='.rawurlencode($token);

            return $this->googleOAuthDebugResponse([
                'step' => 'Success — normally redirects to SPA (halted for GOOGLE_OAUTH_DEBUG)',
                'would_redirect_to' => $frontend.'/auth/google#'.$fragment,
                'app_url' => (string) config('app.url'),
                'frontend_url' => $frontend,
                'user_id' => $user->id,
                'user_email' => $user->email,
                'plain_text_token' => $token,
                'token_note' => 'Shown only because GOOGLE_OAUTH_DEBUG=true. Turn it off after debugging.',
            ]);
        }

        return redirect()->away($frontend.'/auth/google#'.'token='.rawurlencode($token));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function googleOAuthDebugResponse(array $payload): Response
    {
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        $json = $json === false ? '{}' : $json;
        $body = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Google OAuth callback (debug)</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 1.25rem; line-height: 1.45; }
    h1 { font-size: 1.1rem; margin: 0 0 0.75rem; }
    p { margin: 0 0 0.75rem; color: #333; }
    pre { background: #f4f4f5; padding: 1rem; overflow: auto; border-radius: 6px; font-size: 0.8rem; }
    code { color: #0a0a0a; }
  </style>
</head>
<body>
  <h1>Google OAuth — /auth/google/callback (debug halt)</h1>
  <p>Set <code>GOOGLE_OAUTH_DEBUG=false</code> in <code>.env</code> when finished. Do not leave enabled in production.</p>
  <pre><code>{$this->escapeHtml($json)}</code></pre>
</body>
</html>
HTML;

        return response($body, 200)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    private function escapeHtml(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
