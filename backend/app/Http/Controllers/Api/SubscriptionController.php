<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

class SubscriptionController extends Controller
{
    /**
     * Simulated one-time checkout: adds 12 months of Pro access (no payment gateway).
     * Most learners use the app until test day; extend with another one-time purchase if needed.
     * Extends from current expiry when already active, otherwise from now.
     */
    public function simulateCheckout()
    {
        $user = auth()->user();
        $periodMonths = 12;

        $base = $user->subscription_expires_at && $user->subscription_expires_at->isFuture()
            ? $user->subscription_expires_at
            : now();

        $user->subscription_expires_at = $base->copy()->addMonths($periodMonths);
        $user->save();

        return response()->json([
            'message' => 'Pro access activated (simulated one-time payment — no charge).',
            'user' => $user->fresh()->toApiArray(),
        ]);
    }
}
