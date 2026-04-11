<?php

namespace App\Console\Commands;

use App\Services\OpenAiQuestionnaireService;
use Illuminate\Console\Command;
use InvalidArgumentException;

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
                            {--with-speaking-images : After import, generate DALL·E scene images for speaking_prompt rows that include options_json.speaking.image_generation_prompt (Speaking scope only)}';

    protected $description = 'Call OpenAI to generate exams, sections, tests, and questions (BandReady schema). System prompt enforces passage/audio-aligned Reading and Listening MCQs (stems and distractors must match each source). For IELTS exams (code ielts_*), Speaking tests are guided toward one speaking_prompt per test with options_json.ielts_speaking.mode ai_conversation (in-app Parts 1–3 interview). Use --exam-title and --test-title together to target an exam and test by title: questions append to that test if it exists; if no test with that title exists, a new tests row is created (first section by sort order, or the single --section=Name when exactly one --section is passed). Use --section=Listening (or multiple) for OpenAI-only section scope when not using exam/test title targeting. Use --questions-per-test=N to constrain question count (IELTS AI Speaking is exempt: one prompt per test). Merges by exam code and section name; reuses tests when exam_id + title match. Use --with-speaking-images with non–IELTS-AI picture Speaking tasks: model outputs image_generation_prompt + grading text; IELTS ai_conversation rows skip images. Requires OPENAI_API_KEY; speaking images default to Cloudflare R2 (SPEAKING_IMAGE_DISK, R2_* in .env) or set SPEAKING_IMAGE_DISK=public and run storage:link for local public disk.';

    public function handle(OpenAiQuestionnaireService $service): int
    {
        $path = $this->option('file');
        $extra = (string) ($this->option('prompt') ?? '');
        $model = $this->option('model') ?: null;
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
        $onlySections = null;
        try {
            $onlySections = $service->parseSectionOption($sectionOpt);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        if (is_array($onlySections) && $onlySections !== []) {
            $this->info('Section filter (OpenAI only): '.implode(', ', $onlySections));
        }

        $examTitle = trim((string) ($this->option('exam-title') ?? ''));
        $testTitle = trim((string) ($this->option('test-title') ?? ''));
        $existingTarget = null;
        if ($examTitle !== '' || $testTitle !== '') {
            if ($examTitle === '' || $testTitle === '') {
                $this->error('When targeting an existing test, provide both --exam-title and --test-title (or omit both for a new hierarchy).');

                return self::FAILURE;
            }
            $preferredSectionForNewTest = is_array($onlySections) && count($onlySections) === 1
                ? $onlySections[0]
                : null;
            try {
                $existingTarget = $service->resolveExistingExamAndTestByTitles($examTitle, $testTitle, $preferredSectionForNewTest);
            } catch (InvalidArgumentException $e) {
                $this->error($e->getMessage());

                return self::FAILURE;
            }
            $ex = $existingTarget['exam'];
            $te = $existingTarget['test'];
            if ($te->wasRecentlyCreated) {
                $this->info("Created new test #{$te->id} \"{$te->title}\" under section \"{$te->section->name}\" on exam \"{$ex->name}\" ({$ex->code}).");
            } else {
                $this->info("Existing target: exam \"{$ex->name}\" ({$ex->code}), test #{$te->id} \"{$te->title}\" ({$te->section->name})");
            }
        }

        if ($existingTarget !== null && is_array($onlySections) && $onlySections !== []) {
            $te = $existingTarget['test'];
            if ($te->wasRecentlyCreated) {
                if (count($onlySections) > 1) {
                    $this->warn('--section: multiple values were given; the new test was placed using the exam\'s first section by sort order (pass exactly one --section=Name to choose a section).');
                }
            } else {
                $this->warn('--section is ignored when the test already exists (section comes from the existing test).');
            }
        }

        $onlySectionsForOpenAi = $existingTarget !== null ? null : $onlySections;

        $withSpeakingImages = (bool) $this->option('with-speaking-images');
        if ($withSpeakingImages) {
            $speakingScoped = $service->sectionScopeIncludesSpeaking($onlySections, $existingTarget);
            if (! $speakingScoped) {
                $this->warn('--with-speaking-images ignored: scope does not include Speaking (use --section=Speaking or target a Speaking test).');
                $withSpeakingImages = false;
            } else {
                $this->info('Speaking picture tasks: model will output image_generation_prompt + grading text; images generated after import.');
            }
        }

        try {
            if (is_string($path) && $path !== '') {
                if (! is_readable($path)) {
                    $this->error("File not readable: {$path}");

                    return self::FAILURE;
                }
                $raw = file_get_contents($path);
                if ($raw === false) {
                    $this->error("Could not read: {$path}");

                    return self::FAILURE;
                }
                $payload = $service->decodePayloadJson($raw);
                $this->info('Loaded JSON from file: '.$path);
                if ($questionsPerTestInt !== null) {
                    $this->warn('--questions-per-test applies only when generating via OpenAI; ignored for --file.');
                }
                if ($onlySections !== null && $onlySections !== []) {
                    $this->warn('--section applies only when generating via OpenAI; ignored for --file.');
                }
                if ($existingTarget !== null) {
                    $payload = $service->mergePayloadOntoExistingTest($payload, $existingTarget['exam'], $existingTarget['test']);
                    $this->info('Anchored file JSON to existing exam/test (DB metadata + questions from file).');
                }
            } else {
                if ($extra !== '') {
                    $this->comment('Extra prompt: '.$extra);
                }
                $payload = $service->generatePayload($extra, $model, $this->output, $questionsPerTestInt, $onlySectionsForOpenAi, $existingTarget, $withSpeakingImages);
            }

            $this->info('Validating payload structure…');
            $service->validatePayload($payload);
            $examN = count($payload['exams']);
            $this->info("Payload OK: {$examN} exam(s) in response.");
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        if ($this->option('dry-run')) {
            $this->warn('Dry run — printing JSON only; database unchanged.');
            if ($withSpeakingImages) {
                $this->comment('Note: --with-speaking-images would run image generation after import; skipped in dry-run.');
            }
            $this->line(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            return self::SUCCESS;
        }

        try {
            $service->importPayload($payload, $this->output, ! $this->option('no-question-preview'), $withSpeakingImages);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $count = count($payload['exams']);
        $this->info("Done. Processed {$count} exam(s); questions were appended where tests already existed.");

        return self::SUCCESS;
    }
}

