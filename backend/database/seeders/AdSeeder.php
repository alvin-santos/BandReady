<?php

namespace Database\Seeders;

use App\Models\Ad;
use Illuminate\Database\Seeder;

class AdSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'title' => 'Top Banner — Prep Course',
                'location' => 'top_banner',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com/prep',
                'active' => true,
            ],
            [
                'title' => 'Sidebar — Tutoring',
                'location' => 'sidebar',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com/tutor',
                'active' => true,
            ],
            [
                'title' => 'Between Sections',
                'location' => 'between_sections',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Exam Left Rail',
                'location' => 'exam_rail_left',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Exam Right Rail',
                'location' => 'exam_rail_right',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Resources Page A',
                'location' => 'resources_a',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Resources Page B',
                'location' => 'resources_b',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Rankings Page A',
                'location' => 'rankings_a',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Rankings Page B',
                'location' => 'rankings_b',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Results Slot A',
                'location' => 'results_a',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com/results',
                'active' => true,
            ],
            [
                'title' => 'Results Slot B',
                'location' => 'results_b',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com/score',
                'active' => true,
            ],
            [
                'title' => 'Dashboard Native',
                'location' => 'dashboard',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com/dash',
                'active' => true,
            ],
            [
                'title' => 'Forum Leaderboard',
                'location' => 'forum_leaderboard',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Forum Sidebar',
                'location' => 'forum_sidebar',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Forum Board Inline',
                'location' => 'forum_category_inline',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
            [
                'title' => 'Forum Thread Inline',
                'location' => 'forum_thread_inline',
                'script' => null,
                'image' => null,
                'link' => 'https://example.com',
                'active' => true,
            ],
        ];

        foreach ($rows as $r) {
            Ad::query()->updateOrCreate(
                ['title' => $r['title'], 'location' => $r['location']],
                $r
            );
        }
    }
}
