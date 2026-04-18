<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InterviewPracticeSession extends Model
{
    protected $fillable = [
        'user_id',
        'interview_type',
        'difficulty',
        'custom_role',
        'status',
        'started_at',
        'ended_at',
        'max_duration_seconds',
        'max_turns',
        'user_turns',
        'empty_streak',
        'last_ai_at',
        'feedback_json',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'last_ai_at' => 'datetime',
            'feedback_json' => 'array',
            'max_duration_seconds' => 'integer',
            'max_turns' => 'integer',
            'user_turns' => 'integer',
            'empty_streak' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(InterviewPracticeMessage::class)->orderBy('id');
    }


    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
