<?php

namespace Database\Seeders;

use App\Models\Exam;
use Illuminate\Database\Seeder;

class ExamSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            
            ['name' => 'IELTS General', 'code' => 'ielts_general', 'type' => 'general'],
            ['name' => 'CELPIP General', 'code' => 'celpip_general', 'type' => 'general'],
            
        ];

        foreach ($rows as $row) {
            Exam::query()->updateOrCreate(['code' => $row['code']], $row);
        }
    }
}
