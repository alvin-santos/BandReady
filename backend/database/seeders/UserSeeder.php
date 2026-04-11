<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Demo accounts for local/staging (password: "password" for all).
     */
    public function run(): void
    {
        $users = [
            [
                'email' => 'admin@bandready.test',
                'name' => 'Administrator',
                'password' => 'password',
                'role' => 'admin',
                'email_verified_at' => now(),
                'subscription_expires_at' => null,
            ],
            [
                'email' => 'student@bandready.test',
                'name' => 'Demo Student',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => now(),
                'subscription_expires_at' => null,
            ],
            [
                'email' => 'subscriber@bandready.test',
                'name' => 'Demo Subscriber',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => now(),
                'subscription_expires_at' => now()->addYear(),
            ],
            [
                'email' => 'coach@bandready.test',
                'name' => 'IELTS Coach',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => now(),
                'subscription_expires_at' => now()->addMonths(6),
            ],
            [
                'email' => 'learner@bandready.test',
                'name' => 'Active Learner',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => now(),
                'subscription_expires_at' => null,
            ],
            [
                'email' => 'pro@bandready.test',
                'name' => 'Pro Member',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => now(),
                'subscription_expires_at' => now()->addYear(),
            ],
            [
                'email' => 'celpip@bandready.test',
                'name' => 'CELPIP Prep',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => now(),
                'subscription_expires_at' => now()->addMonth(),
            ],
            [
                'email' => 'newuser@bandready.test',
                'name' => 'Unverified Signup',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => null,
                'subscription_expires_at' => null,
            ],
            [
                'email' => 'expired@bandready.test',
                'name' => 'Lapsed Subscription',
                'password' => 'password',
                'role' => 'user',
                'email_verified_at' => now(),
                'subscription_expires_at' => now()->subMonth(),
            ],
        ];

        foreach ($users as $row) {
            User::query()->updateOrCreate(
                ['email' => $row['email']],
                [
                    'name' => $row['name'],
                    'password' => $row['password'],
                    'role' => $row['role'],
                    'email_verified_at' => $row['email_verified_at'] ?? null,
                    'subscription_expires_at' => $row['subscription_expires_at'] ?? null,
                ]
            );
        }
    }
}
