<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InterviewPracticeTest extends TestCase
{
    use RefreshDatabase;

    public function test_status_requires_verified_user(): void
    {
        $user = User::factory()->create(['email_verified_at' => null]);
        Sanctum::actingAs($user);

        $this->getJson('/api/interview-practice/status')->assertStatus(403);
    }

    public function test_status_returns_limits_for_verified_user(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        Sanctum::actingAs($user);

        $this->getJson('/api/interview-practice/status')
            ->assertOk()
            ->assertJsonPath('can_start', true)
            ->assertJsonStructure(['limits', 'sessions_today', 'sessions_remaining_today', 'is_subscribed']);
    }

    public function test_start_persists_session_and_ai_message_with_fake_openai(): void
    {
        config(['openai.api_key' => 'sk-test']);

        Http::fake([
            '*/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode(['message' => 'Hello, I am Bandie. Tell me about yourself.']),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $user = User::factory()->create(['email_verified_at' => now()]);
        Sanctum::actingAs($user);

        $res = $this->postJson('/api/interview-practice/start', [
            'interview_type' => 'general_job',
            'difficulty' => 'normal',
        ]);

        $res->assertOk()
            ->assertJsonPath('session.interview_type', 'general_job')
            ->assertJsonPath('session.is_active', true);

        $sid = $res->json('session.id');
        $this->assertDatabaseHas('interview_practice_sessions', [
            'id' => $sid,
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('interview_practice_messages', [
            'interview_practice_session_id' => $sid,
            'role' => 'ai',
        ]);
    }

    public function test_start_quick_duration_preset_caps_session_fields(): void
    {
        config(['openai.api_key' => 'sk-test']);

        Http::fake([
            '*/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode(['message' => 'Quick hello.']),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $user = User::factory()->create(['email_verified_at' => now()]);
        Sanctum::actingAs($user);

        $res = $this->postJson('/api/interview-practice/start', [
            'interview_type' => 'general_job',
            'difficulty' => 'normal',
            'duration_preset' => 'quick',
        ]);

        $res->assertOk()
            ->assertJsonPath('session.max_duration_seconds', 180)
            ->assertJsonPath('session.max_turns', 3);
    }
}
