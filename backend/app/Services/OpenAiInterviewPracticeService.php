<?php

namespace App\Services;

use App\Models\InterviewPracticeSession;
use App\Support\InterviewPracticePrompts;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class OpenAiInterviewPracticeService
{
    /** @return array{message: string} */
    public function opening(InterviewPracticeSession $session): array
    {
        return $this->complete($session, [], true);
    }

    /**
     * @param  list<\App\Models\InterviewPracticeMessage>  $priorMessages
     * @return array{message: string}
     */
    public function afterCandidate(
        InterviewPracticeSession $session,
        array $priorMessages,
        string $candidateText,
    ): array {
        return $this->complete($session, $priorMessages, false, $candidateText);
    }

    /**
     * @param  list<\App\Models\InterviewPracticeMessage>  $priorMessages
     * @return array{message: string}
     */
    private function complete(
        InterviewPracticeSession $session,
        array $priorMessages,
        bool $isOpening,
        ?string $candidateText = null,
    ): array {
        $key = config('openai.api_key');
        if (! is_string($key) || $key === '') {
            throw new InvalidArgumentException('OPENAI_API_KEY is not set in your environment.');
        }

        $model = (string) config('openai.speaking_model', config('openai.model'));
        $url = config('openai.base_url').'/chat/completions';
        $timeout = (int) config('interview_practice.openai_timeout', 75);
        $maxTokens = min(700, (int) config('openai.max_completion_tokens', 4096));

        $typeKey = (string) $session->interview_type;
        $guidance = InterviewPracticePrompts::typeGuidance()[$typeKey]
            ?? InterviewPracticePrompts::typeGuidance()['general_job'];
        $typeLabel = InterviewPracticePrompts::typeLabel($typeKey);
        $difficulty = InterviewPracticePrompts::difficultyTone((string) $session->difficulty);
        $roleLine = $typeKey === 'custom_role' && trim((string) $session->custom_role) !== ''
            ? 'Target job role: '.trim((string) $session->custom_role).'.'
            : '';

        // user_turns is already incremented for the candidate reply we are answering — remaining answers they may still send.
        $turnsLeftForCandidate = max(0, (int) $session->max_turns - (int) $session->user_turns);
        if ($turnsLeftForCandidate === 0) {
            $wrapHint = 'The candidate has **no** answers left in this session. **End the interview now**: thank them briefly, react in one short phrase to their last reply if natural, and wish them well. **Do not ask any question** — they cannot send another answer.';
        } elseif ($turnsLeftForCandidate === 1) {
            $wrapHint = 'Ask **exactly one** clear final question — it is the **only** question they can still answer in this session. After their answer the session will end; do not imply further rounds.';
        } else {
            $wrapHint = 'Ask exactly ONE clear question (or one tightly related compound question). No bullet lists.';
        }

        $system = <<<SYS
You are **Bandie**, BandReady's AI voice interview coach. In this mode you are strictly the **human interviewer** (not a tutor explaining the app).

Interview format label: {$typeLabel}.
{$roleLine}
Focus: {$guidance}
Difficulty: {$difficulty}

Rules:
- Stay in interviewer role; professional English.
- {$wrapHint}
- Keep your spoken reply concise (roughly under 120 words) so it can be read aloud.
- Listen to the candidate's last answer and respond naturally; do not repeat the same question wording as earlier turns.
- Do not invent company names as fact; keep scenarios generic unless the candidate supplied details.
- Output **only** a JSON object: {"message":"..."}  with a single key "message" — your full next utterance.

Opening turn (no candidate text yet): begin with **one short professional line** that sets expectations for this practice (for example that you will ask typical interview-style questions), then ask the **first** interview question. **Do not** open with "Hi Bandie", "Hi, I'm Bandie", "Hey Bandie", or similar name-based greetings — stay in plain interviewer voice.
SYS;

        $lines = [];
        foreach ($priorMessages as $m) {
            $tag = $m->role === 'ai' ? 'Interviewer' : 'Candidate';
            $lines[] = $tag.': '.$m->body;
        }
        $history = implode("\n", $lines);

        if ($isOpening) {
            $user = "Conversation so far:\n(none — start the interview.)";
        } else {
            $user = "Conversation so far:\n".$history."\n\nCandidate just said (speech transcript, may contain errors):\n".trim((string) $candidateText);
        }

        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ],
            'response_format' => ['type' => 'json_object'],
            'max_completion_tokens' => $maxTokens,
        ];

        $response = Http::withToken($key)
            ->timeout($timeout)
            ->acceptJson()
            ->post($url, $payload);

        if (! $response->successful()) {
            Log::warning('OpenAI interview practice HTTP error', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new InvalidArgumentException('Interview AI request failed.');
        }

        $content = data_get($response->json(), 'choices.0.message.content');
        if (! is_string($content) || trim($content) === '') {
            throw new InvalidArgumentException('Interview AI returned empty content.');
        }

        $decoded = json_decode($content, true);
        $message = is_array($decoded) ? trim((string) ($decoded['message'] ?? '')) : '';
        if ($message === '') {
            throw new InvalidArgumentException('Interview AI returned invalid JSON.');
        }

        $cap = (int) config('interview_practice.max_message_chars', 6000);
        if (mb_strlen($message) > $cap) {
            $message = mb_substr($message, 0, $cap);
        }

        return ['message' => $message];
    }
}
