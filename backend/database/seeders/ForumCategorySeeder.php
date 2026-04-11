<?php

namespace Database\Seeders;

use App\Models\ForumCategory;
use Illuminate\Database\Seeder;

class ForumCategorySeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['name' => 'General', 'slug' => 'general', 'description' => 'Introduce yourself and chat about BandReady.', 'sort_order' => 10],
            ['name' => 'IELTS', 'slug' => 'ielts', 'description' => 'Tips and questions about IELTS-style practice.', 'sort_order' => 20],
            ['name' => 'CELPIP', 'slug' => 'celpip', 'description' => 'CELPIP listening, reading, writing, speaking.', 'sort_order' => 30],
            ['name' => 'Feedback', 'slug' => 'feedback', 'description' => 'Ideas for the app — we read these.', 'sort_order' => 40],
        ];

        foreach ($rows as $row) {
            ForumCategory::query()->updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'sort_order' => $row['sort_order'],
                ]
            );
        }
    }
}
