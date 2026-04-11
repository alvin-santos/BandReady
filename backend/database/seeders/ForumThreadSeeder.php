<?php

namespace Database\Seeders;

use App\Models\ForumCategory;
use App\Models\ForumReply;
use App\Models\ForumThread;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ForumThreadSeeder extends Seeder
{
    public function run(): void
    {
        if (ForumThread::query()->exists()) {
            $this->command?->info('Forum threads already exist — skipping sample threads. Run `php artisan bandready:seed-forum-samples --force` to replace.');

            return;
        }

        $this->insertSampleThreads();
    }

    /**
     * Replace all forum content with sample IELTS/CELPIP-style threads (destructive when $deleteExisting).
     */
    public function runFresh(bool $deleteExisting = true): void
    {
        if ($deleteExisting) {
            DB::transaction(function () {
                ForumReply::query()->delete();
                ForumThread::query()->delete();
            });
        }

        $this->insertSampleThreads();
    }

    private function insertSampleThreads(): void
    {
        $userIds = User::query()->orderBy('id')->limit(8)->pluck('id')->all();
        if (count($userIds) < 2) {
            $this->command?->warn('Need at least 2 users in the database to seed forum threads.');

            return;
        }

        $bySlug = ForumCategory::query()->get()->keyBy('slug');
        $pickUser = static function (int $i) use ($userIds): int {
            return $userIds[$i % count($userIds)];
        };

        $topics = $this->topicDefinitions();

        DB::transaction(function () use ($bySlug, $pickUser, $topics) {
            foreach ($topics as $slug => $threads) {
                $cat = $bySlug->get($slug);
                if (! $cat) {
                    continue;
                }
                foreach ($threads as $ti => $def) {
                    $thread = ForumThread::query()->create([
                        'forum_category_id' => $cat->id,
                        'user_id' => $pickUser($ti),
                        'title' => $def['title'],
                        'body' => $def['body'],
                    ]);
                    foreach ($def['replies'] as $ri => $replyBody) {
                        ForumReply::query()->create([
                            'forum_thread_id' => $thread->id,
                            'user_id' => $pickUser($ti + $ri + 1),
                            'body' => $replyBody,
                        ]);
                    }
                }
            }
        });

        $this->command?->info('Seeded sample forum threads and replies (40 threads).');
    }

    /**
     * @return array<string, list<array{title: string, body: string, replies: list<string>}>>
     */
    private function topicDefinitions(): array
    {
        return [
            'general' => [
                [
                    'title' => 'Introduce yourself — exam goal & timeline?',
                    'body' => "Hi everyone. I'm aiming for Canadian PR and juggling a full-time job. Planning to sit IELTS Academic in about 4 months. How are you balancing prep with work or school?",
                    'replies' => [
                        'Same boat — night shifts for listening practice on the bus. I booked my slot 90 days out so I have a hard deadline.',
                        'I went part-time for two months before my test. Not everyone can, but having fewer hours made mock tests realistic.',
                        'I use BandReady mostly weekends + 45 min weekday mornings. Small but consistent beats random 5-hour cram days for me.',
                    ],
                ],
                [
                    'title' => 'How many hours per day do you actually study?',
                    'body' => 'Be honest — Instagram says 8 hours a day; my reality is closer to 1–2 with good weeks at 3. What’s sustainable for you?',
                    'replies' => [
                        'Tracked with a spreadsheet: average 2.1h over 11 weeks. Quality of drills mattered more than raw hours.',
                        'I do Pomodoro blocks. Four 25-minute sessions after work is my ceiling before my brain melts.',
                    ],
                ],
                [
                    'title' => 'Test anxiety — what actually helps?',
                    'body' => 'Heart races on mock speaking days. Besides breathing exercises, any rituals that calm you before IELTS or CELPIP?',
                    'replies' => [
                        'Same-day routine: same breakfast, leave early, no caffeine after 10am. Boring but it works.',
                        'I stopped comparing mock scores to strangers online. That alone cut anxiety a lot.',
                        'Cold water on wrists + 4-7-8 breathing right before the speaking window.',
                    ],
                ],
                [
                    'title' => 'First time using BandReady — what should I try first?',
                    'body' => 'Just signed up. Should I start with a full mock or quick practice? I’m on the free tier for now.',
                    'replies' => [
                        'I did one quick listening run to learn the UI, then a full mock on a quiet weekend.',
                        'Quick practice if you’re fragile on timing; full mock if you want the “exam day” shock early.',
                    ],
                ],
                [
                    'title' => 'Group study vs solo — what worked for your English prep?',
                    'body' => 'Debating a WhatsApp study group vs staying solo with YouTube + apps. Pros/cons from people who tried both?',
                    'replies' => [
                        'Group kept me accountable for speaking; solo was better for deep reading. Hybrid won.',
                        'Groups turned into meme chats. Solo + occasional partner swap for speaking only.',
                    ],
                ],
                [
                    'title' => 'How far in advance do you book your IELTS / CELPIP date?',
                    'body' => 'I’m scared of booking too early (lose motivation) or too late (no seats). How many weeks out do you usually commit?',
                    'replies' => [
                        'IELTS: 10 weeks out once my mock average hit my target minus 0.5 band.',
                        'CELPIP seats vanish in my city — I booked 12 weeks ahead and worked backward from there.',
                    ],
                ],
                [
                    'title' => 'Notebook vs apps for vocabulary — what do you use?',
                    'body' => 'Still love paper for collocations but Anki is tempting. What’s in your stack?',
                    'replies' => [
                        'Anki for words, Notion for essay templates. Paper only for mock exam notes now.',
                        'Google Sheets + example sentences from BandReady results page. Low tech but searchable.',
                    ],
                ],
                [
                    'title' => 'Do you take full rest days from English study?',
                    'body' => 'Burned out last month doing something every single day. Do you schedule a zero-English day?',
                    'replies' => [
                        'Sunday is off unless I have a mock scheduled. Brain needs recovery like muscles.',
                        'I still passive-listen to podcasts on “rest” days — not zero but low pressure.',
                    ],
                ],
                [
                    'title' => 'Target band / CLB — what are you aiming for and why?',
                    'body' => 'IELTS 8.0 L/R/W/S for me is the dream but I’ll take 7.5 if consistent. What’s your minimum acceptable score?',
                    'replies' => [
                        'CLB 9 across the board for EE — that’s the north star even if one skill lags a bit in mocks.',
                        '7.0 minimum to meet program rules; anything above is gravy.',
                    ],
                ],
                [
                    'title' => 'Coffee or tea during long reading sessions?',
                    'body' => 'Silly but real — caffeine helps my focus for IELTS-style passages but hurts sleep. What’s your compromise?',
                    'replies' => [
                        'Tea only after 2pm. Mornings: one coffee before practice tests.',
                        'Decaf + walks between passages. Sleep > marginal focus for me.',
                    ],
                ],
            ],

            'ielts' => [
                [
                    'title' => 'Where do you get free IELTS materials in 2026?',
                    'body' => 'Besides the official Cambridge books, what sites or PDFs do you trust for listening/reading? Trying not to drown in low-quality PDFs.',
                    'replies' => [
                        'British Council and IELTS.org sample tests first — then Cambridge 17–19 for timed reps.',
                        'I pair free samples with BandReady mocks so I get timing + auto scoring on objective bits.',
                        'YouTube has full tests but quality varies — I only use channels that show transcripts.',
                    ],
                ],
                [
                    'title' => 'Who is your YouTube IELTS mentor right now?',
                    'body' => 'I rotate between a few channels for Task 2 ideas and speaking demos. Who’s actually helping your score — not just motivation?',
                    'replies' => [
                        'E2 IELTS for structure, then I steal ideas from sample essays and rewrite in my own words.',
                        'I like teachers who show real student answers with corrections — less hype, more feedback.',
                        'Nobody replaces timed writing under exam rules — YouTube is homework, mocks are the real coach.',
                    ],
                ],
                [
                    'title' => 'Academic vs General Training — which did you pick?',
                    'body' => 'PR path pointed me to General; uni apps want Academic. How did you decide?',
                    'replies' => [
                        'General — everyday texts matched how I read at work. Academic felt overkill for my goals.',
                        'Academic because my MSc program required it. Double-check the institution, not just immigration.',
                    ],
                ],
                [
                    'title' => 'Listening: British vs Australian accents — how do you train?',
                    'body' => 'Cambridge audio feels mostly British; real life mixes accents. Any podcast playlists you use?',
                    'replies' => [
                        'BBC 6 Minute English + occasional ABC RN clips for Aussie rhythm.',
                        'I stopped chasing every accent — focused on keywords and signposting language instead.',
                    ],
                ],
                [
                    'title' => 'Writing Task 2: how do you finish a solid essay in 40 minutes?',
                    'body' => 'I can outline fast but my paragraphs balloon. Looking for a minimal skeleton that still hits TR and CC.',
                    'replies' => [
                        '4 paragraphs: intro + 2 body + conclusion. Each body = idea + explain + mini example.',
                        'I time-box: 5 min plan, 27 min write, 8 min fix grammar. No new ideas in last 5 minutes.',
                    ],
                ],
                [
                    'title' => 'Speaking Part 2 — cue card that actually scared you?',
                    'body' => 'Mine was “describe a law that affects your country.” Blanked for 20 seconds. What topic caught you off guard?',
                    'replies' => [
                        '“A time you helped someone” — sounded easy until I had no specific story. Now I keep 6–8 life stories ready.',
                        'I over-prepared famous places; under-prepared abstract topics. Lesson learned.',
                    ],
                ],
                [
                    'title' => 'Best book series for IELTS reading (real exam feel)?',
                    'body' => 'Cambridge is the standard — which numbers felt closest to recent tests for you?',
                    'replies' => [
                        '15–19 for me — older books for technique, newer for difficulty calibration.',
                        'I use any Cambridge set timed; difficulty jumps are normal, don’t chase “easier” tests.',
                    ],
                ],
                [
                    'title' => 'Computer-delivered IELTS — worth it if you type fast?',
                    'body' => 'My handwriting is messy; typing helps Task 1 tables. Any regrets from people who switched from paper?',
                    'replies' => [
                        'CD for writing only if you practice highlighting on screen — reading felt different at first.',
                        'Loved it — word count visible, editing easier. Speaking still human examiner in my center.',
                    ],
                ],
                [
                    'title' => 'How many full IELTS mocks before the real exam day?',
                    'body' => 'Some say 3, some say 15. What’s your sweet spot for stamina without burnout?',
                    'replies' => [
                        '5 full mocks over 8 weeks + weekly section drills. Diminishing returns after that for me.',
                        'Quality > count — I debriefed every mock for 45 min or it was wasted.',
                    ],
                ],
                [
                    'title' => 'Common writing mistakes you fixed after feedback?',
                    'body' => 'I kept writing “a lot of researches” and overusing “in conclusion.” What patterns did tutors or AI flag for you?',
                    'replies' => [
                        'Article errors (a/the) and singular/plural nouns — boring but cost me bands.',
                        'Task Achievement: I answered a slightly different question than asked. Now I underline key verbs in the prompt.',
                    ],
                ],
            ],

            'celpip' => [
                [
                    'title' => 'Where do you find realistic CELPIP listening audio?',
                    'body' => 'Official materials are limited — what do you use for everyday-conversation practice that matches test speed?',
                    'replies' => [
                        'Parliament of Canada clips + local news radio for North American English.',
                        'I mix official samples with BandReady listening mocks — timing matters more than accent variety for me.',
                    ],
                ],
                [
                    'title' => 'CELPIP-General vs CELPIP-LS — which are you taking?',
                    'body' => 'PR stream for me needs LS; a friend needs General for nursing. How did you confirm which code to register under?',
                    'replies' => [
                        'IRCC tool + provincial college requirements — don’t guess from Reddit threads.',
                        'I called the test center — five minutes saved me from booking the wrong module.',
                    ],
                ],
                [
                    'title' => 'Who’s your go-to YouTube channel for CELPIP speaking?',
                    'body' => 'Looking for channels that show actual task timing, not just tips slideshows.',
                    'replies' => [
                        'I follow a few tutors but record myself with a timer more than I watch videos now.',
                        'Channels that walk through Task 7/8 with a stopwatch help — anything without timed demos feels useless.',
                    ],
                ],
                [
                    'title' => 'Speaking: staying on topic for the full time — tips?',
                    'body' => 'I finish early and awkward silence kills my flow. How do you pad answers without rambling?',
                    'replies' => [
                        'ELI method: example, link, implication — one extra sentence each.',
                        'I prepare three bullet memories per topic type (people/place/event) and stretch with details.',
                    ],
                ],
                [
                    'title' => 'CELPIP reading: strategies for information vs opinion questions?',
                    'body' => 'Sometimes I overthink “writer’s attitude.” How do you separate fact from inference quickly?',
                    'replies' => [
                        'Underline only what the question asks — I used to read the whole passage every time.',
                        'Eliminate wrong answers first; two choices often half-true.',
                    ],
                ],
                [
                    'title' => 'Writing an email in ~10 minutes — is that realistic in practice?',
                    'body' => 'Prompts look simple until the clock starts. What’s your template for opening + request + close?',
                    'replies' => [
                        'I use a fixed greeting + 2 short body paragraphs + polite close. No creativity on test day.',
                        'Typing speed saved me — if you handwrite, practice that too.',
                    ],
                ],
                [
                    'title' => 'How strict are CELPIP section timers compared to mocks?',
                    'body' => 'Some apps let you pause — real test doesn’t. How do you simulate “no pause” at home?',
                    'replies' => [
                        'Phone in another room + BandReady strict mode when I’m logged in.',
                        'If I fat-finger pause in practice, I restart the section. Harsh but builds discipline.',
                    ],
                ],
                [
                    'title' => 'CLB 9 vs IELTS equivalents — what scores are you targeting?',
                    'body' => 'EE calculator language is confusing. What combo are you aiming for Express Entry?',
                    'replies' => [
                        'I used the official CLB grid and worked backward — one weak skill drags the whole profile.',
                        'Double-check the year — requirements changed before; always verify IRCC tables.',
                    ],
                ],
                [
                    'title' => 'Free vs paid CELPIP prep — what was actually worth paying for?',
                    'body' => 'Books, tutoring, apps — where did money move the needle for you?',
                    'replies' => [
                        'One hour with a tutor to fix speaking structure > any generic course for me.',
                        'Paid official prep only; everything else was free + mocks.',
                    ],
                ],
                [
                    'title' => 'CELPIP test day — what surprised you vs practice?',
                    'body' => 'Noise in the room? Keyboard sounds? Share what caught you off guard so others can prep.',
                    'replies' => [
                        'Waiting between modules felt longer than mocks — bring a snack and patience.',
                        'Headset mic check took longer than expected; arrive early.',
                    ],
                ],
            ],

            'feedback' => [
                [
                    'title' => 'Feature idea: more speaking prompts in BandReady',
                    'body' => 'Love the app — would pay for a bigger bank of CELPIP-style speaking scenarios with varied difficulty.',
                    'replies' => [
                        'Second this — especially oddball topics so Part 2 doesn’t feel repetitive.',
                        'Maybe community-submitted prompts with moderation?',
                    ],
                ],
                [
                    'title' => 'Dark mode for late-night practice sessions',
                    'body' => 'My eyes hurt after 90-minute reading mocks. A true dark theme would help.',
                    'replies' => [
                        'There’s a theme toggle in the header on our build — hope it lands for everyone soon.',
                        'Low brightness + dark mode = fewer headaches for me.',
                    ],
                ],
                [
                    'title' => 'Wishlist: printable weekly study checklist',
                    'body' => 'Would be nice to export a simple PDF checklist tied to the dashboard readiness view.',
                    'replies' => [
                        'I’d use that — crossing boxes feels more real than another Notion template.',
                    ],
                ],
                [
                    'title' => 'Can sectional timers be larger on small laptops?',
                    'body' => '1080p 13" screen — timer text is readable but stressful to hunt for under pressure.',
                    'replies' => [
                        'Sticky note with my own countdown as backup — not ideal.',
                        'Bigger font option would be accessibility win too.',
                    ],
                ],
                [
                    'title' => 'Mobile layout for quick reviews',
                    'body' => 'I sneak vocab on the phone — forum works; exam runner is tight on narrow screens.',
                    'replies' => [
                        'Same — I use desktop for full mocks only.',
                    ],
                ],
                [
                    'title' => 'Feedback on AI writing scores — how to interpret?',
                    'body' => 'The rubric-style breakdown helps but I still want a one-line “what to fix first.”',
                    'replies' => [
                        'Agree — prioritizing top 2 weaknesses would reduce overwhelm.',
                        'I treat AI as directional, not gospel.',
                    ],
                ],
                [
                    'title' => 'Leaderboards — motivating or stressful?',
                    'body' => 'Sometimes I chase scores; sometimes I hide the rankings page. Curious how others feel.',
                    'replies' => [
                        'Motivating when I’m climbing; toxic when I compare on bad days.',
                        'Optional opt-out per user would be nice.',
                    ],
                ],
                [
                    'title' => 'Explain sample “band” estimates in results',
                    'body' => 'A short tooltip comparing practice AI bands vs real exam would reduce confusion.',
                    'replies' => [
                        'Big +1 — newcomers think practice bands are official.',
                    ],
                ],
                [
                    'title' => 'Podcast-style listening passages in-app?',
                    'body' => 'Longer dialogue tracks would help train sustained attention like CELPIP listening.',
                    'replies' => [
                        'Would love optional 15–20 min sessions for stamina.',
                        'Maybe tie to specific exam programs so content stays relevant.',
                    ],
                ],
                [
                    'title' => 'Glad this community forum exists',
                    'body' => 'Nice to have a place that isn’t random Facebook groups. Thanks for shipping it.',
                    'replies' => [
                        'Same — focused on exams, not ads for sketchy courses.',
                        'Hope moderation stays light but consistent.',
                    ],
                ],
            ],
        ];
    }
}
