<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantRole
{
    public function __construct(private CurrentTenant $currentTenant) {}

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $tenant = $this->currentTenant->get();
        $user = $request->user();
        $role = $tenant ? $user?->roleIn($tenant) : null;

        if (! $role || ! in_array($role, $roles, true)) {
            abort(403, 'Anda tidak memiliki izin untuk mengakses halaman ini.');
        }

        return $next($request);
    }
}
