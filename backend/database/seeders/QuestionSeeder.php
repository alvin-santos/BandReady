<?php

namespace Database\Seeders;

use App\Models\Question;
use App\Models\Test;
use Illuminate\Database\Seeder;

class QuestionSeeder extends Seeder
{
    public function run(): void
    {
        //IMPORTANT: dont run question seeder for now because it wipes all the questions and creates new ones. This is only needed when you want to regenerate the questions from scratch.
        return;

        $this->celpipListening();
        $this->celpipGeneralSpeakingSection();
        $this->ieltsGeneralSections();
        $this->celpipGeneralReadingWritingSections();
        $this->quickPracticeQuestions();
        $this->fullMockQuestions();
        $this->ieltsSpeakingSectionPractice();
    }

    /**
     * Listening items: `audio_script` is the spoken passage (dialogue). `exp` is post-answer explanation only — never read aloud.
     *
     * @return array<int, array{stem: string, opts: array{0: string, 1: string, 2: string, 3: string}, ans: string, exp: string, script: string}>
     */
    private function celpipListeningTenScenarios(): array
    {
        return [
            ['stem' => 'You hear a short conversation about rescheduling a dentist appointment. The patient agrees to move the visit to:', 'opts' => ['Tuesday 3pm', 'Wednesday 10am', 'Friday 2pm', 'Monday 9am'], 'ans' => 'B', 'exp' => 'The receptionist offers Wednesday 10am and the patient accepts.', 'script' => <<<'SCRIPT'
Receptionist: Good morning, Riverside Dental, how can I help you?
Patient: Hi, I have an appointment on Tuesday at two p.m., but I need to change it—I have a conflict that afternoon.
Receptionist: I can offer you Wednesday at ten a.m., or Friday at two p.m.
Patient: Wednesday at ten a.m. works for me. Please book that.
Receptionist: You are now confirmed for Wednesday at ten a.m. Thank you.
SCRIPT],
            ['stem' => 'A customer calls about a delayed parcel. The agent says the package will arrive:', 'opts' => ['Today before 6pm', 'Tomorrow', 'Next week', 'It was lost'], 'ans' => 'B', 'exp' => 'The agent confirms delivery for the next business day.', 'script' => <<<'SCRIPT'
Agent: Shipping support, this is Alex speaking.
Customer: My tracking still says delayed. Where is my parcel?
Agent: I am sorry for the wait. It will arrive tomorrow on the next business day delivery.
Customer: Okay, thanks for checking.
SCRIPT],
            ['stem' => 'Two colleagues discuss a project deadline. They decide to:', 'opts' => ['Cancel the project', 'Request a two-day extension', 'Finish early', 'Hire five new staff'], 'ans' => 'B', 'exp' => 'They agree to ask their manager for a short extension.', 'script' => <<<'SCRIPT'
Sam: We cannot finish the report by Friday with the new data.
Jordan: I agree. Let us ask our manager for a two-day extension.
Sam: Good idea. I will email her now.
SCRIPT],
            ['stem' => 'A weather report for the weekend predicts:', 'opts' => ['Heavy snow', 'Light rain Saturday, sunny Sunday', 'Hurricane', 'Fog all weekend'], 'ans' => 'B', 'exp' => 'Saturday shows showers; Sunday clears.', 'script' => <<<'SCRIPT'
Presenter: Here is your weekend outlook. Saturday will bring light rain in the afternoon. Sunday turns sunny with clear skies.
SCRIPT],
            ['stem' => 'In a public announcement, the library will:', 'opts' => ['Close permanently', 'Open late on Thursdays', 'Stop lending books', 'Move to another city'], 'ans' => 'B', 'exp' => 'Extended Thursday hours are announced.', 'script' => <<<'SCRIPT'
Announcer: The Westside Public Library will extend Thursday evening hours by one hour for the rest of this month. Thank you for your patience.
SCRIPT],
            ['stem' => 'A person asks for directions to the nearest ATM. The answer given is:', 'opts' => ['Across from the pharmacy', 'Inside the school', 'At the airport only', 'There is no ATM'], 'ans' => 'A', 'exp' => 'The ATM is located opposite the pharmacy entrance.', 'script' => <<<'SCRIPT'
Tourist: Excuse me, where is the nearest cash machine?
Local: There is an ATM right across from the pharmacy entrance, on the other side of the street.
Tourist: Perfect, thank you.
SCRIPT],
            ['stem' => 'A supervisor explains a safety rule: employees must:', 'opts' => ['Ignore helmets', 'Wear ID badges in secure areas', 'Work without breaks', 'Turn off alarms'], 'ans' => 'B', 'exp' => 'Badges are mandatory in secured zones.', 'script' => <<<'SCRIPT'
Supervisor: Quick reminder: in all secured areas, employees must wear visible ID badges at all times. Thank you.
SCRIPT],
            ['stem' => 'Friends plan a dinner reservation for:', 'opts' => ['6 people at 7:30pm', '2 people at 5pm', '10 people at noon', 'They cancel'], 'ans' => 'A', 'exp' => 'They confirm six guests at 7:30pm.', 'script' => <<<'SCRIPT'
Alex: Can we book for six people at seven thirty tonight?
Riley: I will call the restaurant. … Yes, they can do six at seven thirty p.m.
Alex: Great.
SCRIPT],
            ['stem' => 'A news snippet mentions city council voting to:', 'opts' => ['Ban bicycles', 'Fund new bike lanes', 'Remove all buses', 'Close parks'], 'ans' => 'B', 'exp' => 'Council approves funding for protected bike lanes.', 'script' => <<<'SCRIPT'
Reporter: City council last night voted to fund new protected bike lanes along Main Street, with construction starting next spring.
SCRIPT],
            ['stem' => 'In a voicemail, the caller’s main request is to:', 'opts' => ['Return a phone call about an invoice', 'Buy concert tickets', 'Book a vacation', 'Quit a job'], 'ans' => 'A', 'exp' => 'The caller asks for a callback regarding an unpaid invoice.', 'script' => <<<'SCRIPT'
Caller: Hi, this is Jamie from Oak Supplies. Please call me back about invoice number four two one seven—it is still unpaid. My number is five five five, zero one two three. Thanks.
SCRIPT],
        ];
    }

