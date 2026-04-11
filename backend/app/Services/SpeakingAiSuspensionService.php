<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Config;

/**
 * Disables Speaking tests when abusive or policy-breaking content is detected (AI speaking flows).
 */
final class SpeakingAiSuspensionService
{
    public function isSuspended(User $user): bool
    {
        return $user->speaking_ai_suspended_at !== null;
    }

    public function suspendForContentPolicy(User $user): void
    {
        if ($user->isAdmin()) {
            return;
        }
        if ($this->isSuspended($user)) {
            return;
        }
        $notice = trim((string) Config::get('exam_access.speaking_ai_suspension_notice'));
        if ($notice === '') {
            $notice = 'Speaking practice was disabled on your account because inappropriate or abusive language was detected. Check your profile for details, or use Contact if you believe this is a mistake.';
        }
        $user->forceFill([
            'speaking_ai_suspended_at' => now(),
            'speaking_ai_suspension_notice' => $notice,
        ])->save();
    }
}
