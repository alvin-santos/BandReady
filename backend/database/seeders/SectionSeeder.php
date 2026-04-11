<?php

namespace Database\Seeders;

use App\Models\Exam;
use App\Models\Section;
use Illuminate\Database\Seeder;

class SectionSeeder extends Seeder
{
    public function run(): void
    {
        $defs = [
            'ielts_academic' => [
                ['name' => 'Reading', 'duration_minutes' => 60, 'sort_order' => 1],
                ['name' => 'Listening', 'duration_minutes' => 30, 'sort_order' => 2],
                ['name' => 'Writing', 'duration_minutes' => 60, 'sort_order' => 3],
                ['name' => 'Speaking', 'duration_minutes' => 15, 'sort_order' => 4],
            ],
            'ielts_general' => [
                ['name' => 'Reading', 'duration_minutes' => 60, 'sort_order' => 1],
                ['name' => 'Listening', 'duration_minutes' => 30, 'sort_order' => 2],
                ['name' => 'Writing', 'duration_minutes' => 60, 'sort_order' => 3],
                ['name' => 'Speaking', 'duration_minutes' => 15, 'sort_order' => 4],
            ],
            'celpip_general' => [
                ['name' => 'Listening', 'duration_minutes' => 47, 'sort_order' => 1],
                ['name' => 'Reading', 'duration_minutes' => 60, 'sort_order' => 2],
                ['name' => 'Writing', 'duration_minutes' => 53, 'sort_order' => 3],
                ['name' => 'Speaking', 'duration_minutes' => 20, 'sort_order' => 4],
            ],
            'celpip_ls' => [
                ['name' => 'Listening', 'duration_minutes' => 47, 'sort_order' => 1],
                ['name' => 'Speaking', 'duration_minutes' => 20, 'sort_order' => 2],
            ],
        ];

        foreach ($defs as $code => $sections) {
            $exam = Exam::query()->where('code', $code)->first();
            if (! $exam) {
                continue;
            }
            foreach ($sections as $s) {
                Section::query()->updateOrCreate(
                    [
                        'exam_id' => $exam->id,
                        'name' => $s['name'],
                    ],
                    [
                        'duration_minutes' => $s['duration_minutes'],
                        'sort_order' => $s['sort_order'],
                    ]
                );
            }
        }
    }
}
