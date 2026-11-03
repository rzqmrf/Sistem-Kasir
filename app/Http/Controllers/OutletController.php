<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\OutletStock;
use App\Models\Product;
use App\Models\StockMutation;
use App\Support\Audit\AuditLogger;
use App\Support\Billing\PlanLimits;
use App\Support\Tenancy\CurrentTenant;
use App\Support\Tenancy\TenantRules;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OutletController extends Controller
{
    public function index(CurrentTenant $currentTenant): Response
    {
        $outlets = Outlet::query()
            ->withCount([
                'shifts as open_shifts_count' => fn ($q) => $q->where('status', 'open'),
                'sales as completed_sales_count' => fn ($q) => $q->where('status', 'completed'),
            ])
            ->withSum('stocks as total_stock_units', 'stock')
            ->orderByDesc('is_main')
            ->orderBy('name')
            ->get();

        $products = Product::where('is_active', true)
            ->with('outletStocks')
            ->orderBy('name')
            ->get(['id', 'name', 'barcode', 'unit', 'stock']);

        return Inertia::render('Outlets/Index', [
            'outletList' => $outlets,
            'products' => $products,
            'activeOutletId' => $currentTenant->outletId(),
        ]);
    }

    public function store(Request $request, CurrentTenant $currentTenant, PlanLimits $limits): RedirectResponse
    {
        $limits->ensureCanAdd($currentTenant->getOrFail(), 'outlets');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:30', 'alpha_dash', TenantRules::unique('outlets', 'code')],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $tenantId = $currentTenant->id();

        DB::transaction(function () use ($validated, $tenantId) {
            $outlet = Outlet::create([
                'name' => $validated['name'],
                'code' => strtoupper($validated['code']),
                'address' => $validated['address'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'is_main' => false,
                'is_active' => true,
            ]);

            $productIds = Product::pluck('id');
            foreach ($productIds as $productId) {
                OutletStock::create([
                    'tenant_id' => $tenantId,
                    'outlet_id' => $outlet->id,
                    'product_id' => $productId,
                    'stock' => 0,
                ]);
            }

            AuditLogger::record(
                action: 'outlet.created',
                summary: "Menambahkan cabang baru {$outlet->name} ({$outlet->code}).",
                subject: $outlet,
                tenantId: $tenantId,
            );
        });

        return back()->with('success', 'Cabang baru berhasil ditambahkan.');
    }

    public function update(Request $request, Outlet $outlet, CurrentTenant $currentTenant, PlanLimits $limits): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:30', 'alpha_dash', TenantRules::unique('outlets', 'code')->ignore($outlet->id)],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['boolean'],
        ]);

        $nextActive = $request->boolean('is_active', true);

        if ($outlet->is_main && ! $nextActive) {
            throw ValidationException::withMessages([
                'is_active' => 'Cabang pusat tidak dapat dinonaktifkan.',
            ]);
        }

        if (! $outlet->is_active && $nextActive) {
            $limits->ensureCanAdd($currentTenant->getOrFail(), 'outlets');
        }

        $before = $outlet->only(['name', 'code', 'is_active']);

        $outlet->update([
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'address' => $validated['address'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'is_active' => $nextActive,
        ]);

        $diff = AuditLogger::diff($before, $outlet->only(['name', 'code', 'is_active']), ['name', 'code', 'is_active']);
        AuditLogger::record(
            action: 'outlet.updated',
            summary: "Memperbarui cabang {$outlet->name} ({$outlet->code}).",
            subject: $outlet,
            changes: $diff,
        );

        return back()->with('success', 'Data cabang berhasil diperbarui.');
    }

    public function switchOutlet(Request $request, CurrentTenant $currentTenant): RedirectResponse
    {
        $validated = $request->validate([
            'outlet_id' => ['required', TenantRules::exists('outlets')],
        ]);

        $outlet = Outlet::where('is_active', true)->find($validated['outlet_id']);

        if (! $outlet) {
            throw ValidationException::withMessages([
                'outlet_id' => 'Cabang tersebut sedang tidak aktif.',
            ]);
        }

        $request->session()->put("current_outlet_id.{$currentTenant->id()}", $outlet->id);
        $currentTenant->setOutlet($outlet);

        return back()->with('success', "Cabang aktif berpindah ke {$outlet->name}.");
    }

    public function transferStock(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'from_outlet_id' => ['required', TenantRules::exists('outlets')],
            'to_outlet_id' => ['required', 'different:from_outlet_id', TenantRules::exists('outlets')],
            'product_id' => ['required', TenantRules::exists('products')],
            'qty' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $fromOutlet = Outlet::where('is_active', true)->findOrFail($validated['from_outlet_id']);
        $toOutlet = Outlet::where('is_active', true)->findOrFail($validated['to_outlet_id']);
        $qty = (int) $validated['qty'];

        DB::transaction(function () use ($fromOutlet, $toOutlet, $validated, $qty) {
            $product = Product::lockForUpdate()->findOrFail($validated['product_id']);

            // Lock in deterministic order to avoid deadlocks.
            if ($fromOutlet->id < $toOutlet->id) {
                $sourceStock = $product->lockOutletStock($fromOutlet->id);
                $destStock = $product->lockOutletStock($toOutlet->id);
            } else {
                $destStock = $product->lockOutletStock($toOutlet->id);
                $sourceStock = $product->lockOutletStock($fromOutlet->id);
            }

            if ($sourceStock->stock < $qty) {
                throw ValidationException::withMessages([
                    'qty' => "Stok {$product->name} di {$fromOutlet->name} hanya tersedia {$sourceStock->stock} {$product->unit}.",
                ]);
            }

            $sourceStock->stock -= $qty;
            $sourceStock->save();

            $destStock->stock += $qty;
            $destStock->save();

            $noteSuffix = ! empty($validated['notes']) ? " ({$validated['notes']})" : '';

            StockMutation::create([
                'outlet_id' => $fromOutlet->id,
                'product_id' => $product->id,
                'type' => 'adjustment',
                'qty_change' => -$qty,
                'balance_stock' => $sourceStock->stock,
                'reference_type' => 'OutletTransferOut',
                'reference_id' => $toOutlet->id,
                'notes' => "Transfer keluar ke {$toOutlet->name}{$noteSuffix}",
            ]);

            StockMutation::create([
                'outlet_id' => $toOutlet->id,
                'product_id' => $product->id,
                'type' => 'restock',
                'qty_change' => $qty,
                'balance_stock' => $destStock->stock,
                'reference_type' => 'OutletTransferIn',
                'reference_id' => $fromOutlet->id,
                'notes' => "Transfer masuk dari {$fromOutlet->name}{$noteSuffix}",
            ]);

            $product->recalculateTotalStock();

            AuditLogger::record(
                action: 'outlet.stock_transferred',
                summary: "Transfer {$qty} {$product->unit} {$product->name} dari {$fromOutlet->name} ke {$toOutlet->name}.",
                subject: $product,
                changes: [
                    'qty' => ['before' => 0, 'after' => $qty],
                ],
            );
        });

        return back()->with('success', "Berhasil mentransfer {$qty} stok dari {$fromOutlet->name} ke {$toOutlet->name}.");
    }
}
