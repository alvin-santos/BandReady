<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection as BaseCollection;

class Attempt extends Model
{
    protected $fillable = [
        'user_id',
        'test_id',
        'guest_session',
        'started_at',
        'completed_at',
        'score',
        'time_spent_seconds',
        'time_limit_seconds',
        'strict_mode',
        'forward_only',
        'forward_only_min_allowed_index',
        'flagged_question_ids',
        'question_order',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'flagged_question_ids' => 'array',
            'question_order' => 'array',
            'strict_mode' => 'boolean',
            'forward_only' => 'boolean',
        ];
    }

    /**
     * Questions in the order shown for this attempt (shuffled at start; legacy attempts use test `order`).
     *
     * @return BaseCollection<int, Question>
     */
    public function questionsInAttemptOrder(): BaseCollection
    {
        $order = $this->question_order;
        if (is_array($order) && count($order) > 0) {
            $ids = array_values(array_map('intval', $order));
            $byId = Question::query()->whereIn('id', $ids)->get()->keyBy('id');
            $mapped = collect($ids)
                ->map(fn (int $id) => $byId->get($id))
                ->filter()
                ->values();
            if ($mapped->isNotEmpty()) {
                return $mapped;
            }
            // Stale IDs (e.g. questions reseeded) — fall back so the exam UI is not empty.
        }

        $this->loadMissing('test.questions');

        return $this->test->questions->sortBy('order')->values();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
