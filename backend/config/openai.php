<?php

return [

    'api_key' => env('OPENAI_API_KEY'),

    'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),

    'base_url' => rtrim(env('OPENAI_BASE_URL', 'https://api.openai.com/v1'), '/'),

    'timeout' => (int) env('OPENAI_TIMEOUT', 180),

    'max_completion_tokens' => (int) env('OPENAI_MAX_COMPLETION_TOKENS', 16384),

    /** Model for essay evaluation (defaults to main model). */
    'writing_model' => env('OPENAI_WRITING_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')),

    /** Hard cap on essay body length (characters). */
    'essay_max_chars' => (int) env('ESSAY_MAX_CHARS', 4000),

    /** Shorter timeout for per-question writing feedback during submit. */
    'writing_timeout' => (int) env('OPENAI_WRITING_TIMEOUT', 90),

    /** Whisper model for speaking transcription. */
    'whisper_model' => env('OPENAI_WHISPER_MODEL', 'whisper-1'),

    'whisper_timeout' => (int) env('OPENAI_WHISPER_TIMEOUT', 120),

    /** Max stored transcript length after STT (characters). */
    'speaking_max_chars' => (int) env('SPEAKING_MAX_CHARS', 4000),

    /** Max stored answer for IELTS AI multi-turn speaking (full interview transcript). */
    'speaking_conversation_max_chars' => (int) env('SPEAKING_CONVERSATION_MAX_CHARS', 16000),

    /** Model for IELTS AI examiner dialogue (defaults to speaking_model). */
    'ielts_speaking_conversation_model' => env('OPENAI_IELTS_SPEAKING_MODEL', env('OPENAI_SPEAKING_MODEL', env('OPENAI_WRITING_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')))),

    'ielts_speaking_conversation_timeout' => (int) env('OPENAI_IELTS_SPEAKING_CONVERSATION_TIMEOUT', 90),

    /** Browser recording cap for speaking (hint only; enforced in UI). */
    'speaking_max_record_seconds' => (int) env('SPEAKING_MAX_RECORD_SECONDS', 180),

    /** Model for speaking feedback on transcript (defaults to writing model). */
    'speaking_model' => env('OPENAI_SPEAKING_MODEL', env('OPENAI_WRITING_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini'))),

    'speaking_feedback_timeout' => (int) env('OPENAI_SPEAKING_TIMEOUT', 90),

    /** Small classifier for abusive / disruptive speaking text (per-turn and rubric JSON). */
    'speaking_moderation_model' => env('OPENAI_SPEAKING_MODERATION_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')),

    'speaking_moderation_timeout' => (int) env('OPENAI_SPEAKING_MODERATION_TIMEOUT', 20),

    'speaking_moderation_max_chars' => (int) env('OPENAI_SPEAKING_MODERATION_MAX_CHARS', 4000),

    /** Image generation for speaking (DALL·E 3 / gpt-image-1 via Images API). */
    'image_model' => env('OPENAI_IMAGE_MODEL', 'dall-e-3'),

    /** 1024x1024, 1792x1024, or 1024x1792 (model-dependent). */
    'image_size' => env('OPENAI_IMAGE_SIZE', '1024x1024'),

    'image_timeout' => (int) env('OPENAI_IMAGE_TIMEOUT', 120),

    /**
     * Where speaking scene images are stored after generation: "r2" (Cloudflare R2) or "public" (local disk + /storage URL).
     * R2: set R2_BUCKET, R2_ENDPOINT, R2_URL (public base URL for the bucket or custom domain), and keys (see config/filesystems.php).
     */
    'speaking_image_disk' => env('SPEAKING_IMAGE_DISK', 'r2'),

    /** Object key prefix inside the disk (R2 "folder"; created implicitly on first upload). */
    'speaking_image_path_prefix' => trim((string) env('SPEAKING_IMAGE_PATH_PREFIX', 'speaking-question-images'), '/'),

    /** Store request/response JSON in openai_activity_logs (set OPENAI_LOG_ACTIVITY=false to disable). */
    'log_activity' => filter_var(env('OPENAI_LOG_ACTIVITY', 'true'), FILTER_VALIDATE_BOOLEAN),

];
