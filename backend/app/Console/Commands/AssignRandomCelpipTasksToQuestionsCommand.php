<?php

namespace App\Console\Commands;

use App\Models\Question;
use App\Support\CelpipOfficialTaskCatalog;
use Illuminate\Console\Command;

/**
 * Testing helper: backfill celpip_task_number / celpip_task_label from a random official task
 * for the question's section (Listening, Reading, Writing, Speaking).
 */
class AssignRandomCelpipTasksToQuestionsCommand extends Command
{
    protected $signature = 'bandready:assign-random-celpip-tasks
                            {--dry-run : List changes without writing to the database}';

    protected $description = 'Assign random CELPIP task number + label to questions missing them (for UI/testing; uses section from each question\'s test).';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        $query = Question::query()
            ->where(function ($q) {
                $q->whereNull('celpip_task_number')
                    ->orWhereNull('celpip_task_label')
                    ->orWhere('celpip_task_label', '');
            })
            ->with(['test.section']);

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('No questions need CELPIP task metadata.');

            return self::SUCCESS;
        }

        $this->info(($dry ? 'Would process' : 'Processing')." up to {$total} question(s)…");

        $updated = 0;
        $skippedNoSection = 0;
        $skippedNoCatalog = 0;

        $query->orderBy('id')->chunkById(200, function ($questions) use ($dry, &$updated, &$skippedNoSection, &$skippedNoCatalog) {
            foreach ($questions as $question) {
                $sectionName = $question->test?->section?->name;
                if ($sectionName === null || $sectionName === '') {
                    $skippedNoSection++;
                    if ($this->output->isVerbose()) {
                        $this->warn("Skip question #{$question->id}: test or section missing.");
                    }

                    continue;
                }

                $tasks = CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$sectionName] ?? null;
                if ($tasks === null || $tasks === []) {
                    $skippedNoCatalog++;
                    if ($this->output->isVerbose()) {
                        $this->warn("Skip question #{$question->id}: section \"{$sectionName}\" has no CELPIP task catalog.");
                    }

                    continue;
                }

                $num = $question->celpip_task_number;
                $label = is_string($question->celpip_task_label) ? trim($question->celpip_task_label) : '';

                if ($num !== null && isset($tasks[(int) $num]) && $label !== '') {
                    continue;
                }

                if ($num !== null && isset($tasks[(int) $num]) && $label === '') {
                    $canonical = $tasks[(int) $num];
                    if (! $dry) {
                        $question->update([
                            'celpip_task_label' => $canonical,
                        ]);
                    }
                    $updated++;
                    $this->line("Question #{$question->id} ({$sectionName}): set label to \"{$canonical}\" for existing task {$num}.");

                    continue;
                }

                $keys = array_keys($tasks);
                $pick = $keys[array_rand($keys)];
                $canonical = $tasks[$pick];

                if (! $dry) {
                    $question->update([
                        'celpip_task_number' => (int) $pick,
                        'celpip_task_label' => $canonical,
                    ]);
                }
                $updated++;
                $this->line("Question #{$question->id} ({$sectionName}): ".($dry ? 'would set' : 'set')." task {$pick} — {$canonical}");
            }
        });

        $suffix = $dry ? ' (dry run — no rows written)' : '';
        $this->newLine();
        $skipped = $skippedNoSection + $skippedNoCatalog;
        $this->info("Done. Updated: {$updated}{$suffix}. Skipped: {$skipped} (no section: {$skippedNoSection}, unknown section: {$skippedNoCatalog}).");

        return self::SUCCESS;
    }
}
