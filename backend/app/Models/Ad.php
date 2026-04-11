<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ad extends Model
{
    protected $fillable = [
        'title',
        'location',
        'script',
        'image',
        'link',
        'active',
        'clicks',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }
}
