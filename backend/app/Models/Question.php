<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    protected $fillable = [
        'test_id',
        'type',
        'question_text',
        'passage_text',
        'audio_url',
        'audio_script',
        'image_url',
        'options_json',
        'correct_answer',
        'explanation',
        'order',
    ];

    protected function casts(): array
    {
        return [
            'options_json' => 'array',
        ];
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }
}
