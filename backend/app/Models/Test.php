<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Test extends Model
{
    protected $fillable = [
        'exam_id',
        'section_id',
        'title',
        'difficulty',
        'is_full_mock',
        'practice_mode',
        'duration_minutes',
        'is_available',
        'questions_to_show',
        'ielts_speaking_picks',
    ];

    protected function casts(): array
    {
        return [
            'is_full_mock' => 'boolean',
            'is_available' => 'boolean',
            'questions_to_show' => 'integer',
            'ielts_speaking_picks' => 'array',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('order');
    }
}
