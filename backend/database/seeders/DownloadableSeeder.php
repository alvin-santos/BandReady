<?php

namespace Database\Seeders;

use App\Models\Downloadable;
use Illuminate\Database\Seeder;

class DownloadableSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'title' => 'Exam day checklist',
                'slug' => 'exam-day-checklist',
                'description' => 'A one-page reminder: ID, timing, what to bring, and calm-before-you-start habits.',
                'requires_pro' => false,
                'sort_order' => 1,
                'download_filename' => 'bandready-exam-day-checklist.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady — Exam day checklist (free resource)
===============================================

Before you leave home
- Confirm test time, address, and room rules.
- Pack valid ID required by your test centre.
- Charge devices if the venue allows; otherwise leave distractions behind.

Mindset
- Sleep > cramming the night before.
- Eat something steady; hydrate normally.
- Arrive early; use a few minutes to breathe slowly.

During the test
- Skim instructions once; trust your practice pacing.
- Flag hard items and move on — come back if time allows.
- For writing/speaking, outline briefly before you produce full answers.

This file is for personal planning only. BandReady scores are practice estimates, not official band predictions.

TXT,
            ],
            [
                'title' => 'Quick study vocabulary sheet',
                'slug' => 'quick-vocabulary-sheet',
                'description' => 'Printable list of high-utility words and collocations to review in short bursts.',
                'requires_pro' => false,
                'sort_order' => 2,
                'download_filename' => 'bandready-vocabulary-burst.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady — Quick vocabulary bursts (free)
==========================================

Use 10-minute sessions: pick one column, say each word in a short sentence.

Opinion & stance
- maintain, undermine, outweigh, feasible, contentious, nuanced
- On balance, … / From a practical standpoint, …

Trends & data
- plateau, surge, marginal, proportion, negligible, respectively

Cause & effect
- stem from, give rise to, attributable to, consequently, thereby

Replace this list with your own words from real reading passages you struggled with — that beats generic lists.

TXT,
            ],
            [
                'title' => 'Writing task planner & band-style self-review',
                'slug' => 'writing-planner-pro',
                'description' => 'Pro: paragraph planner, timing checkpoints, and a short rubric to self-assess task response before AI feedback arrives.',
                'requires_pro' => true,
                'sort_order' => 3,
                'download_filename' => 'bandready-writing-planner-pro.txt',
                'mime_type' => 'text/plain',
                'body_text' => <<<'TXT'
BandReady Pro — Writing planner (practice only)
===============================================

Before you type
1) Task: circle the verb (discuss / agree / problem-solution).
2) Audience & register: formal, no slang.
3) Plan 4 paragraphs max: intro → body A → body B → conclusion.

Timing (suggested for ~40 min tasks)
- 0–5 min: plan + thesis
- 5–30 min: draft
- 30–38 min: cohesion pass (linking words, pronouns)
- 38–40 min: quick proofread

Self-review rubric (0–2 each)
- Task response: addresses all parts?
- Coherence: clear progression & paragraph roles?
- Lexical resource: precise words, not just rare ones?
- Grammar: variety + accuracy?

BandReady Pro unlocks writing tasks in the app; AI-assisted scoring may be added later. This sheet is for self-study only.

TXT,
            ],
        ];

        foreach ($items as $row) {
            Downloadable::query()->updateOrCreate(
                ['slug' => $row['slug']],
                array_merge($row, ['is_active' => true])
            );
        }
    }
}
