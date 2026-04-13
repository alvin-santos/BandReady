<?php

namespace App\Services;

use App\Models\ProCheckoutFulfillment;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Stripe\Checkout\Session;
use Stripe\Price;
use Stripe\Stripe;

class ProSubscriptionService
{
    public function stripeConfigured(): bool
    {
        $secret = config('subscription.stripe_secret');
        $priceId = config('subscription.price_id');

        return is_string($secret) && $secret !== ''
            && is_string($priceId) && $priceId !== '';
    }

    public function setStripeKey(): void
    {
        Stripe::setApiKey((string) config('subscription.stripe_secret'));
    }

    /**
     * Stack Pro months from the current expiry (or now).
     */
    public function extendProMonths(User $user, ?int $months = null): void
    {
        $months ??= (int) config('subscription.pro_months', 12);
        $user->refresh();
        $base = $user->subscription_expires_at && $user->subscription_expires_at->isFuture()
            ? $user->subscription_expires_at
            : now();

        $user->subscription_expires_at = $base->copy()->addMonths($months);
        $user->save();
    }

    /**
     * Create a Stripe Checkout Session URL for a one-time Pro purchase.
     *
     * @return array{url: string}
     */
    public function createCheckoutSession(User $user): array
    {
        if (! $this->stripeConfigured()) {
            abort(503, 'Stripe checkout is not configured.');
        }

        $this->setStripeKey();
        $priceId = (string) config('subscription.price_id');
        $frontend = rtrim((string) config('app.frontend_url'), '/');

        $session = Session::create([
            'mode' => 'payment',
            'line_items' => [
                [
                    'price' => $priceId,
                    'quantity' => 1,
                ],
            ],
            'success_url' => $frontend.'/subscription?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $frontend.'/subscription?checkout=cancelled',
            'client_reference_id' => (string) $user->id,
            'customer_email' => $user->email,
            'metadata' => [
                'user_id' => (string) $user->id,
            ],
            'payment_intent_data' => [
                'metadata' => [
                    'user_id' => (string) $user->id,
                ],
            ],
        ]);

        return ['url' => $session->url];
    }

    /**
     * Fulfill a paid Checkout session once (idempotent). Returns whether Pro was extended on this call.
     */
    public function fulfillPaidCheckoutSession(Session $session, User $user): bool
    {
        if ($session->payment_status !== 'paid') {
            return false;
        }

        $sessionId = (string) $session->id;
        $metaUser = (string) ($session->metadata['user_id'] ?? '');
        if ($metaUser === '' || (int) $metaUser !== (int) $user->id) {
            abort(403, 'This checkout session does not belong to your account.');
        }

        return $this->fulfillBySessionId($user, $sessionId);
    }

    /**
     * @return bool true if Pro was extended on this invocation; false if already fulfilled before
     */
    public function fulfillBySessionId(User $user, string $stripeCheckoutSessionId): bool
    {
        try {
            return DB::transaction(function () use ($user, $stripeCheckoutSessionId): bool {
                $created = ProCheckoutFulfillment::query()->firstOrCreate(
                    ['stripe_checkout_session_id' => $stripeCheckoutSessionId],
                    ['user_id' => $user->id],
                );

                if (! $created->wasRecentlyCreated) {
                    return false;
                }

                $this->extendProMonths($user);

                return true;
            });
        } catch (QueryException $e) {
            if (str_contains(strtolower($e->getMessage()), 'unique')) {
                return false;
            }

            throw $e;
        }
    }

    /**
     * Fulfill from Stripe webhook (no authenticated user — resolve by Checkout Session metadata).
     */
    public function fulfillFromWebhookSession(Session $session): bool
    {
        if ($session->payment_status !== 'paid') {
            return false;
        }

        $userId = (int) ($session->metadata['user_id'] ?? 0);
        if ($userId < 1) {
            return false;
        }

        $user = User::query()->find($userId);
        if ($user === null) {
            return false;
        }

        return $this->fulfillBySessionId($user, (string) $session->id);
    }

    /**
     * Load session from Stripe and fulfill if paid (used after redirect + webhook).
     *
     * @return array{ extended: bool, payment_status: string|null }
     */
    public function verifyAndFulfillSession(User $user, string $checkoutSessionId): array
    {
        if (! $this->stripeConfigured()) {
            abort(503, 'Stripe checkout is not configured.');
        }

        $this->setStripeKey();
        $session = Session::retrieve($checkoutSessionId);

        if ($session->payment_status !== 'paid') {
            return [
                'extended' => false,
                'payment_status' => $session->payment_status,
            ];
        }

        $extended = $this->fulfillPaidCheckoutSession($session, $user);

        return [
            'extended' => $extended,
            'payment_status' => $session->payment_status,
        ];
    }

    /**
     * @return array{ amount: int|null, currency: string|null, formatted: string|null }
     */
    public function priceSummary(): array
    {
        if (! $this->stripeConfigured()) {
            return ['amount' => null, 'currency' => null, 'formatted' => null];
        }

        try {
            $this->setStripeKey();
            $price = Price::retrieve((string) config('subscription.price_id'));

            $amount = $price->unit_amount !== null ? (int) $price->unit_amount : null;
            $currency = $price->currency !== null ? strtolower((string) $price->currency) : null;
            $formatted = null;
            if ($amount !== null && $currency !== null) {
                $formatted = number_format($amount / 100, 2).' '.strtoupper($currency);
            }

            return [
                'amount' => $amount,
                'currency' => $currency,
                'formatted' => $formatted,
            ];
        } catch (\Throwable) {
            return ['amount' => null, 'currency' => null, 'formatted' => null];
        }
    }
}
