<?php

namespace App\Support;

final class InterviewPracticePrompts
{
    /**
     * @return array<string, string>
     */
    public static function typeGuidance(): array
    {
        return [
            'general_job' => 'General job interview: introductions, work experience, strengths and weaknesses, situational/behavioural questions.',
            'customer_service' => 'Customer service / call center: angry customers, tone, de-escalation, call handling scenarios, problem solving.',
            'software_developer' => 'Software developer: past projects, technical concepts explained clearly, debugging mindset, teamwork and code review habits.',
            'fresh_graduate' => 'Fresh graduate: education, motivation, career goals, strengths, hypotheticals where they lack experience.',
            'sales' => 'Sales: persuasion, objection handling, resilience after rejection, discovery questions, short role-play pitches.',
            'manager_supervisor' => 'Manager / supervisor: leadership style, conflict resolution, delegation, prioritisation, decision making.',
            'nurse_healthcare' => 'Nurse / healthcare: patient care priorities, stress, ethics, safety, brief clinical judgement scenarios (no real medical advice).',
            'ielts_speaking' => 'IELTS Speaking style: Part 1 warm personal questions, Part 2 long turn with cue-style prompt, Part 3 abstract discussion — keep turns short like a real test.',
            'celpip_speaking' => 'CELPIP Speaking style: giving advice, expressing opinions, describing a situation, explaining a choice — practical everyday workplace/social contexts.',
            'custom_role' => 'Interview tailored to the specific job role the candidate entered; stay realistic for that role.',
        ];
    }

    public static function typeLabel(string $key): string
    {
        $labels = [
            'general_job' => 'General Job Interview',
            'customer_service' => 'Customer Service / Call Center',
            'software_developer' => 'Software Developer Interview',
            'fresh_graduate' => 'Fresh Graduate Interview',
            'sales' => 'Sales Interview',
            'manager_supervisor' => 'Manager / Supervisor Interview',
            'nurse_healthcare' => 'Nurse / Healthcare Interview',
            'ielts_speaking' => 'IELTS Speaking Interview',
            'celpip_speaking' => 'CELPIP Speaking Interview',
            'custom_role' => 'Custom Job Role',
        ];

        return $labels[$key] ?? $key;
    }

    public static function difficultyTone(string $difficulty): string
    {
        return match ($difficulty) {
            'easy' => 'Easy: simple questions, brief follow-ups, warm and encouraging interviewer.',
            'hard' => 'Hard: demanding questions, deeper follow-ups, formal and strict interviewer tone.',
            default => 'Normal: balanced depth, natural follow-ups, professional but fair.',
        };
    }

    /** Canned interviewer line when the session hits the clock (no LLM call). */
    public static function closingMessageTimeLimit(): string
    {
        return "That's all the time we have for this practice session. Thank you for your answers — we'll wrap up the mock interview here. Best of luck with your preparation.";
    }

    /** Canned interviewer line when the session ends from extended silence. */
    public static function closingMessageSilence(): string
    {
        return "I'll wrap up here since we haven't continued. Thank you for practising today — this mock interview is concluded. All the best going forward.";
    }

    /** Fallback when the model still ends with a question after the final candidate answer. */
    public static function closingMessageTurnLimitFallback(): string
    {
        return "We've reached the last answer for this practice session, so I'll stop here. Thank you for your time today — this mock interview is now concluded. Best of luck with your preparation.";
    }
}
