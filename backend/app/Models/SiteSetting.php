<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    protected $fillable = [
        'rankings_public_enabled',
        'rankings_merge_fake',
        'rankings_fake_entries',
        'tts_disabled_voice_keys',
        'bandie_tutor_enabled',
        'celpip_default_questions_per_task',
    ];

    protected function casts(): array
    {
        return [
            'rankings_public_enabled' => 'boolean',
            'rankings_merge_fake' => 'boolean',
            'rankings_fake_entries' => 'array',
            'tts_disabled_voice_keys' => 'array',
            'bandie_tutor_enabled' => 'boolean',
            'celpip_default_questions_per_task' => 'array',
        ];
    }

    public static function current(): self
    {
        return static::query()->firstOrCreate(
            ['id' => 1],
            [
                'rankings_public_enabled' => true,
                'rankings_merge_fake' => true,
                'rankings_fake_entries' => [],
                'bandie_tutor_enabled' => true,
            ]
        );
    }
}