    /**
     * Two extra stems used in the shared listening bank (IELTS slices, etc.).
     *
     * @return array<int, array{stem: string, opts: array{0: string, 1: string, 2: string, 3: string}, ans: string, exp: string, script: string}>
     */
    private function listeningStemsPharmacyAndTransit(): array
    {
        return [
            ['stem' => 'You hear a pharmacy call confirming a prescription pickup window. The customer agrees to collect it:', 'opts' => ['Before noon today', 'Tomorrow after 4pm', 'Next month', 'Only by mail'], 'ans' => 'B', 'exp' => 'Pickup is confirmed for tomorrow after 4pm.', 'script' => <<<'SCRIPT'
Pharmacist: Your prescription is ready for pickup.
Customer: When can I get it?
Pharmacist: You can collect it tomorrow any time after four p.m.
Customer: Tomorrow after four p.m works. Thanks.
SCRIPT],
            ['stem' => 'A transit announcement states the next train to City Centre departs from:', 'opts' => ['Platform 1', 'Platform 3', 'Platform 9', 'Bus bay only'], 'ans' => 'B', 'exp' => 'The announcement specifies platform 3.', 'script' => <<<'SCRIPT'
Announcer: Attention passengers: the next train to City Centre now departs from platform three. Platform three for City Centre.
SCRIPT],
        ];
    }

