<?php

namespace App\Http\Middleware;

use App\Models\Outlet;
use App\Models\Tenant;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user,
            ],
            // Lazy: evaluated at render time, after ResolveTenant has run.
            'tenant' => function () use ($user) {
                $tenant = app(CurrentTenant::class)->get();

                return $tenant ? [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'role' => $user?->roleIn($tenant),
                ] : null;
            },
            'outlet' => function () {
                $outlet = app(CurrentTenant::class)->outlet();

                return $outlet ? [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                    'is_main' => $outlet->is_main,
                ] : null;
            },
            'outlets' => function () {
                if (! app(CurrentTenant::class)->has()) {
                    return [];
                }

                return Outlet::where('is_active', true)
                    ->orderByDesc('is_main')
                    ->orderBy('name')
                    ->get(['id', 'name', 'code', 'is_main'])
                    ->values();
            },
            'tenants' => fn () => $user
                ? $user->tenants()
                    ->where('status', 'active')
                    ->orderBy('name')
                    ->get()
                    ->map(fn (Tenant $t) => [
                        'id' => $t->id,
                        'name' => $t->name,
                        'slug' => $t->slug,
                        'role' => $t->pivot->role,
                    ])
                    ->values()
                : [],
            'subscription' => function () {
                $tenant = app(CurrentTenant::class)->get();
                if (! $tenant) {
                    return null;
                }

                $sub = $tenant->currentSubscription();

                return [
                    'plan_name' => $sub->plan->name,
                    'plan_code' => $sub->plan->code,
                    'status' => $sub->displayStatus(),
                    'days_left' => $sub->daysLeft(),
                    'is_expired' => $sub->isExpired(),
                ];
            },
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'pay_invoice_id' => fn () => $request->session()->get('pay_invoice_id'),
            ],
        ];
    }
}
