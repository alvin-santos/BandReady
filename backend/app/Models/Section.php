<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Section extends Model
{
    protected $fillable = ['exam_id', 'name', 'duration_minutes', 'sort_order'];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class);
    }
}
