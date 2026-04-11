<?php

namespace App\Models;

use App\Services\ExamAccessService;
use App\Services\SpeakingAiSuspensionService;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'subscription_expires_at',
        'progress_reminder_sent_at',
    ];

    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isSubscribed(): bool
    {
        if ($this->subscription_expires_at === null) {
            return false;
        }

        return $this->subscription_expires_at->isFuture();
    }

    /** @return array<string, mixed> */
    public function toApiArray(): array
    {
        $speaking = app(ExamAccessService::class)->speakingUsageForUser($this);
        $suspended = app(SpeakingAiSuspensionService::class)->isSuspended($this);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->hasVerifiedEmail(),
            'role' => $this->role,
            'is_subscribed' => $this->isSubscribed(),
            'subscription_expires_at' => $this->subscription_expires_at?->toIso8601String(),
            'speaking_attempts_used' => $speaking['used'],
            'speaking_attempts_limit' => $speaking['limit'],
            'speaking_ai_suspended' => $suspended,
            'speaking_ai_suspended_at' => $this->speaking_ai_suspended_at?->toIso8601String(),
            'speaking_ai_suspension_notice' => $suspended ? (string) ($this->speaking_ai_suspension_notice ?? '') : null,
        ];
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'subscription_expires_at' => 'datetime',
            'progress_reminder_sent_at' => 'datetime',
            'speaking_ai_suspended_at' => 'datetime',
        ];
    }
}
