<?php

namespace App\Http\Controllers;

use App\Actions\CreateTenantForOwner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    public function store(Request $request, CreateTenantForOwner $createTenant): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $tenant = $createTenant->handle($request->user(), $validated['name']);
        $request->session()->put('current_tenant_id', $tenant->id);

        return redirect()
            ->route('pos.index', ['tenant' => $tenant->slug])
            ->with('success', "Toko \"{$tenant->name}\" berhasil dibuat.");
    }
}
