<?php

namespace App\Support;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\URL;

class EmailVerificationUrl
{
    public static function for(MustVerifyEmail $user): string
    {
        $minutes = (int) Config::get('auth.verification.expire', 60);

        return URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addMinutes($minutes),
            [
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
            ]
        );
    }

    public static function expireMinutes(): int
    {
        return (int) Config::get('auth.verification.expire', 60);
    }
}
