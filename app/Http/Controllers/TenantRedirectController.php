<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TenantRedirectController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $user = $request->user();
        $tenant = $user->defaultTenant($request->session()->get('current_tenant_id'));

        if ((! $tenant || ! $tenant->isActive()) && $user->isSuperAdmin()) {
            return redirect()->route('admin.index');
        }

        abort_if(! $tenant, 403, 'Akun ini belum terhubung ke toko mana pun.');

        return redirect()->route('pos.index', ['tenant' => $tenant->slug]);
    }
}
