<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SiteTrafficTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_record_a_visit(): void
    {
        $visitorId = (string) Str::uuid();

        $response = $this->postJson('/api/site-traffic/visit', [
            'visitor_id' => $visitorId,
            'path' => '/forum',
        ]);

        $response->assertNoContent();
        $this->assertDatabaseHas('site_visits', [
            'visitor_id' => $visitorId,
            'path' => '/forum',
            'user_id' => null,
        ]);
    }

    public function test_authenticated_request_attaches_user_id(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $visitorId = (string) Str::uuid();

        $response = $this->postJson('/api/site-traffic/visit', [
            'visitor_id' => $visitorId,
            'path' => '/dashboard',
        ]);

        $response->assertNoContent();
        $this->assertDatabaseHas('site_visits', [
            'visitor_id' => $visitorId,
            'path' => '/dashboard',
            'user_id' => $user->id,
        ]);
    }

    public function test_invalid_visitor_id_is_rejected(): void
    {
        $response = $this->postJson('/api/site-traffic/visit', [
            'visitor_id' => 'not-a-uuid',
            'path' => '/',
        ]);

        $response->assertUnprocessable();
    }

    public function test_visit_can_store_referrer(): void
    {
        $visitorId = (string) Str::uuid();
        $referrer = 'https://www.google.com/search?q=ielts';

        $response = $this->postJson('/api/site-traffic/visit', [
            'visitor_id' => $visitorId,
            'path' => '/',
            'referrer' => $referrer,
        ]);

        $response->assertNoContent();
        $this->assertDatabaseHas('site_visits', [
            'visitor_id' => $visitorId,
            'path' => '/',
            'referrer' => $referrer,
        ]);
    }
}
