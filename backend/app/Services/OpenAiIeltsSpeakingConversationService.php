<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

/**
 * Generates IELTS Speaking examiner turns (Parts 1–3) for practice — not an official test.
 */
class OpenAiIeltsSpeakingConversationService
{
    private const SYSTEM = <<<'SYS'
You are a certified IELTS Speaking examiner in a practice app. Conduct a realistic **three-part** interview in English.

**Your role:** Speak only as the examiner. Output **one JSON object** per response (no markdown). Never simulate the candidate.

**Structure:**
- **Part 1** (≈4–5 examiner turns after greeting): introduction, full name, work/study, then 2–3 short questions on familiar topics (hobbies, home, daily life). Keep each `examiner_message` to 1–3 short sentences unless you are giving Part 2 instructions.
- **Part 2:** Give clear instructions + a **cue card** with bullet points (what to describe, what to say, explain…). Set `awaiting` to `silent_prep` and `prep_seconds` to 60. The app will send the candidate message `[PREPARATION_TIME_COMPLETE]` when prep ends — then reply with a brief cue to begin speaking (one sentence) and set `awaiting` to `candidate_long`.
- **Part 2 long turn:** After the candidate’s long response, thank them briefly and move to **Part 3** (2–4 more abstract/discussion questions linked to the Part 2 topic). Use `awaiting` `candidate_short` for each.
- **End:** When Part 3 is enough for practice (at least 2 discussion questions answered by the candidate), a short closing, set `interview_complete` true and `awaiting` to `none`.

**JSON shape (exact keys):**
- `examiner_message` (string): what you say aloud now (natural examiner English).
- `part` (integer): 1, 2, or 3.
- `awaiting` (string): one of `candidate_short` | `silent_prep` | `candidate_long` | `none`.
- `interview_complete` (boolean).
- `prep_seconds` (integer or null): use 60 when `awaiting` is `silent_prep`, else null.

**Tone:** Neutral, professional, warm. British or international neutral English is fine. Do not ask for personal data beyond normal IELTS (name, where from, work/study).

**examiner_message (text-to-speech):** Learners hear your lines via browser TTS. **Never** use a slash in greetings (do **not** write "Good morning/afternoon"—the device may say "slash"). Use **either** "Good morning" **or** "Good afternoon", or start with "Hello". **Never** write "My name is the examiner" (unnatural and TTS may drop words)—say **"I am your examiner"**, **"I'll be your examiner today"**, or **"I'm conducting this practice interview"** instead.

**If the candidate’s message is `[PREPARATION_TIME_COMPLETE]`:** You are continuing after the Part 2 note-taking minute — invite them to speak for up to two minutes on the cue card (one short sentence is enough).

**If the candidate’s message is empty and there is no prior conversation:** Start Part 1 with greeting + ask for full name.
SYS;

