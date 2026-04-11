<?php

namespace App\Services;

use App\Models\Attempt;
use App\Models\Test;
use App\Models\User;

class ExamAccessService
{
    /**
     * @return list<string>
     */
    public function guestAllowedSectionNames(): array
    {
        $raw = config('exam_access.guest_section_names', ['Reading', 'Writing']);

        return array_values(array_filter(array_map('trim', is_array($raw) ? $raw : [])));
    }

    public function freeSpeakingAttemptLimit(): int
    {
        return max(0, (int) config('exam_access.free_speaking_attempt_limit', 3));
    }

    public function hasUnlimitedSpeaking(?User $user): bool
    {
        return $user !== null && ($user->isSubscribed() || $user->isAdmin());
    }

    public function countUserSpeakingAttempts(User $user): int
    {
        return Attempt::query()
            ->where('user_id', $user->id)
            ->whereHas('test.section', function ($q): void {
                $q->whereRaw('LOWER(name) = ?', [strtolower('Speaking')]);
            })
            ->count();
    }

    private function normalizedSectionName(Test $test): ?string
    {
        $test->loadMissing('section');
        $n = $test->section?->name;

        return $n !== null && $n !== '' ? trim($n) : null;
    }

    private function sectionAllowedForGuest(string $sectionName): bool
    {
        foreach ($this->guestAllowedSectionNames() as $allowed) {
            if (strcasecmp($allowed, $sectionName) === 0) {
                return true;
            }
        }

        return false;
    }

    public function isTestLocked(Test $test, ?User $user): bool
    {
        return $this->denyStartReason($test, $user) !== null;
    }

    /**
     * When locked, recommending Pro removes the speaking cap (and other Pro perks elsewhere).
     */
    public function suggestProUnlock(Test $test, ?User $user): bool
    {
        return $this->denyStartReason($test, $user) === 'speaking_limit';
    }

    /**
     * @return null|'guest_section'|'speaking_limit'|'practice_mode_guest'
     */
    public function denyStartReason(Test $test, ?User $user): ?string
    {
        $section = $this->normalizedSectionName($test);
        if ($section === null) {
            return 'guest_section';
        }

        if (! $user) {
            if (! in_array($test->practice_mode, ['quick', 'full'], true)) {
                return 'practice_mode_guest';
            }
            if (! $this->sectionAllowedForGuest($section)) {
                return 'guest_section';
            }

            return null;
        }

        if ($this->hasUnlimitedSpeaking($user)) {
            return null;
        }

        if (strcasecmp($section, 'Speaking') !== 0) {
            return null;
        }

        $limit = $this->freeSpeakingAttemptLimit();
        if ($limit === 0) {
            return 'speaking_limit';
        }

        if ($this->countUserSpeakingAttempts($user) >= $limit) {
            return 'speaking_limit';
        }

        return null;
    }

    public function denyStartMessage(string $reason): string
    {
        return match ($reason) {
            'guest_section' => 'Sign in to start Listening and Speaking tests. Guests may use Reading and Writing only.',
            'speaking_limit' => $this->freeSpeakingAttemptLimit() === 0
                ? 'Speaking tests require Pro access on this site.'
                : 'You have used all free Speaking attempts for your account. Upgrade to Pro for unlimited Speaking.',
            'practice_mode_guest' => 'Sign in to access this test mode.',
            default => 'You cannot start this test.',
        };
    }

    public function denyStartCode(string $reason): string
    {
        return match ($reason) {
            'guest_section' => 'guest_section_denied',
            'speaking_limit' => 'speaking_limit_reached',
            'practice_mode_guest' => 'auth_required',
            default => 'forbidden',
        };
    }

    /**
     * @return array{used: int, limit: int|null}
     */
    public function speakingUsageForUser(User $user): array
    {
        $used = $this->countUserSpeakingAttempts($user);
        if ($this->hasUnlimitedSpeaking($user)) {
            return ['used' => $used, 'limit' => null];
        }

        return ['used' => $used, 'limit' => $this->freeSpeakingAttemptLimit()];
    }
}
