<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            ExamSeeder::class,
            SectionSeeder::class,
            TestSeeder::class,
            // QuestionSeeder omitted: it deletes and recreates demo questions per test and would wipe OpenAI-imported content.
            // Run manually when you want the built-in bank: php artisan db:seed --class=QuestionSeeder
            AdSeeder::class,
            DownloadableSeeder::class,
            ForumCategorySeeder::class,
            UserSeeder::class,
            ForumThreadSeeder::class,
        ]);

        $site = SiteSetting::current();
        $site->rankings_public_enabled = true;
        $site->rankings_merge_fake = true;
        $site->rankings_fake_entries = [
            ['display_name' => 'Alex M.', 'score' => 94.2, 'exam_code' => null, 'practice_mode' => null],
            ['display_name' => 'Priya S.', 'score' => 91.0, 'exam_code' => null, 'practice_mode' => null],
            ['display_name' => 'Jordan K.', 'score' => 88.5, 'exam_code' => null, 'practice_mode' => null],
            ['display_name' => 'Sam L.', 'score' => 85.3, 'exam_code' => null, 'practice_mode' => null],
            ['display_name' => 'Taylor R.', 'score' => 82.1, 'exam_code' => null, 'practice_mode' => null],
            ['display_name' => 'Jamie P.', 'score' => 90.0, 'exam_code' => 'ielts_academic', 'practice_mode' => null],
            ['display_name' => 'Riley C.', 'score' => 87.4, 'exam_code' => 'ielts_general', 'practice_mode' => null],
            ['display_name' => 'Casey N.', 'score' => 86.0, 'exam_code' => 'celpip_general', 'practice_mode' => null],
            ['display_name' => 'Morgan D.', 'score' => 83.5, 'exam_code' => 'celpip_ls', 'practice_mode' => null],
            ['display_name' => 'Drew W.', 'score' => 89.0, 'exam_code' => null, 'practice_mode' => 'full'],
            ['display_name' => 'Quinn H.', 'score' => 84.0, 'exam_code' => null, 'practice_mode' => 'quick'],
            ['display_name' => 'Avery B.', 'score' => 80.5, 'exam_code' => null, 'practice_mode' => 'quick'],
            ['display_name' => 'Rohan V.', 'score' => 88.8, 'exam_code' => 'ielts_academic', 'practice_mode' => 'full'],
            ['display_name' => 'Nina O.', 'score' => 79.5, 'exam_code' => 'ielts_general', 'practice_mode' => 'quick'],
        ];
        $site->save();
    }
}
