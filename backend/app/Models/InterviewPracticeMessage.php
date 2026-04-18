<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterviewPracticeMessage extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'interview_practice_session_id',
        'role',
        'body',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewPracticeSession::class, 'interview_practice_session_id');
    }
}
