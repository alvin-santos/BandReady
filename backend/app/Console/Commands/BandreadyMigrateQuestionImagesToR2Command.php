<?php

namespace App\Console\Commands;

use App\Models\Question;
use App\Services\OpenAiImageGenerationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BandreadyMigrateQuestionImagesToR2Command extends Command
{
    protected $signature = 'bandready:migrate-question-images-to-r2
                            {--dry-run : List actions only; no upload or database updates}
                            {--delete-local : After a successful R2 upload and DB update, delete the file from the public disk}
                            {--id= : Only process the question with this primary key}';

    protected $description = 'Copy question images from the Laravel public disk to R2 and update questions.image_url (skips rows already pointing at R2).';

    public function handle(OpenAiImageGenerationService $images): int
    {
        $dry = (bool) $this->option('dry-run');
        $deleteLocal = (bool) $this->option('delete-local');

        $query = Question::query()
            ->whereNotNull('image_url')
            ->where('image_url', '!=', '')
            ->orderBy('id');

        $idOpt = $this->option('id');
        if ($idOpt !== null && trim((string) $idOpt) !== '') {
            $id = (int) $idOpt;
            if ($id < 1) {
                $this->error('--id must be a positive integer.');

                return self::FAILURE;
            }
            $query->where('id', $id);
        }

        $count = (clone $query)->count();
        if ($count === 0) {
            $this->warn('No questions with a non-empty image_url.');

            return self::SUCCESS;
        }

        if ($dry) {
            $this->warn('Dry run — no uploads or database changes.');
        }

        $bar = $this->output->createProgressBar($count);
        $bar->start();

        $migrated = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($query->cursor() as $question) {
            $url = trim((string) $question->image_url);

            if ($images->isR2QuestionImageUrl($url)) {
                $skipped++;
                $bar->advance();

                continue;
            }

            $rel = $images->publicDiskRelativePathFromImageUrl($url);
            if ($rel === null) {
                $this->newLine();
                $this->warn('Q#'.$question->id.': skip — not a local /storage question image URL: '.Str::limit($url, 96));
                $skipped++;
                $bar->advance();

                continue;
            }

            if (! Storage::disk('public')->exists($rel)) {
                $this->newLine();
                $this->warn('Q#'.$question->id.': skip — file missing on public disk: '.$rel);
                $skipped++;
                $bar->advance();

                continue;
            }

            $r2Key = $rel;

            try {
                $body = Storage::disk('public')->get($rel);
            } catch (\Throwable $e) {
                $this->newLine();
                $this->error('Q#'.$question->id.': read failed — '.$e->getMessage());
                $failed++;
                $bar->advance();

                continue;
            }

            $publicUrl = $images->publicUrlForObject('r2', $r2Key);

            if ($dry) {
                $this->newLine();
                $this->line('Q#'.$question->id.': would upload key <info>'.$r2Key.'</info> → '.$publicUrl);
                $migrated++;
                $bar->advance();

                continue;
            }

            try {
                Storage::disk('r2')->put($r2Key, $body);
            } catch (\Throwable $e) {
                $this->newLine();
                $this->error('Q#'.$question->id.': R2 upload failed — '.$e->getMessage());
                $failed++;
                $bar->advance();

                continue;
            }

            $question->forceFill(['image_url' => $publicUrl])->save();

            if ($deleteLocal) {
                try {
                    Storage::disk('public')->delete($rel);
                } catch (\Throwable $e) {
                    $this->newLine();
                    $this->warn('Q#'.$question->id.': R2 OK but local delete failed — '.$e->getMessage());
                }
            }

            $migrated++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $label = $dry ? 'Planned migrations' : 'Migrated';
        $this->info("Done. {$label}: {$migrated}, skipped: {$skipped}, failed: {$failed}.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
