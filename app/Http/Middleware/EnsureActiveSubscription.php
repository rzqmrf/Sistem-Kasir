<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * When the subscription has expired the store becomes read-only: pages and reports
 * still open, but any write (checkout, product edits, staff changes) is refused
 * until the owner pays or moves to the free plan. Billing routes stay writable.
 */
class EnsureActiveSubscription
{
    private const ALWAYS_ALLOWED_ROUTES = [
        'billing.*',
        'outlets.switch',
        'staff.destroy',
    ];

    public function __construct(private CurrentTenant $currentTenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->isAllowedWhileExpired($request)) {
            return $next($request);
        }

        $tenant = $this->currentTenant->get();

        if (! $tenant || ! $tenant->currentSubscription()->isExpired()) {
            return $next($request);
        }

        $message = 'Langganan toko sudah berakhir. Toko dalam mode baca-saja sampai pemilik memperpanjang paket.';

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $message], 402);
        }

        return back()->with('error', $message);
    }

    private function isAllowedWhileExpired(Request $request): bool
    {
        if ($request->isMethodSafe() || $request->routeIs(...self::ALWAYS_ALLOWED_ROUTES)) {
            return true;
        }

        // Allow deactivating extra branches so an expired store can fit into the free Starter plan.
        if ($request->routeIs('outlets.update') && ! $request->boolean('is_active', true)) {
            return true;
        }

        return false;
    }
}
