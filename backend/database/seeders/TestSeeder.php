<?php

namespace Database\Seeders;

use App\Models\Exam;
use App\Models\Section;
use App\Models\Test;
use Illuminate\Database\Seeder;

class TestSeeder extends Seeder
{
    public function run(): void
    {
        $this->removeDeprecatedTests();
        $this->seedTimedQuickPracticeTests();
        $this->seedFullMockTests();
        $this->seedQuickSamples();
    }

    private function removeDeprecatedTests(): void
    {
        Test::query()->whereIn('title', [
            'Full Mock — IELTS Academic',
            'Full Mock — IELTS General Training',
            'Full Mock — CELPIP General',
        ])->delete();
    }

    private function sectionId(string $examCode, string $sectionName): ?int
    {
        $exam = Exam::query()->where('code', $examCode)->first();
        if (! $exam) {
            return null;
        }

        return Section::query()->where('exam_id', $exam->id)->where('name', $sectionName)->value('id');
    }

    private function upsertSectionTest(string $examCode, string $sectionName, string $title, ?int $durationOverride = null, bool $available = true): void
    {
        $sid = $this->sectionId($examCode, $sectionName);
        if (! $sid) {
            return;
        }
        $examId = Exam::query()->where('code', $examCode)->value('id');
        $duration = $durationOverride ?? Section::query()->whereKey($sid)->value('duration_minutes') ?? 60;

        Test::query()->updateOrCreate(
            [
                'exam_id' => $examId,
                'title' => $title,
            ],
            [
                'section_id' => $sid,
                'difficulty' => 'medium',
                'is_full_mock' => false,
                'practice_mode' => 'quick',
                'duration_minutes' => $duration,
                'is_available' => $available,
            ]
        );
    }

    private function upsertFullMockTest(string $examCode, string $sectionName, string $title, ?int $durationOverride = null, bool $available = true): void
    {
        $sid = $this->sectionId($examCode, $sectionName);
        if (! $sid) {
            return;
        }
        $examId = Exam::query()->where('code', $examCode)->value('id');
        $duration = $durationOverride ?? Section::query()->whereKey($sid)->value('duration_minutes') ?? 60;

        Test::query()->updateOrCreate(
            [
                'exam_id' => $examId,
                'title' => $title,
            ],
            [
                'section_id' => $sid,
                'difficulty' => 'hard',
                'is_full_mock' => true,
                'practice_mode' => 'full',
                'duration_minutes' => $duration,
                'is_available' => $available,
            ]
        );
    }

    /** Timed single-skill sets (quick practice mode): IELTS General Training and CELPIP General only. */
    private function seedTimedQuickPracticeTests(): void
    {
        $this->upsertSectionTest('ielts_general', 'Reading', 'IELTS General Training — Reading (Section practice)', 60, true);
        $this->upsertSectionTest('ielts_general', 'Listening', 'IELTS General Training — Listening (Section practice)', 30, true);
        $this->upsertSectionTest('ielts_general', 'Writing', 'IELTS General Training — Writing (Section practice)', 60, true);
        $this->upsertSectionTest('ielts_general', 'Speaking', 'IELTS General Training — Speaking (Section practice)', 15, true);

        $this->upsertSectionTest('celpip_general', 'Listening', 'CELPIP General — Listening Practice Set 1', 47, true);
        $this->upsertSectionTest('celpip_general', 'Reading', 'CELPIP General — Reading (Section practice)', 60, true);
        $this->upsertSectionTest('celpip_general', 'Writing', 'CELPIP General — Writing (Section practice)', 53, true);
        $this->upsertSectionTest('celpip_general', 'Speaking', 'CELPIP General — Speaking (Section practice)', 20, true);
    }

    /** Full mock: IELTS General Training and CELPIP General only. */
    private function seedFullMockTests(): void
    {
        $ieltsName = Exam::query()->where('code', 'ielts_general')->value('name') ?? 'IELTS General Training';
        $this->upsertFullMockTest('ielts_general', 'Listening', "Full mock — {$ieltsName} — Listening", 30, true);
        $this->upsertFullMockTest('ielts_general', 'Reading', "Full mock — {$ieltsName} — Reading", 60, true);
        $this->upsertFullMockTest('ielts_general', 'Writing', "Full mock — {$ieltsName} — Writing", 60, true);
        $this->upsertFullMockTest('ielts_general', 'Speaking', "Full mock — {$ieltsName} — Speaking", 15, true);

        $celpipName = Exam::query()->where('code', 'celpip_general')->value('name') ?? 'CELPIP General';
        $this->upsertFullMockTest('celpip_general', 'Listening', "Full mock — {$celpipName} — Listening", 47, true);
        $this->upsertFullMockTest('celpip_general', 'Reading', "Full mock — {$celpipName} — Reading", 60, true);
        $this->upsertFullMockTest('celpip_general', 'Writing', "Full mock — {$celpipName} — Writing", 53, true);
        $this->upsertFullMockTest('celpip_general', 'Speaking', "Full mock — {$celpipName} — Speaking", 20, true);
    }

    /** Quick practice: IELTS General and CELPIP General only. */
    private function seedQuickSamples(): void
    {
        foreach (['ielts_general', 'celpip_general'] as $code) {
            $exam = Exam::query()->where('code', $code)->first();
            if (! $exam) {
                continue;
            }
            $section = Section::query()->where('exam_id', $exam->id)->orderBy('sort_order')->first();
            if (! $section) {
                continue;
            }
            Test::query()->updateOrCreate(
                [
                    'exam_id' => $exam->id,
                    'title' => 'Quick Practice — '.$exam->name,
                ],
                [
                    'section_id' => $section->id,
                    'difficulty' => 'easy',
                    'is_full_mock' => false,
                    'practice_mode' => 'quick',
                    'duration_minutes' => 10,
                    'is_available' => true,
                ]
            );
        }
    }
}
