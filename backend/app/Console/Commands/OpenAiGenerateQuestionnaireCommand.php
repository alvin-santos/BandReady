<?php

namespace App\Console\Commands;

use App\Services\OpenAiQuestionnaireService;
use Illuminate\Console\Command;

class OpenAiGenerateQuestionnaireCommand extends Command
{
    protected $signature = 'openai:generate-questionnaire
                            {--prompt= : Extra instructions appended to the generation request}
                            {--model= : Overrides OPENAI_MODEL}
                            {--dry-run : Validate and print JSON only; do not write to the database}
                            {--file= : Import from a JSON file instead of calling OpenAI (must match the expected shape)}
                            {--no-question-preview : Do not print per-question passage/stem previews during import}
                            {--questions-per-test= : Target number of questions per test when calling OpenAI (min 1; ignored with --file)}
                            {--section=* : When generating via OpenAI, only these exam sections (Listening, Reading, Writing, Speaking). Repeat flag or use commas}
            {--exam-title= : With --test-title, target an existing exam by display name (exams.name)}
            {--test-title= : With --exam-title, target a test by title; append questions if it exists, or create a new test row if it does not}
                            {--with-speaking-images : After import, generate DALL·E scene images for speaking_prompt rows that include options_json.speaking.image_generation_prompt (Speaking scope only)}
                            {--omit-passage-text : Tell OpenAI to use JSON null for passage_text on types where it is optional (e.g. speaking_prompt, essay); Listening/Reading MCQ rules unchanged}';

    protected $description = 'Call OpenAI to generate exams, sections, tests, and questions (BandReady schema). System prompt enforces passage/audio-aligned Reading and Listening MCQs (stems and distractors must match each source). For IELTS exams (code ielts_*), Speaking tests are guided toward one speaking_prompt per test with options_json.ielts_speaking.mode ai_conversation (in-app Parts 1–3 interview). Use --exam-title and --test-title together to target an exam and test by title: questions append to that test if it exists; if no test with that title exists, a new tests row is created (first section by sort order, or the single --section=Name when exactly one --section is passed). Use --section=Listening (or multiple) for OpenAI-only section scope when not using exam/test title targeting. Use --questions-per-test=N to constrain question count (IELTS AI Speaking is exempt: one prompt per test). Merges by exam code and section name; reuses tests when exam_id + title match. Use --with-speaking-images with non–IELTS-AI picture Speaking tasks: model outputs image_generation_prompt + grading text; IELTS ai_conversation rows skip images. Use --omit-passage-text to steer the model toward passage_text null on optional types (e.g. speaking_prompt, essay) without typing it in --prompt. Requires OPENAI_API_KEY; speaking images default to Cloudflare R2 (SPEAKING_IMAGE_DISK, R2_* in .env) or set SPEAKING_IMAGE_DISK=public and run storage:link for local public disk.';

    public function handle(OpenAiQuestionnaireService $service): int
    {
        $path = $this->option('file');
        $path = is_string($path) && $path !== '' ? $path : '';

        $questionsPerTestInt = null;
        $qptRaw = trim((string) ($this->option('questions-per-test') ?? ''));
        if ($qptRaw !== '') {
            if (! preg_match('/^\d+$/', $qptRaw) || (int) $qptRaw < 1) {
                $this->error('--questions-per-test must be a positive integer.');

                return self::FAILURE;
            }
            $questionsPerTestInt = (int) $qptRaw;
        }

        /** @var list<string>|string|null $sectionOpt */
        $sectionOpt = $this->option('section');

        $result = $service->runPipeline($this->output, [
            'file_path' => $path !== '' ? $path : null,
            'file_content' => '',
            'extra_prompt' => (string) ($this->option('prompt') ?? ''),
            'model' => $this->option('model') ?: null,
            'questions_per_test' => $questionsPerTestInt,
            'section' => $sectionOpt,
            'exam_title' => trim((string) ($this->option('exam-title') ?? '')),
            'test_title' => trim((string) ($this->option('test-title') ?? '')),
            'dry_run' => (bool) $this->option('dry-run'),
            'no_question_preview' => (bool) $this->option('no-question-preview'),
            'with_speaking_images' => (bool) $this->option('with-speaking-images'),
            'omit_passage_text' => (bool) $this->option('omit-passage-text'),
        ]);

        return $result['code'];
    }
}