    private function celpipListening(): void
    {
        $test = Test::query()->where('title', 'CELPIP General — Listening Practice Set 1')->first();
        if (! $test) {
            return;
        }

        Question::query()->where('test_id', $test->id)->delete();

        $order = 1;
        foreach ($this->celpipListeningTenScenarios() as $row) {
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'multiple_choice',
                'question_text' => $row['stem'],
                'passage_text' => 'Listen once, then answer. Use Play to hear the clip again. The script is not shown on screen.',
                'audio_url' => null,
                'audio_script' => trim($row['script']),
                'options_json' => [
                    'A' => $row['opts'][0],
                    'B' => $row['opts'][1],
                    'C' => $row['opts'][2],
                    'D' => $row['opts'][3],
                ],
                'correct_answer' => $row['ans'],
                'explanation' => $row['exp'],
                'order' => $order++,
            ]);
        }
    }

    private function celpipGeneralSpeakingSection(): void
    {
        $test = Test::query()->where('title', 'CELPIP General — Speaking (Section practice)')->first();
        if (! $test) {
            return;
        }

        Question::query()->where('test_id', $test->id)->delete();
        $this->insertCelpipGeneralSpeakingPrompts($test);
    }

    /** Shared prompt bank for CELPIP General speaking (quick timed sets + full mock). */
    private function insertCelpipGeneralSpeakingPrompts(Test $test): void
    {
        $prompts = [
            'Describe your favourite season and explain how it affects your daily routine.',
            'You have been invited to a community cleanup. Persuade a friend to join you.',
            'Talk about a skill you learned recently and why it matters to you.',
            'Your neighbour plays loud music late at night. Explain the problem and suggest a solution.',
            'Describe a memorable trip and what made it special.',
            'Give advice to someone who is nervous about a job interview.',
            'Compare shopping online with shopping in stores. Which do you prefer?',
            'Explain how you would prepare for a severe weather warning in your area.',
        ];

        $order = 1;
        foreach ($prompts as $text) {
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'speaking_prompt',
                'question_text' => $text,
                'passage_text' => 'Record a 60–90 second response (simulation: type a script as practice).',
                'correct_answer' => 'Holistic: fluency, vocabulary, organization.',
                'explanation' => 'CELPIP evaluates functional speaking; use clear structure and examples.',
                'order' => $order++,
            ]);
        }
    }

    private function fullMockQuestions(): void
    {
        $tests = Test::query()->where('practice_mode', 'full')->with(['exam', 'section'])->get();
        foreach ($tests as $test) {
            Question::query()->where('test_id', $test->id)->delete();
            if (! $test->is_available) {
                continue;
            }
            $code = $test->exam?->code;
            $section = $test->section?->name;
            if ($code === 'ielts_general' && $section === 'Reading') {
                $this->seedIeltsFullMockReading($test);

                continue;
            }
            if ($code === 'ielts_general' && $section === 'Listening') {
                $this->seedIeltsFullMockListening($test);

                continue;
            }
            if ($code === 'ielts_general' && $section === 'Writing') {
                $this->seedIeltsFullMockWriting($test);

                continue;
            }
            if ($code === 'ielts_general' && $section === 'Speaking') {
                $this->seedIeltsSpeakingAiConversation($test);

                continue;
            }
            if ($code === 'celpip_general' && $section === 'Listening') {
                $this->seedCelpipFullMockListening($test);

                continue;
            }
            if ($code === 'celpip_general' && $section === 'Reading') {
                $this->seedCelpipFullMockReading($test);

                continue;
            }
            if ($code === 'celpip_general' && $section === 'Writing') {
                $this->seedCelpipFullMockWriting($test);

                continue;
            }
            if ($code === 'celpip_general' && $section === 'Speaking') {
                $this->insertCelpipGeneralSpeakingPrompts($test);

                continue;
            }
            $this->seedGenericFullMockPlaceholder($test);
        }
    }

    /**
     * One IELTS Speaking item: OpenAI-driven examiner dialogue (Parts 1–3) in the app UI.
     */
    private function seedIeltsSpeakingAiConversation(Test $test): void
    {
        Question::query()->create([
            'test_id' => $test->id,
            'type' => 'speaking_prompt',
            'question_text' => 'Complete a full IELTS-style Speaking interview with an AI examiner (Parts 1–3). Use the microphone for each reply. Part 2 includes one minute to prepare before your long turn.',
            'passage_text' => 'Practice only: not a live examiner. Your turns are transcribed and scored from text (Pro: AI feedback).',
            'audio_script' => null,
            'options_json' => ['ielts_speaking' => ['mode' => 'ai_conversation']],
            'correct_answer' => 'IELTS-style interview: answer naturally; develop Part 3 ideas; use the Part 2 preparation minute. Assessed on English use from candidate transcripts.',
            'explanation' => 'The examiner is generated by AI for each session; follow their instructions as in a real test.',
            'order' => 1,
        ]);
        $test->update(['ielts_speaking_picks' => null]);
    }

    private function ieltsSpeakingSectionPractice(): void
    {
        foreach ([
            'IELTS General Training — Speaking (Section practice)',
        ] as $title) {
            $test = Test::query()->where('title', $title)->first();
            if (! $test) {
                continue;
            }
            Question::query()->where('test_id', $test->id)->delete();
            $this->seedIeltsSpeakingAiConversation($test);
        }
    }

    private function seedGenericFullMockPlaceholder(Test $test): void
    {
        for ($i = 1; $i <= 5; $i++) {
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'multiple_choice',
                'question_text' => "Practice item {$i}. Choose the best option based on the short note below.",
                'passage_text' => 'This placeholder set exists so navigation and timing still work if a program/section pair has no bespoke bank yet.',
                'options_json' => [
                    'A' => 'First option',
                    'B' => 'Second option (key)',
                    'C' => 'Third option',
                    'D' => 'Fourth option',
                ],
                'correct_answer' => 'B',
                'explanation' => 'Keyed to B for automated scoring in this demo bank.',
                'order' => $i,
            ]);
        }
    }

    private function seedIeltsFullMockReading(Test $test): void
    {
        $p1 = <<<'TXT'
Remote work policies expanded rapidly after 2020, but their long-term effects on productivity remain debated. Supporters highlight fewer commutes and wider talent pools; skeptics cite weaker mentorship and blurred boundaries between home and office. Hybrid schedules—two or three office days per week—are now the most common compromise in knowledge industries.

Surveys suggest outcomes depend heavily on role clarity and asynchronous communication norms. Teams that document decisions and rotate meeting times across time zones report fewer misunderstandings than those that rely on ad hoc chats alone. Managers increasingly measure results by deliverables rather than hours online, though some industries still require on-site presence for compliance or equipment reasons.
TXT;

        $p2 = <<<'TXT'
Public libraries have shifted from quiet reading rooms to community hubs offering digital literacy classes, maker spaces, and language conversation circles. Funding often mixes municipal budgets with grants and volunteer hours. Usage data show rising attendance among newcomers and seniors, while traditional book lending remains important but no longer dominant in many branches.

Critics argue that expanded programming strains limited staff time. Advocates respond that libraries remain one of the few free, trusted spaces for lifelong learning, especially where broadband at home is unreliable. Partnerships with schools and nonprofits help extend reach without duplicating services.
TXT;

        $bank = [
            [$p1, [
                ['q' => 'What is the most common compromise mentioned for knowledge industries?', 'opts' => ['Fully remote forever', 'Hybrid schedules with some office days', 'Five days in office', 'No written policy'], 'ans' => 'B', 'exp' => 'Hybrid schedules are described as the most common compromise.'],
                ['q' => 'According to the passage, surveys suggest outcomes depend on:', 'opts' => ['Office décor', 'Role clarity and async communication norms', 'City population only', 'Printing costs'], 'ans' => 'B', 'exp' => 'The text ties outcomes to role clarity and asynchronous norms.'],
                ['q' => 'Teams that document decisions tend to have:', 'opts' => ['More misunderstandings', 'Fewer misunderstandings than chat-only teams', 'No meetings', 'Mandatory video on at all times'], 'ans' => 'B', 'exp' => 'Documented decisions reduce misunderstandings.'],
                ['q' => 'Managers increasingly measure results by:', 'opts' => ['Hours online only', 'Deliverables rather than hours online', 'Email volume', 'Desk location'], 'ans' => 'B', 'exp' => 'Deliverables over hours online.'],
                ['q' => 'Skeptics worry remote work can weaken:', 'opts' => ['Mentorship', 'Internet speed', 'Holiday pay', 'Tax collection'], 'ans' => 'A', 'exp' => 'Skeptics cite weaker mentorship.'],
                ['q' => 'Supporters mention wider:', 'opts' => ['Parking lots', 'Talent pools', 'Office rents', 'Printer sales'], 'ans' => 'B', 'exp' => 'Wider talent pools are highlighted.'],
                ['q' => 'The passage implies hybrid models try to balance:', 'opts' => ['Shipping and logistics', 'Remote benefits with in-person needs', 'Only cost cutting', 'Only recruitment'], 'ans' => 'B', 'exp' => 'Hybrid balances remote benefits with office needs.'],
                ['q' => 'Asynchronous communication refers partly to:', 'opts' => ['Only phone calls', 'Work not requiring simultaneous presence', 'Paper mail', 'Live TV'], 'ans' => 'B', 'exp' => 'Async work does not require everyone online at once.'],
                ['q' => '“Blurred boundaries” in the passage refers to:', 'opts' => ['Art projects', 'Home vs office separation', 'Maps', 'Video resolution'], 'ans' => 'B', 'exp' => 'Boundaries between home and office blur.'],
                ['q' => 'The overall tone of the first passage is:', 'opts' => ['Purely fictional', 'Analytical about trade-offs', 'Hostile to technology', 'Only about finance'], 'ans' => 'B', 'exp' => 'The passage weighs benefits and drawbacks.'],
            ]],
            [$p2, [
                ['q' => 'Libraries today are described as shifting toward:', 'opts' => ['Only book storage', 'Community hubs with classes and maker spaces', 'Private clubs', 'Retail malls'], 'ans' => 'B', 'exp' => 'They are hubs with classes and maker spaces.'],
                ['q' => 'Funding is said to mix:', 'opts' => ['Only federal loans', 'Municipal budgets with grants and volunteers', 'Student tuition', 'Ticket sales'], 'ans' => 'B', 'exp' => 'Municipal budgets plus grants and volunteers.'],
                ['q' => 'Rising attendance is noted among:', 'opts' => ['Only toddlers', 'Newcomers and seniors', 'Only athletes', 'Only publishers'], 'ans' => 'B', 'exp' => 'Newcomers and seniors show rising attendance.'],
                ['q' => 'Critics argue expanded programming can:', 'opts' => ['Automatically reduce costs', 'Strain limited staff time', 'Eliminate volunteers', 'Remove books'], 'ans' => 'B', 'exp' => 'Programming strains staff time.'],
                ['q' => 'Advocates say libraries are trusted spaces especially when:', 'opts' => ['Broadband at home is unreliable', 'Weather is perfect', 'Schools are closed forever', 'Books are banned'], 'ans' => 'A', 'exp' => 'Especially where home broadband is unreliable.'],
                ['q' => 'Partnerships are said to help:', 'opts' => ['Duplicate every school class', 'Extend reach without duplicating services', 'Replace municipalities', 'End grants'], 'ans' => 'B', 'exp' => 'Partnerships extend reach without duplication.'],
                ['q' => 'Traditional book lending is:', 'opts' => ['Described as unimportant everywhere', 'Still important though not always dominant', 'Illegal', 'Only digital'], 'ans' => 'B', 'exp' => 'Book lending remains important but not always dominant.'],
                ['q' => 'Maker spaces are mentioned as:', 'opts' => ['Only for chefs', 'Part of expanded library offerings', 'Airport lounges', 'Private offices'], 'ans' => 'B', 'exp' => 'Maker spaces are part of expanded offerings.'],
                ['q' => 'Language conversation circles are aimed at:', 'opts' => ['Only staff', 'Community learning and inclusion', 'Selling software', 'Sports training'], 'ans' => 'B', 'exp' => 'They support community learning.'],
                ['q' => 'The second passage mainly contrasts:', 'opts' => ['Critics and advocates', 'Two unrelated topics', 'Only budgets', 'Only architecture'], 'ans' => 'A', 'exp' => 'It presents critics and advocates.'],
            ]],
        ];

        $order = 1;
        foreach ($bank as [$passage, $items]) {
            foreach ($items as $row) {
                Question::query()->create([
                    'test_id' => $test->id,
                    'type' => 'multiple_choice',
                    'question_text' => $row['q'],
                    'passage_text' => $passage,
                    'options_json' => [
                        'A' => $row['opts'][0],
                        'B' => $row['opts'][1],
                        'C' => $row['opts'][2],
                        'D' => $row['opts'][3],
                    ],
                    'correct_answer' => $row['ans'],
                    'explanation' => $row['exp'],
                    'order' => $order++,
                ]);
            }
        }
    }

    /**
     * Spoken passages for full-mock CELPIP listening (same order as $stems in seedCelpipFullMockListening).
     *
     * @return array<int, string>
     */
    private function celpipFullMockListeningDialogues(): array
    {
        $pt = $this->listeningStemsPharmacyAndTransit();

        return [
            trim($pt[0]['script']),
            trim($pt[1]['script']),
            <<<'SCRIPT'
Chris: Want to grab coffee later?
Pat: Sure—let us meet at the café on Main Street; it is quieter than the lobby.
Chris: Works for me. See you there.
SCRIPT,
            <<<'SCRIPT'
Landlord: Hi, this is your building manager. Rent will go up, effective the first day of next month, not immediately. Thanks.
SCRIPT,
            <<<'SCRIPT'
Coach: Today we focus on defensive drills—footwork first, then positioning. Nutrition talk is next week.
SCRIPT,
            <<<'SCRIPT'
Clerk: Heads up—the berry sale ends tonight at store closing, not Sunday.
Customer: Got it, I will come back before then.
SCRIPT,
            <<<'SCRIPT'
Agent: Please restart your router, wait five minutes, and call us back if the problem is still there.
SCRIPT,
            <<<'SCRIPT'
Guide: The special exhibit you asked about closes in two weeks—we do not have tickets after that window.
SCRIPT,
            <<<'SCRIPT'
Manager: We would like a second interview with you—Wednesday at ten a.m., in person in suite four oh two.
SCRIPT,
            <<<'SCRIPT'
Voiceover: This weekend only—get a full vehicle inspection at half price at participating shops.
SCRIPT,
            <<<'SCRIPT'
Neighbor: The crew said construction noise should stop by Friday at five p.m.
SCRIPT,
            <<<'SCRIPT'
Reception: I can extend your checkout until one p.m. today—does that work?
Guest: Yes, one p.m. is perfect.
SCRIPT,
            <<<'SCRIPT'
Instructor: I can give you two extra days on the essay—submit by Tuesday night.
Student: Thank you, that helps a lot.
SCRIPT,
            <<<'SCRIPT'
Announcer: When daylight saving time begins, replace the batteries in your smoke alarms—it is a simple habit that saves lives.
SCRIPT,
            <<<'SCRIPT'
Hold message: Thank you for waiting. Your estimated time to speak with an agent is about ten minutes.
SCRIPT,
            <<<'SCRIPT'
Morgan: My bus line changed—want to carpool home?
Sam: Yes, same time as usual works.
SCRIPT,
            <<<'SCRIPT'
Speaker: Please confirm workshop attendance by email before Friday—we cannot hold your seat after that.
SCRIPT,
            <<<'SCRIPT'
Commentator: And the final score tonight: two to one—what a finish downtown.
SCRIPT,
        ];
    }

    private function seedCelpipFullMockListening(Test $test): void
    {
        $stems = [
            ['stem' => 'You hear a pharmacy call confirming a prescription pickup window. The customer agrees to collect it:', 'opts' => ['Before noon today', 'Tomorrow after 4pm', 'Next month', 'Only by mail'], 'ans' => 'B', 'exp' => 'Pickup is confirmed for tomorrow after 4pm.'],
            ['stem' => 'A transit announcement states the next train to City Centre departs from:', 'opts' => ['Platform 1', 'Platform 3', 'Platform 9', 'Bus bay only'], 'ans' => 'B', 'exp' => 'The announcement specifies platform 3.'],
            ['stem' => 'Two friends plan to meet for coffee. They settle on:', 'opts' => ['The library lobby', 'A café on Main Street', 'A stadium', 'An airport lounge'], 'ans' => 'B', 'exp' => 'They choose the café on Main Street.'],
            ['stem' => 'A landlord leaves a message about a rent increase effective:', 'opts' => ['Immediately', 'Next month on the first', 'Never', 'Last year'], 'ans' => 'B', 'exp' => 'The increase takes effect next month on the first.'],
            ['stem' => 'A coach explains that practice today will focus on:', 'opts' => ['Nutrition only', 'Defensive drills', 'Ticket sales', 'Uniform design'], 'ans' => 'B', 'exp' => 'Today emphasizes defensive drills.'],
            ['stem' => 'A grocery clerk tells the shopper the sale on berries ends:', 'opts' => ['Tonight at closing', 'Sunday evening', 'Next summer', 'Never'], 'ans' => 'A', 'exp' => 'The sale ends tonight at closing.'],
            ['stem' => 'A tech support agent asks the caller to restart the router and call back if:', 'opts' => ['The lights blink', 'The issue persists after five minutes', 'It rains', 'It is lunchtime'], 'ans' => 'B', 'exp' => 'Call back if the issue persists after five minutes.'],
            ['stem' => 'A museum guide notes the special exhibit closes in:', 'opts' => ['One hour', 'Two weeks', 'Five minutes', 'Ten years'], 'ans' => 'B', 'exp' => 'The guide says the exhibit closes in two weeks.'],
            ['stem' => 'A hiring manager invites the candidate to a second interview on:', 'opts' => ['Monday by phone', 'Wednesday at 10am in person', 'Friday by fax', 'Sunday midnight'], 'ans' => 'B', 'exp' => 'Second interview is Wednesday at 10am in person.'],
            ['stem' => 'A radio ad promotes a car inspection deal valid:', 'opts' => ['Only for trucks', 'This weekend only', 'For children', 'On boats'], 'ans' => 'B', 'exp' => 'The deal is valid this weekend only.'],
            ['stem' => 'Neighbors discuss noise from construction. It is expected to end:', 'opts' => ['Tonight', 'Friday at 5pm', 'Never', 'Yesterday'], 'ans' => 'B', 'exp' => 'Construction noise should end Friday at 5pm.'],
            ['stem' => 'A receptionist confirms a hotel late checkout until:', 'opts' => ['8am', '1pm', 'Midnight next week', 'Noon yesterday'], 'ans' => 'B', 'exp' => 'Late checkout is approved until 1pm.'],
            ['stem' => 'A student asks about an essay extension. The instructor grants:', 'opts' => ['No extension', 'Two extra days', 'One year', 'Extra pages only'], 'ans' => 'B', 'exp' => 'The instructor grants two extra days.'],
            ['stem' => 'A public service message reminds listeners to change smoke alarm batteries:', 'opts' => ['Daily', 'When daylight saving time begins', 'Never', 'Only if silent'], 'ans' => 'B', 'exp' => 'Change batteries when daylight saving time begins.'],
            ['stem' => 'A customer service line estimates wait time of:', 'opts' => ['Under one minute', 'About ten minutes', 'Three days', 'Six hours exactly'], 'ans' => 'B', 'exp' => 'The estimate is about ten minutes.'],
            ['stem' => 'Two coworkers decide to share a ride home because:', 'opts' => ['Fuel prices rose', 'The bus route changed', 'The office moved to another country', 'Parking is free for trucks'], 'ans' => 'B', 'exp' => 'They share a ride because the bus route changed.'],
            ['stem' => 'A voicemail asks the listener to confirm attendance for a workshop by:', 'opts' => ['Fax', 'Email before Friday', 'Telegram only', 'Postcard'], 'ans' => 'B', 'exp' => 'Confirm by email before Friday.'],
            ['stem' => 'A sports broadcast reports the final score as:', 'opts' => ['0–0', '2–1', '10–10', 'Undecided'], 'ans' => 'B', 'exp' => 'The final score reported is 2–1.'],
        ];

        $dialogues = $this->celpipFullMockListeningDialogues();
        $order = 1;
        foreach ($stems as $idx => $row) {
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'multiple_choice',
                'question_text' => $row['stem'],
                'passage_text' => 'Listen once, then answer. Use Play to hear the clip again. The script is not shown on screen.',
                'audio_url' => null,
                'audio_script' => trim($dialogues[$idx]),
                'options_json' => [
                    'A' => $row['opts'][0],
                    'B' => $row['opts'][1],
                    'C' => $row['opts'][2],
                    'D' => $row['opts'][3],
                ],
                'correct_answer' => $row['ans'],
                'explanation' => $row['exp'],
                'order' => $order++,
            ]);
        }
    }

    private function ieltsGeneralSections(): void
    {
        $reading = Test::query()->where('title', 'IELTS General Training — Reading (Section practice)')->first();
        if ($reading) {
            Question::query()->where('test_id', $reading->id)->delete();
            $passage = <<<'TXT'
Community composting programs turn food scraps and yard waste into soil amendments instead of sending them to landfill. Volunteers often staff weekend drop-off sites, while municipalities provide bins and education on what belongs in the stream. Contamination—especially plastic bags—remains the biggest operational headache; even small amounts can spoil an entire batch.

Residents report higher satisfaction when they see measurable outcomes: local parks using the compost, school gardens receiving donations, and transparent reporting on diversion tonnage. Scaling programs requires not only trucks and grinders, but also sustained outreach in multiple languages so guidelines are widely understood.
TXT;
            $items = [
                ['q' => 'What is described as the biggest operational headache?', 'opts' => ['Lack of volunteers', 'Contamination such as plastic bags', 'Cold weather', 'Too much compost'], 'ans' => 'B', 'exp' => 'Contamination, especially plastic bags, spoils batches.'],
                ['q' => 'Residents are happier when they see:', 'opts' => ['Only social media posts', 'Measurable outcomes like compost used in parks', 'Higher taxes', 'Fewer parks'], 'ans' => 'B', 'exp' => 'Measurable outcomes increase satisfaction.'],
                ['q' => 'Scaling programs requires:', 'opts' => ['Only trucks', 'Outreach in multiple languages among other resources', 'Banning gardens', 'Removing volunteers'], 'ans' => 'B', 'exp' => 'Sustained multilingual outreach is highlighted.'],
                ['q' => 'Weekend sites are often staffed by:', 'opts' => ['Robots', 'Volunteers', 'Only police', 'Nobody'], 'ans' => 'B', 'exp' => 'Volunteers staff weekend drop-off sites.'],
                ['q' => 'The passage mainly discusses:', 'opts' => ['Ocean fishing', 'Community composting', 'Airport security', 'Bank loans'], 'ans' => 'B', 'exp' => 'Focus is community composting programs.'],
            ];
            $order = 1;
            foreach ($items as $row) {
                Question::query()->create([
                    'test_id' => $reading->id,
                    'type' => 'multiple_choice',
                    'question_text' => $row['q'],
                    'passage_text' => $passage,
                    'options_json' => [
                        'A' => $row['opts'][0],
                        'B' => $row['opts'][1],
                        'C' => $row['opts'][2],
                        'D' => $row['opts'][3],
                    ],
                    'correct_answer' => $row['ans'],
                    'explanation' => $row['exp'],
                    'order' => $order++,
                ]);
            }
        }

        $listening = Test::query()->where('title', 'IELTS General Training — Listening (Section practice)')->first();
        if ($listening) {
            Question::query()->where('test_id', $listening->id)->delete();
            $this->seedListeningMcqBank($listening, $this->listeningStemsSlice(2, 8));
        }

        $writing = Test::query()->where('title', 'IELTS General Training — Writing (Section practice)')->first();
        if ($writing) {
            Question::query()->where('test_id', $writing->id)->delete();
            Question::query()->create([
                'test_id' => $writing->id,
                'type' => 'essay',
                'question_text' => 'Task 1: Write a letter (~150 words) responding to a friend who invited you to a weekend trip but you cannot attend. Explain why and suggest another plan.',
                'passage_text' => null,
                'correct_answer' => 'Rubric: tone, clarity, organization, grammar.',
                'explanation' => 'Practice letter format: greeting, purpose, details, closing.',
                'order' => 1,
            ]);
            Question::query()->create([
                'test_id' => $writing->id,
                'type' => 'essay',
                'question_text' => 'Task 2: Some people prefer living in large cities; others prefer small towns. Discuss both views and give your opinion (~250 words).',
                'passage_text' => null,
                'correct_answer' => 'Rubric: position, balance, cohesion, vocabulary.',
                'explanation' => 'Use clear paragraphs and examples.',
                'order' => 2,
            ]);
        }
    }

    private function celpipGeneralReadingWritingSections(): void
    {
        $reading = Test::query()->where('title', 'CELPIP General — Reading (Section practice)')->first();
        if ($reading) {
            Question::query()->where('test_id', $reading->id)->delete();
            $passage = <<<'TXT'
Employers increasingly use short skills assessments during hiring. These tools can reduce bias by focusing on task performance, but poorly designed tests may disadvantage candidates who are nervous or unfamiliar with the interface. Best practice pairs assessments with human review and accommodations when needed.

Union agreements in some sectors limit how scores can be used, requiring employers to disclose weighting and appeal processes. Candidates benefit from practice items released by providers and from reading instructions carefully before timed sections begin.
TXT;
            $items = [
                ['q' => 'Poorly designed tests may disadvantage:', 'opts' => ['Only executives', 'Candidates who are nervous or unfamiliar with the UI', 'Only interns', 'Nobody'], 'ans' => 'B', 'exp' => 'Nervous or unfamiliar candidates may be disadvantaged.'],
                ['q' => 'Best practice includes:', 'opts' => ['Only automated decisions', 'Assessments paired with human review', 'Removing interviews', 'Random selection'], 'ans' => 'B', 'exp' => 'Human review is part of best practice.'],
                ['q' => 'Union agreements may require:', 'opts' => ['Secret scoring', 'Disclosure of weighting and appeals', 'Banning interviews', 'No accommodations'], 'ans' => 'B', 'exp' => 'Disclosure of weighting and appeals is mentioned.'],
                ['q' => 'Candidates benefit from:', 'opts' => ['Ignoring instructions', 'Practice items and careful reading of instructions', 'Skipping sections', 'Turning off timers'], 'ans' => 'B', 'exp' => 'Practice and careful reading help.'],
            ];
            $order = 1;
            foreach ($items as $row) {
                Question::query()->create([
                    'test_id' => $reading->id,
                    'type' => 'multiple_choice',
                    'question_text' => $row['q'],
                    'passage_text' => $passage,
                    'options_json' => [
                        'A' => $row['opts'][0],
                        'B' => $row['opts'][1],
                        'C' => $row['opts'][2],
                        'D' => $row['opts'][3],
                    ],
                    'correct_answer' => $row['ans'],
                    'explanation' => $row['exp'],
                    'order' => $order++,
                ]);
            }
        }

        $writing = Test::query()->where('title', 'CELPIP General — Writing (Section practice)')->first();
        if ($writing) {
            Question::query()->where('test_id', $writing->id)->delete();
            Question::query()->create([
                'test_id' => $writing->id,
                'type' => 'essay',
                'question_text' => 'Writing Task 1: Write an email (~150–200 words) to a landlord requesting a repair and proposing two times you are available for a maintenance visit.',
                'passage_text' => null,
                'correct_answer' => 'Rubric: tone, completeness, coherence, grammar.',
                'explanation' => 'CELPIP emails should be practical and polite.',
                'order' => 1,
            ]);
            Question::query()->create([
                'test_id' => $writing->id,
                'type' => 'essay',
                'question_text' => 'Writing Task 2: A survey shows many adults skip routine health checkups. Discuss why this happens and what employers or governments could do. (~150–200 words)',
                'passage_text' => null,
                'correct_answer' => 'Rubric: ideas, development, vocabulary, grammar.',
                'explanation' => 'Support points with examples.',
                'order' => 2,
            ]);
        }
    }

    /**
     * @param  array<int, array{stem: string, opts: array{0: string, 1: string, 2: string, 3: string}, ans: string, exp: string, script?: string}>  $rows
     */
    private function seedListeningMcqBank(Test $test, array $rows): void
    {
        $order = 1;
        foreach ($rows as $row) {
            $script = isset($row['script']) && is_string($row['script']) ? trim($row['script']) : '';
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'multiple_choice',
                'question_text' => $row['stem'],
                'passage_text' => 'Listen once, then answer. Use Play to hear the clip again. The script is not shown on screen.',
                'audio_url' => null,
                'audio_script' => $script !== '' ? $script : null,
                'options_json' => [
                    'A' => $row['opts'][0],
                    'B' => $row['opts'][1],
                    'C' => $row['opts'][2],
                    'D' => $row['opts'][3],
                ],
                'correct_answer' => $row['ans'],
                'explanation' => $row['exp'],
                'order' => $order++,
            ]);
        }
    }

    /**
     * @return array<int, array{stem: string, opts: array{0: string, 1: string, 2: string, 3: string}, ans: string, exp: string}>
     */
    private function listeningStemsSlice(int $offset, int $length): array
    {
        $all = $this->allListeningStems();

        return array_slice($all, $offset, $length);
    }

    /**
     * @return array<int, array{stem: string, opts: array{0: string, 1: string, 2: string, 3: string}, ans: string, exp: string}>
     */
    private function allListeningStems(): array
    {
        return array_merge($this->celpipListeningTenScenarios(), $this->listeningStemsPharmacyAndTransit());
    }

    private function seedIeltsFullMockListening(Test $test): void
    {
        $this->seedListeningMcqBank($test, $this->listeningStemsSlice(0, 12));
    }

    private function seedIeltsFullMockWriting(Test $test): void
    {
        Question::query()->create([
            'test_id' => $test->id,
            'type' => 'essay',
            'question_text' => 'Task 1: Write at least 150 words responding to the visual information or letter prompt provided in your official exam booklet (simulation: describe changes in local transport use 2010–2020).',
            'passage_text' => 'The table shows percentages of commuters using car, bus, or bicycle in one city.',
            'correct_answer' => 'Rubric: overview, key features, accuracy, cohesion.',
            'explanation' => 'Keep timing: ~20 minutes for Task 1 in IELTS.',
            'order' => 1,
        ]);
        Question::query()->create([
            'test_id' => $test->id,
            'type' => 'essay',
            'question_text' => 'Task 2: Write at least 250 words. Some argue governments should fund space exploration; others say money should solve problems on Earth first. Discuss both views and give your opinion.',
            'passage_text' => null,
            'correct_answer' => 'Rubric: position, development, cohesion, vocabulary.',
            'explanation' => 'Aim for clear paragraphs and concrete examples.',
            'order' => 2,
        ]);
    }

    private function seedCelpipFullMockReading(Test $test): void
    {
        $passage = <<<'TXT'
Municipal cycling networks aim to separate riders from fast traffic using protected lanes and signal phases designed for bikes. Evaluations from several Canadian cities show injury risk drops where protection is continuous rather than intermittent. However, winter maintenance costs can be high, and some merchants worry about parking loss during pilot projects.

Public consultations that combine maps, ridership data, and trade-off scenarios tend to produce plans that survive political cycles. Quick paint-only lanes without enforcement often see declining compliance over time.
TXT;
        $items = [
            ['q' => 'Injury risk drops most when protection is:', 'opts' => ['Intermittent', 'Continuous', 'Decorative', 'Unmarked'], 'ans' => 'B', 'exp' => 'Continuous protection is associated with lower injury risk.'],
            ['q' => 'Merchants may worry about:', 'opts' => ['More snow', 'Parking loss during pilots', 'Fewer customers forever', 'Free transit'], 'ans' => 'B', 'exp' => 'Parking loss during pilot projects is mentioned.'],
            ['q' => 'Plans survive political cycles when consultations:', 'opts' => ['Hide data', 'Combine maps, data, and trade-off scenarios', 'Avoid the public', 'Only use surveys'], 'ans' => 'B', 'exp' => 'Combined materials improve buy-in.'],
            ['q' => 'Paint-only lanes without enforcement may see:', 'opts' => ['Automatic compliance', 'Declining compliance over time', 'More snowplows', 'Higher speed limits'], 'ans' => 'B', 'exp' => 'Compliance can decline without enforcement.'],
        ];
        $order = 1;
        foreach ($items as $row) {
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'multiple_choice',
                'question_text' => $row['q'],
                'passage_text' => $passage,
                'options_json' => [
                    'A' => $row['opts'][0],
                    'B' => $row['opts'][1],
                    'C' => $row['opts'][2],
                    'D' => $row['opts'][3],
                ],
                'correct_answer' => $row['ans'],
                'explanation' => $row['exp'],
                'order' => $order++,
            ]);
        }
    }

    private function seedCelpipFullMockWriting(Test $test): void
    {
        Question::query()->create([
            'test_id' => $test->id,
            'type' => 'essay',
            'question_text' => 'Write an email to a municipal office requesting a noise investigation and proposing two reasonable times you are available for a callback.',
            'passage_text' => null,
            'correct_answer' => 'Rubric: clarity, tone, completeness, grammar.',
            'explanation' => 'Include purpose, details, and polite closing.',
            'order' => 1,
        ]);
        Question::query()->create([
            'test_id' => $test->id,
            'type' => 'essay',
            'question_text' => 'A survey shows many workers feel unprepared for workplace technology changes. Discuss causes and what employers can do to support training.',
            'passage_text' => null,
            'correct_answer' => 'Rubric: ideas, examples, organization, vocabulary.',
            'explanation' => 'Develop both parts of the prompt.',
            'order' => 2,
        ]);
    }

    private function quickPracticeQuestions(): void
    {
        $tests = Test::query()
            ->where('practice_mode', 'quick')
            ->whereHas('exam', fn ($q) => $q->whereIn('code', ['ielts_general', 'celpip_general']))
            ->get();
        foreach ($tests as $test) {
            Question::query()->where('test_id', $test->id)->delete();
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'true_false',
                'question_text' => 'Quick check: In academic writing, a clear thesis statement helps the reader follow your argument.',
                'passage_text' => null,
                'options_json' => null,
                'correct_answer' => 'true',
                'explanation' => 'A thesis maps the essay direction for the reader.',
                'order' => 1,
            ]);
            Question::query()->create([
                'test_id' => $test->id,
                'type' => 'fill_blank',
                'question_text' => 'Complete: Active listening involves ______ feedback to confirm understanding.',
                'passage_text' => null,
                'correct_answer' => 'verbal',
                'explanation' => 'Paraphrasing or brief verbal confirmation is common.',
                'order' => 2,
            ]);
        }
    }
}
