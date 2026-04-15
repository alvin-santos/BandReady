<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Admin-only history of extra OpenAI questionnaire instructions (--prompt).
 *
 * @property int $id
 * @property string $body
 * @property string|null $exam_title
 * @property string|null $test_title
 * @property string|null $section
 * @property int|null $celpip_task_number
 * @property string|null $celpip_task_label
 * @property string|null $body_hash
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class OpenaiQuestionnaireExtraPrompt extends Model
{
    protected $table = 'openai_questionnaire_extra_prompts';

    protected $fillable = [
        'body',
        'exam_title',
        'test_title',
        'section',
        'celpip_task_number',
        'celpip_task_label',
        'body_hash',
    ];
}
