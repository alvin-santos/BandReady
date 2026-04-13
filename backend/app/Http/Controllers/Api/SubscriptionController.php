<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ProSubscriptionService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    /**
     * Public subscription UI options (Stripe vs simulate).
     */
    public function offer(ProSubscriptionService $service)
    {
        $stripeOk = $service->stripeConfigured();
        $price = $stripeOk ? $service->priceSummary() : ['amount' => null, 'currency' => null, 'formatted' => null];

        return response()->json([
            'stripe_checkout_enabled' => $stripeOk,
            'simulate_enabled' => (bool) config('subscription.simulate_enabled', false),
            'price' => $price,
        ]);
    }

    /**
     * Start Stripe Checkout for a one-time Pro purchase.
     *
     * @return array{url: string}
     */
    public function createCheckoutSession(ProSubscriptionService $service)
    {
        $user = auth()->user();

        return response()->json($service->createCheckoutSession($user));
    }

    /**
     * After redirect from Stripe, confirm session and grant Pro if not already fulfilled (webhook may have run first).
     */
    public function verifyCheckoutSession(Request $request, ProSubscriptionService $service)
    {
        $validated = $request->validate([
            'session_id' => ['required', 'string', 'max:255'],
        ]);

        $user = auth()->user();
        $result = $service->verifyAndFulfillSession($user, $validated['session_id']);

        return response()->json([
            'extended' => $result['extended'],
            'payment_status' => $result['payment_status'],
            'user' => $user->fresh()->toApiArray(),
        ]);
    }

    /**
     * Simulated one-time checkout: adds Pro months (no payment gateway).
     * Guarded by SUBSCRIPTION_SIMULATE_ENABLED — disable in production when using Stripe only.
     */
    public function simulateCheckout()
    {
        if (! config('subscription.simulate_enabled', false)) {
            abort(403, 'Simulated checkout is disabled.');
        }

        $user = auth()->user();
        $service = app(ProSubscriptionService::class);
        $service->extendProMonths($user);

        return response()->json([
            'message' => 'Pro access activated (simulated one-time payment — no charge).',
            'user' => $user->fresh()->toApiArray(),
        ]);
    }
}
