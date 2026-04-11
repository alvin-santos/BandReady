<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Statistic extends Model
{
    protected $fillable = ['metric', 'value', 'date', 'meta'];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'meta' => 'array',
        ];
    }
}