    /**
     * @param  list<array{role: string, text: string}>  $exchanges  role: examiner|candidate
     * @return array{
     *   examiner_message: string,
     *   part: int,
     *   awaiting: string,
     *   interview_complete: bool,
     *   prep_seconds: int|null
     * }
     */
    public function nextTurn(array $exchanges, ?string $latestCandidateText, ?int $userId, string $contextRef): array
    {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $model = (string) config('openai.ielts_speaking_conversation_model', config('openai.speaking_model', config('openai.model')));
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('openai.ielts_speaking_conversation_timeout', 90);
        $maxTokens = min(2048, (int) config('openai.max_completion_tokens', 4096));

        $historyText = $this->formatExchangesForPrompt($exchanges);
        $latest = trim((string) ($latestCandidateText ?? ''));

        $user = "Conversation so far (each line prefixed E: examiner, C: candidate):\n".$historyText."\n\n";
        if ($latest === '') {
            $user .= "There is no candidate message yet — this is the **start** of the interview. Output JSON for your opening as examiner.";
        } else {
            $user .= "The candidate just said (transcript from speech recognition — may contain errors):\n".$latest."\n\nOutput JSON for your **next** examiner turn only.";
        }

        $requestPayload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => self::SYSTEM],
                ['role' => 'user', 'content' => $user],
            ],
            'response_format' => ['type' => 'json_object'],
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
                Log::warning('IELTS speaking AI HTTP error', [
                    'status' => $httpResponse->status(),
                    'body' => $httpResponse->body(),
                ]);
                throw new InvalidArgumentException('OpenAI API error: HTTP '.$httpResponse->status());
            }

            $content = data_get($httpResponse->json(), 'choices.0.message.content');
            if (! is_string($content) || $content === '') {
                throw new InvalidArgumentException('OpenAI returned an empty response.');
            }

            $decoded = json_decode($content, true);
            if (! is_array($decoded)) {
                throw new InvalidArgumentException('OpenAI returned invalid JSON.');
            }

            return $this->normalizeResponse($decoded);
        } catch (\Throwable $e) {
            $caught = $e;
            throw $e;
        } finally {
            app(OpenAiActivityLogger::class)->recordChatCompletion(
                'ielts_speaking_ai',
                $userId,
                $contextRef,
                $url,
                $requestPayload,
                $httpResponse,
                (microtime(true) - $startedAt) * 1000,
                $caught,
            );
        }
    }

    /**
     * @param  list<array{role: string, text: string}>  $exchanges
     */
    private function formatExchangesForPrompt(array $exchanges): string
    {
        $lines = [];
        $max = 40;
        $slice = count($exchanges) > $max ? array_slice($exchanges, -$max) : $exchanges;
        foreach ($slice as $ex) {
            $role = ($ex['role'] ?? '') === 'candidate' ? 'C' : 'E';
            $t = trim((string) ($ex['text'] ?? ''));
            if ($t === '') {
                continue;
            }
            $lines[] = $role.': '.$t;
        }

        return $lines === [] ? '(none)' : implode("\n", $lines);
    }

    /**
     * @param  array<string, mixed>  $decoded
     * @return array{
     *   examiner_message: string,
     *   part: int,
     *   awaiting: string,
     *   interview_complete: bool,
     *   prep_seconds: int|null
     * }
     */
    private function normalizeResponse(array $decoded): array
    {
        $msg = $this->sanitizeExaminerMessageForSpeech(trim((string) ($decoded['examiner_message'] ?? '')));
        if ($msg === '') {
            $msg = 'Could you repeat that, please?';
        }
        $part = (int) ($decoded['part'] ?? 1);
        if ($part < 1) {
            $part = 1;
        }
        if ($part > 3) {
            $part = 3;
        }
        $awaiting = (string) ($decoded['awaiting'] ?? 'candidate_short');
        $allowed = ['candidate_short', 'silent_prep', 'candidate_long', 'none'];
        if (! in_array($awaiting, $allowed, true)) {
            $awaiting = 'candidate_short';
        }
        $complete = (bool) ($decoded['interview_complete'] ?? false);
        $prep = $decoded['prep_seconds'] ?? null;
        $prep = is_numeric($prep) ? max(0, min(120, (int) $prep)) : null;
        if ($awaiting !== 'silent_prep') {
            $prep = null;
        } elseif ($prep === null) {
            $prep = 60;
        }

        return [
            'examiner_message' => $msg,
            'part' => $part,
            'awaiting' => $awaiting,
            'interview_complete' => $complete,
            'prep_seconds' => $prep,
        ];
    }

    /**
     * Fixes common LLM phrasing that browser TTS reads badly (slashes, "My name is the examiner").
     */
    private function sanitizeExaminerMessageForSpeech(string $msg): string
    {
        if ($msg === '') {
            return $msg;
        }

        $s = preg_replace('/\bgood\s+morning\s*\/\s*afternoon\b/iu', 'Good morning', $msg) ?? $msg;
        $s = preg_replace('/\bgood\s+afternoon\s*\/\s*morning\b/iu', 'Good afternoon', $s) ?? $s;

        $s = preg_replace('/\bmy\s+name\s+is\s*,?\s*the\s+examiner\b\.?/iu', 'I am your examiner for this practice test', $s) ?? $s;
        $s = preg_replace('/\bmy\s+name\s+is\s+examiner\b\.?/iu', 'I am your examiner for this practice test', $s) ?? $s;

        return trim($s);
    }
}
