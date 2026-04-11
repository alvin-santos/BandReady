<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OpenaiActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'context_type',
        'context_ref',
        'endpoint',
        'model',
        'http_status',
        'success',
        'error_message',
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'duration_ms',
        'request_payload',
        'response_payload',
    ];

    protected function casts(): array
    {
        return [
            'success' => 'boolean',
            'request_payload' => 'array',
            'response_payload' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
