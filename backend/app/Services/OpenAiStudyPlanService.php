<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class OpenAiStudyPlanService
{
    public const SUMMARY_START = '<<<BR_PLAN_SUMMARY>>>';

    public const SUMMARY_END = '<<<END_BR_PLAN_SUMMARY>>>';

    /**
     * @param  list<string>  $weakAreas
     * @return array{summary: string, plan_text: string}
     */
    public function generatePlanText(
        string $examTypeLabel,
        int $calendarDaysUntilExam,
        int $studySessionCount,
        string $scheduleSummary,
        string $studyTimeLabel,
        ?string $currentLevel,
        array $weakAreas,
        string $planPacing,
        ?int $userId = null,
    ): array {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $model = (string) config('openai.model', 'gpt-4o-mini');
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('openai.study_plan_timeout', 120);
        $maxTokens = min(16384, (int) config('openai.study_plan_max_completion_tokens', 8192));

        $weak = $weakAreas === [] ? 'None specified (balance all skills evenly)' : implode(', ', $weakAreas);
        $level = $currentLevel !== null && $currentLevel !== '' ? $currentLevel : 'Not sure / not specified';

        $system = <<<'SYS'
You are an expert IELTS and CELPIP exam tutor. Create a structured daily study plan.
Use plain text only (no markdown headings with #). Keep a friendly, encouraging tone.
SYS;

        $user = <<<USR
Create a personalized exam preparation plan.

User Details:
Exam Type: {$examTypeLabel}
Calendar days until the exam: {$calendarDaysUntilExam}
Study sessions to schedule: {$studySessionCount} (Day 1 = first study session; Day {$studySessionCount} = last session before the exam)
Schedule: {$scheduleSummary}
Study Time Per Day: {$studyTimeLabel}
Current Level: {$level}
Weak Areas: {$weak}

Plan pacing label (use this tone and density): {$planPacing}

Before the session-by-session plan, write a short **plan summary** for the learner: 2 tight paragraphs (no bullet lists) that explain the overall approach, how skills rotate, and what success looks like by exam day. Keep it encouraging and concrete.

Wrap that summary **exactly** between these two marker lines (each on its own line, markers spelled exactly):

<<<BR_PLAN_SUMMARY>>>
(your summary paragraphs here)
<<<END_BR_PLAN_SUMMARY>>>

After the closing marker, leave a blank line, then start the session plan.

Requirements:
- Create exactly {$studySessionCount} study-session blocks labeled Day 1 through Day {$studySessionCount} (inclusive). Each block is one study session on the user's rhythm (not necessarily every calendar day).
- Include speaking, writing, reading, and listening across the schedule.
- Focus somewhat more on weak areas without neglecting other skills.
- Keep tasks realistic for the stated study time per session.
- Add one short tip per session after the tasks (prefix the line with "Tip: ").
- Limit tasks to 2–3 bullet lines per session (use lines starting with "* ").
- Make it easy to scan.

Format (repeat for every session):

Day 1:

* Task
* Task
Tip: ...

Day 2:
...

After the last session, add a final section exactly titled:

Final Section:

* Last 3 study sessions strategy (as bullet lines starting with "* ")
* Exam day tips (as bullet lines starting with "* ")
USR;

        $requestPayload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ],
            'max_completion_tokens' => $maxTokens,
        ];

        $startedAt = microtime(true);
        $httpResponse = null;
        $caught = null;

        try {
            $httpResponse = Http::withToken($key)
                ->timeout($timeout)
                ->acceptJson()
                ->post($url, $requestPayload);

            if (! $httpResponse->successful()) {
                Log::warning('OpenAI study plan HTTP error', [
                    'status' => $httpResponse->status(),
                    'body' => $httpResponse->body(),
                ]);
                throw new InvalidArgumentException('OpenAI API error: HTTP '.$httpResponse->status());
            }

            $content = data_get($httpResponse->json(), 'choices.0.message.content');
            if (! is_string($content) || trim($content) === '') {
                throw new InvalidArgumentException('OpenAI returned an empty study plan.');
            }

            return self::splitPlanOutput(trim($content));
        } catch (\Throwable $e) {
            $caught = $e;
            throw $e;
        } finally {
            app(OpenAiActivityLogger::class)->recordChatCompletion(
                'study_plan',
                $userId,
                'cal:'.$calendarDaysUntilExam.',sess:'.$studySessionCount,
                $url,
                $requestPayload,
                $httpResponse,
                (microtime(true) - $startedAt) * 1000,
                $caught,
            );
        }
    }

    /**
     * @return array{summary: string, plan_text: string}
     */
    public static function splitPlanOutput(string $raw): array
    {
        $start = self::SUMMARY_START;
        $end = self::SUMMARY_END;
        $p0 = strpos($raw, $start);
        if ($p0 === false) {
            return ['summary' => '', 'plan_text' => $raw];
        }
        $p1 = $p0 + strlen($start);
        $p2 = strpos($raw, $end, $p1);
        if ($p2 === false) {
            return ['summary' => '', 'plan_text' => $raw];
        }
        $summary = trim(substr($raw, $p1, $p2 - $p1));
        $body = trim(substr($raw, $p2 + strlen($end)));
        $body = preg_replace('/^\s+/s', '', $body) ?? '';
        if ($body === '') {
            return ['summary' => '', 'plan_text' => $raw];
        }

        return ['summary' => $summary, 'plan_text' => $body];
    }

    public static function planPacingLabel(int $daysRemaining): string
    {
        if ($daysRemaining <= 3) {
            return 'Emergency plan — prioritize highest-impact drills, short focused blocks, and confidence.';
        }
        if ($daysRemaining <= 7) {
            return 'Intensive plan — tight rotations across all skills with extra time on weak areas.';
        }
        if ($daysRemaining >= 30) {
            return 'Balanced plan — steady skill-building, spaced repetition, and full mock practice toward the end.';
        }

        return 'Steady plan — mix skill blocks, weekly review, and progressive difficulty.';
    }

    public static function planPacingKey(int $daysRemaining): string
    {
        if ($daysRemaining <= 3) {
            return 'emergency';
        }
        if ($daysRemaining <= 7) {
            return 'intensive';
        }
        if ($daysRemaining >= 30) {
            return 'balanced';
        }

        return 'steady';
    }
}
