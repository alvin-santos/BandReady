<?php

namespace App\Support;

use App\Models\Question;

final class IeltsAiSpeaking
{
    public static function isAiConversationQuestion(Question $question): bool
    {
        if ($question->type !== 'speaking_prompt') {
            return false;
        }
        $o = $question->options_json;

        return is_array($o)
            && isset($o['ielts_speaking']['mode'])
            && (string) $o['ielts_speaking']['mode'] === 'ai_conversation';
    }
}
