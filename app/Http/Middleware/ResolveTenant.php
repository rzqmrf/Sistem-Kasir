<?php

namespace App\Http\Middleware;

use App\Models\Outlet;
use App\Models\Tenant;
use App\Support\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the {tenant} slug from the URL, verifies the user is a member,
 * resolves the active outlet, and makes both available to the rest of the request.
 */
class ResolveTenant
{
    public function __construct(private CurrentTenant $currentTenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $route = $request->route();
        $slug = $route->parameter('tenant');

        $tenant = Tenant::where('slug', $slug)->first();
        $user = $request->user();

        // 404 instead of 403 so the existence of other stores is not leaked.
        if (! $tenant || ! $user || ! $user->belongsToTenant($tenant)) {
            abort(404);
        }

        if (! $tenant->isActive()) {
            abort(403, 'Toko ini sedang dinonaktifkan.');
        }

        $this->currentTenant->set($tenant);

        $sessionOutletKey = "current_outlet_id.{$tenant->id}";
        $preferredOutletId = $request->session()->get($sessionOutletKey);

        $outlet = $preferredOutletId
            ? Outlet::where('is_active', true)->find($preferredOutletId)
            : null;

        if (! $outlet) {
            $outlet = Outlet::where('is_active', true)
                ->orderByDesc('is_main')
                ->orderBy('id')
                ->first() ?? $tenant->ensureMainOutlet();
        }

        $this->currentTenant->setOutlet($outlet);

        URL::defaults(['tenant' => $tenant->slug]);
        $route->forgetParameter('tenant');
        $request->session()->put('current_tenant_id', $tenant->id);
        $request->session()->put($sessionOutletKey, $outlet->id);

        return $next($request);
    }
}
