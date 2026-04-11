<?php

namespace App\Console\Commands;

use Database\Seeders\ForumThreadSeeder;
use Illuminate\Console\Command;

class SeedForumSamplesCommand extends Command
{
    protected $signature = 'bandready:seed-forum-samples
                            {--force : Delete existing forum threads/replies, then insert samples}';

    protected $description = 'Insert realistic IELTS/CELPIP sample forum threads (10 per topic). Use --force to replace existing content.';

    public function handle(): int
    {
        $seeder = new ForumThreadSeeder;
        $seeder->setCommand($this);

        if (! $this->option('force')) {
            $this->error('Requires --force: deletes all forum replies and threads, then inserts 40 sample threads. Example: php artisan bandready:seed-forum-samples --force');

            return self::FAILURE;
        }

        $seeder->runFresh(true);

        return self::SUCCESS;
    }
}
