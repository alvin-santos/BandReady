<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class OpenAiStudyPlanService
{
    /**
     * @param  list<string>  $weakAreas
     */
    public function generatePlanText(
        string $examTypeLabel,
        int $daysRemaining,
        string $studyTimeLabel,
        ?string $currentLevel,
        array $weakAreas,
        string $planPacing,
        ?int $userId = null,
    ): string {
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
Days Remaining: {$daysRemaining}
Study Time Per Day: {$studyTimeLabel}
Current Level: {$level}
Weak Areas: {$weak}

Plan pacing label (use this tone and density): {$planPacing}

Requirements:
- Create a day-by-day plan for each day from Day 1 through Day {$daysRemaining} (inclusive).
- Include speaking, writing, reading, and listening across the schedule.
- Focus somewhat more on weak areas without neglecting other skills.
- Keep tasks realistic for the stated daily study time.
- Add one short tip per day after the tasks (prefix the line with "Tip: ").
- Limit tasks to 2–3 bullet lines per day (use lines starting with "* ").
- Make it easy to scan.

Format (repeat for every day):

Day 1:

* Task
* Task
Tip: ...

Day 2:
...

After the last day, add a final section exactly titled:

Final Section:

* Last 3 days strategy (as bullet lines starting with "* ")
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

            return trim($content);
        } catch (\Throwable $e) {
            $caught = $e;
            throw $e;
        } finally {
            app(OpenAiActivityLogger::class)->recordChatCompletion(
                'study_plan',
                $userId,
                'days:'.$daysRemaining,
                $url,
                $requestPayload,
                $httpResponse,
                (microtime(true) - $startedAt) * 1000,
                $caught,
            );
        }
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
