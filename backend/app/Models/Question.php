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
        'show_passage_on_test',
        'audio_url',
        'audio_script',
        'image_url',
        'options_json',
        'correct_answer',
        'explanation',
        'order',
        'celpip_task_number',
        'celpip_task_label',
    ];

    protected function casts(): array
    {
        return [
            'options_json' => 'array',
            'celpip_task_number' => 'integer',
            'show_passage_on_test' => 'boolean',
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
