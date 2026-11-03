<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SuperAdminController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim($request->string('search')->toString());
        $statusFilter = $request->string('status')->toString();

        $allSubscriptions = Subscription::with(['plan', 'tenant'])->get();

        $mrr = $allSubscriptions
            ->filter(fn (Subscription $sub) => $sub->tenant?->isActive()
                && $sub->status === Subscription::ACTIVE
                && ! $sub->isExpired()
                && $sub->plan
                && $sub->plan->price_monthly > 0)
            ->sum(fn (Subscription $sub) => $sub->plan->price_monthly);

        $trialingCount = $allSubscriptions
            ->filter(fn (Subscription $sub) => $sub->tenant?->isActive() && $sub->onTrial())
            ->count();

        $metrics = [
            'total_tenants' => Tenant::count(),
            'active_tenants' => Tenant::where('status', 'active')->count(),
            'suspended_tenants' => Tenant::where('status', '!=', 'active')->count(),
            'trialing_tenants' => $trialingCount,
            'mrr' => (int) $mrr,
            'revenue_30d' => (int) Invoice::withoutGlobalScopes()
                ->where('status', Invoice::PAID)
                ->where('paid_at', '>=', now()->subDays(30))
                ->sum('amount'),
        ];

        $outletCounts = Outlet::withoutGlobalScopes()
            ->where('is_active', true)
            ->selectRaw('tenant_id, COUNT(*) as aggregate')
            ->groupBy('tenant_id')
            ->pluck('aggregate', 'tenant_id');

        $productCounts = Product::withoutGlobalScopes()
            ->selectRaw('tenant_id, COUNT(*) as aggregate')
            ->groupBy('tenant_id')
            ->pluck('aggregate', 'tenant_id');

        $tenants = Tenant::query()
            ->with(['users' => fn ($q) => $q->wherePivot('role', Tenant::ROLE_OWNER), 'subscription.plan'])
            ->withCount('users')
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('slug', 'like', "%{$search}%");
                });
            })
            ->when(in_array($statusFilter, ['active', 'suspended'], true), fn ($q) => $q->where('status', $statusFilter))
            ->latest()
            ->paginate(20)
            ->through(function (Tenant $tenant) use ($outletCounts, $productCounts) {
                $owner = $tenant->users->first();
                $sub = $tenant->subscription ?? $tenant->currentSubscription();

                return [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'status' => $tenant->status,
                    'created_at' => $tenant->created_at?->toIso8601String(),
                    'owner' => $owner ? [
                        'name' => $owner->name,
                        'email' => $owner->email,
                    ] : null,
                    'subscription' => [
                        'plan_name' => $sub->plan->name,
                        'plan_code' => $sub->plan->code,
                        'status' => $sub->displayStatus(),
                        'days_left' => $sub->daysLeft(),
                    ],
                    'counts' => [
                        'outlets' => (int) ($outletCounts[$tenant->id] ?? 0),
                        'users' => (int) $tenant->users_count,
                        'products' => (int) ($productCounts[$tenant->id] ?? 0),
                    ],
                ];
            })
            ->withQueryString();

        $recentInvoices = Invoice::withoutGlobalScopes()
            ->with(['tenant:id,name,slug', 'plan:id,name,code'])
            ->latest()
            ->take(15)
            ->get();

        return Inertia::render('Admin/Index', [
            'metrics' => $metrics,
            'tenantList' => $tenants,
            'recentInvoices' => $recentInvoices,
            'filters' => [
                'search' => $search,
                'status' => in_array($statusFilter, ['active', 'suspended'], true) ? $statusFilter : '',
            ],
        ]);
    }

    public function updateTenantStatus(Request $request, Tenant $tenant): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:active,suspended'],
        ]);

        $oldStatus = $tenant->status;
        $nextStatus = $validated['status'];

        if ($oldStatus !== $nextStatus) {
            $tenant->update(['status' => $nextStatus]);

            $label = $nextStatus === 'active' ? 'diaktifkan kembali' : 'ditangguhkan (suspended)';
            AuditLogger::record(
                action: 'tenant.status_changed',
                summary: "Toko {$tenant->name} {$label} oleh Super Admin.",
                subject: $tenant,
                changes: [
                    'status' => ['before' => $oldStatus, 'after' => $nextStatus],
                ],
                tenantId: $tenant->id,
            );
        }

        return back()->with(
            'success',
            $nextStatus === 'active'
                ? "Toko {$tenant->name} berhasil diaktifkan kembali."
                : "Toko {$tenant->name} telah ditangguhkan."
        );
    }
}
