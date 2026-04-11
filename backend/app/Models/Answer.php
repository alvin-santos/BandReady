<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Answer extends Model
{
    protected $fillable = [
        'attempt_id',
        'question_id',
        'answer',
        'is_correct',
        'is_flagged',
        'writing_feedback',
        'speaking_feedback',
    ];

    protected function casts(): array
    {
        return [
            'is_flagged' => 'boolean',
            'writing_feedback' => 'array',
            'speaking_feedback' => 'array',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
