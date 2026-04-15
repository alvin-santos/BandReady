<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyPlan extends Model
{
    protected $fillable = [
        'user_id',
        'exam_type',
        'exam_date',
        'days_remaining',
        'study_time',
        'current_level',
        'weak_areas',
        'plan_text',
        'completed_days',
        'regenerate_count_today',
        'regenerate_window_date',
        'plan_pacing',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'exam_date' => 'date',
            'weak_areas' => 'array',
            'completed_days' => 'array',
            'regenerate_window_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
