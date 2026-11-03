<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Models\StockMutation;
use App\Support\Audit\AuditLogger;
use App\Support\Billing\PlanLimits;
use App\Support\Tenancy\CurrentTenant;
use App\Support\Tenancy\TenantRules;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    /**
     * Display product list & stock overview for the active outlet
     */
    public function index(Request $request, CurrentTenant $currentTenant): Response
    {
        $search = $request->get('search');
        $categoryId = $request->get('category_id');
        $outlet = $currentTenant->outletOrFail();

        $products = Product::query()
            ->with(['category', 'priceTiers', 'outletStocks'])
            ->when($search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                });
            })
            ->when($categoryId, function ($query, $categoryId) {
                $query->where('category_id', $categoryId);
            })
            ->latest()
            ->paginate(15)
            ->through(fn (Product $product) => $product->hydrateOutletStock($outlet->id))
            ->withQueryString();

        $categories = Category::all();

        return Inertia::render('Products/Index', [
            'products' => $products,
            'categories' => $categories,
            'filters' => [
                'search' => $search,
                'category_id' => $categoryId,
            ],
        ]);
    }

    /**
     * Store new product with tiers (initial stock goes into the active outlet)
     */
    public function store(Request $request, CurrentTenant $currentTenant, PlanLimits $limits): RedirectResponse
    {
        $limits->ensureCanAdd($currentTenant->getOrFail(), 'products');

        $validated = $request->validate([
            'category_id' => ['nullable', TenantRules::exists('categories')],
            'barcode' => ['required', 'string', TenantRules::unique('products', 'barcode')],
            'sku' => ['nullable', 'string', TenantRules::unique('products', 'sku')],
            'name' => 'required|string|max:255',
            'buy_price' => 'required|numeric|min:0',
            'sell_price' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'min_stock_alert' => 'required|integer|min:0',
            'unit' => 'required|string|max:50',
            'tiers' => 'nullable|array',
            'tiers.*.min_qty' => 'required_with:tiers|integer|min:2',
            'tiers.*.tier_price' => 'required_with:tiers|numeric|min:0',
        ]);

        $outlet = $currentTenant->outletOrFail();

        DB::transaction(function () use ($validated, $outlet) {
            $product = Product::create([
                'category_id' => $validated['category_id'] ?? null,
                'barcode' => $validated['barcode'],
                'sku' => $validated['sku'] ?? null,
                'name' => $validated['name'],
                'buy_price' => $validated['buy_price'],
                'sell_price' => $validated['sell_price'],
                'stock' => $validated['stock'],
                'min_stock_alert' => $validated['min_stock_alert'],
                'unit' => $validated['unit'],
                'is_active' => true,
            ]);

            if ((int) $validated['stock'] > 0) {
                StockMutation::create([
                    'outlet_id' => $outlet->id,
                    'product_id' => $product->id,
                    'type' => 'restock',
                    'qty_change' => (int) $validated['stock'],
                    'balance_stock' => (int) $validated['stock'],
                    'reference_type' => 'Initial',
                    'notes' => "Stok awal produk baru ({$outlet->name})",
                ]);
            }

            if (! empty($validated['tiers'])) {
                foreach ($validated['tiers'] as $tier) {
                    ProductPriceTier::create([
                        'product_id' => $product->id,
                        'min_qty' => $tier['min_qty'],
                        'tier_price' => $tier['tier_price'],
                    ]);
                }
            }

            AuditLogger::record(
                action: 'product.created',
                summary: "Menambahkan produk {$product->name} ({$product->barcode}).",
                subject: $product,
                changes: [
                    'buy_price' => ['before' => null, 'after' => (float) $product->buy_price],
                    'sell_price' => ['before' => null, 'after' => (float) $product->sell_price],
                    'stock' => ['before' => 0, 'after' => (int) $validated['stock']],
                ],
            );
        });

        return back()->with('success', "Produk berhasil ditambahkan (stok awal di {$outlet->name}).");
    }

    /**
     * Update product
     */
    public function update(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'category_id' => ['nullable', TenantRules::exists('categories')],
            'barcode' => ['required', 'string', TenantRules::unique('products', 'barcode')->ignore($product->id)],
            'sku' => ['nullable', 'string', TenantRules::unique('products', 'sku')->ignore($product->id)],
            'name' => 'required|string|max:255',
            'buy_price' => 'required|numeric|min:0',
            'sell_price' => 'required|numeric|min:0',
            'min_stock_alert' => 'required|integer|min:0',
            'unit' => 'required|string|max:50',
            'is_active' => 'boolean',
            'tiers' => 'nullable|array',
            'tiers.*.min_qty' => 'required_with:tiers|integer|min:2',
            'tiers.*.tier_price' => 'required_with:tiers|numeric|min:0',
        ]);

        $before = $product->only(['name', 'barcode', 'buy_price', 'sell_price', 'min_stock_alert', 'is_active']);

        $product->update([
            'category_id' => $validated['category_id'] ?? null,
            'barcode' => $validated['barcode'],
            'sku' => $validated['sku'] ?? null,
            'name' => $validated['name'],
            'buy_price' => $validated['buy_price'],
            'sell_price' => $validated['sell_price'],
            'min_stock_alert' => $validated['min_stock_alert'],
            'unit' => $validated['unit'],
            'is_active' => $request->boolean('is_active', true),
        ]);

        // Sync tiers
        $product->priceTiers()->delete();
        if (! empty($validated['tiers'])) {
            foreach ($validated['tiers'] as $tier) {
                ProductPriceTier::create([
                    'product_id' => $product->id,
                    'min_qty' => $tier['min_qty'],
                    'tier_price' => $tier['tier_price'],
                ]);
            }
        }

        $diff = AuditLogger::diff(
            $before,
            $product->only(['name', 'barcode', 'buy_price', 'sell_price', 'min_stock_alert', 'is_active']),
            ['name', 'barcode', 'buy_price', 'sell_price', 'min_stock_alert', 'is_active']
        );

        AuditLogger::record(
            action: 'product.updated',
            summary: "Memperbarui produk {$product->name} ({$product->barcode}).",
            subject: $product,
            changes: $diff,
        );

        return back()->with('success', 'Data produk berhasil diperbarui.');
    }

    /**
     * Stock adjustment / Restock in the active outlet
     */
    public function adjustStock(Request $request, Product $product, CurrentTenant $currentTenant): RedirectResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:restock,adjustment,return',
            'qty' => 'required|integer|min:1',
            'notes' => 'required|string|max:255',
        ]);

        $outlet = $currentTenant->outletOrFail();
        $qtyChange = $validated['type'] === 'adjustment' && $request->input('is_reduction')
            ? -$validated['qty']
            : $validated['qty'];

        DB::transaction(function () use ($product, $outlet, $validated, $qtyChange) {
            $outletStock = $product->lockOutletStock($outlet->id);
            $prevStock = (int) $outletStock->stock;
            $newStock = max(0, $prevStock + $qtyChange);

            $outletStock->stock = $newStock;
            $outletStock->save();

            $product->recalculateTotalStock();

            StockMutation::create([
                'outlet_id' => $outlet->id,
                'product_id' => $product->id,
                'type' => $validated['type'],
                'qty_change' => $qtyChange,
                'balance_stock' => $newStock,
                'reference_type' => 'ManualAdjustment',
                'notes' => $validated['notes'],
            ]);

            $deltaLabel = $qtyChange >= 0 ? "+{$qtyChange}" : (string) $qtyChange;
            AuditLogger::record(
                action: 'product.stock_adjusted',
                summary: "Menyesuaikan stok {$product->name} di {$outlet->name} ({$deltaLabel}).",
                subject: $product,
                changes: [
                    'outlet_stock' => ['before' => $prevStock, 'after' => $newStock],
                ],
            );
        });

        return back()->with('success', "Stok produk di {$outlet->name} berhasil disesuaikan.");
    }
}
