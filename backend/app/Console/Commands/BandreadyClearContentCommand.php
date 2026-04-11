<?php

namespace App\Console\Commands;

use App\Models\Ad;
use App\Models\Answer;
use App\Models\Attempt;
use App\Models\Downloadable;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Section;
use App\Models\SiteSetting;
use App\Models\Statistic;
use App\Models\Test;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

class BandreadyClearContentCommand extends Command
{
    protected $signature = 'bandready:clear-content
                            {--force : Skip confirmation prompt}
                            {--with-users : Also delete all users (dangerous)}
                            {--with-site-settings : Also delete site_settings rows (TTS blocklist, rankings config)}';

    protected $description = 'Delete exams, tests, questions, attempts, ads, downloadables, and related rows. Users are kept unless --with-users.';

    public function handle(): int
    {
        if (! $this->option('force')) {
            $warn = 'This permanently deletes application content (exams, questions, attempts, etc.).';
            if ($this->option('with-users')) {
                $warn .= ' ALL USERS will be removed.';
            }
            if (! $this->confirm($warn.' Continue?')) {
                return self::SUCCESS;
            }
        }

        DB::transaction(function () {
            Answer::query()->delete();
            Attempt::query()->delete();
            Question::query()->delete();
            Test::query()->delete();
            Section::query()->delete();
            Exam::query()->delete();
            Statistic::query()->delete();
            Ad::query()->delete();
            Downloadable::query()->delete();

            if ($this->option('with-site-settings')) {
                SiteSetting::query()->delete();
            }

            if ($this->option('with-users')) {
                PersonalAccessToken::query()->delete();
                User::query()->delete();
            }
        });

        $this->info('Content cleared.');
        if (! $this->option('with-site-settings')) {
            $this->comment('Site settings (e.g. TTS voice blocklist) were kept. Use --with-site-settings to remove them.');
        }

        return self::SUCCESS;
    }
}
