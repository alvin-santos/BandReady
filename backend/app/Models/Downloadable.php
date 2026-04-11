<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Downloadable extends Model
{
    protected $fillable = [
        'title',
        'slug',
        'description',
        'requires_pro',
        'sort_order',
        'is_active',
        'body_text',
        'download_filename',
        'mime_type',
    ];

    protected function casts(): array
    {
        return [
            'requires_pro' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
