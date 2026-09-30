<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Models\StockMutation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    /**
     * Display product list & stock overview
     */
    public function index(Request $request): Response
    {
        $search = $request->get('search');
        $categoryId = $request->get('category_id');

        $products = Product::query()
            ->with(['category', 'priceTiers'])
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
     * Store new product with tiers
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'category_id' => 'nullable|exists:categories,id',
            'barcode' => 'required|string|unique:products,barcode',
            'sku' => 'nullable|string|unique:products,sku',
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

        // Initial stock mutation
        if ($product->stock > 0) {
            StockMutation::create([
                'product_id' => $product->id,
                'type' => 'restock',
                'qty_change' => $product->stock,
                'balance_stock' => $product->stock,
                'reference_type' => 'Initial',
                'notes' => 'Stok awal produk baru',
            ]);
        }

        // Tiers
        if (!empty($validated['tiers'])) {
            foreach ($validated['tiers'] as $tier) {
                ProductPriceTier::create([
                    'product_id' => $product->id,
                    'min_qty' => $tier['min_qty'],
                    'tier_price' => $tier['tier_price'],
                ]);
            }
        }

        return back()->with('success', 'Produk berhasil ditambahkan.');
    }

    /**
     * Update product
     */
    public function update(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'category_id' => 'nullable|exists:categories,id',
            'barcode' => 'required|string|unique:products,barcode,' . $product->id,
            'sku' => 'nullable|string|unique:products,sku,' . $product->id,
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
        if (!empty($validated['tiers'])) {
            foreach ($validated['tiers'] as $tier) {
                ProductPriceTier::create([
                    'product_id' => $product->id,
                    'min_qty' => $tier['min_qty'],
                    'tier_price' => $tier['tier_price'],
                ]);
            }
        }

        return back()->with('success', 'Data produk berhasil diperbarui.');
    }

    /**
     * Stock adjustment / Restock
     */
    public function adjustStock(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:restock,adjustment,return',
            'qty' => 'required|integer|min:1',
            'notes' => 'required|string|max:255',
        ]);

        $qtyChange = $validated['type'] === 'adjustment' && $request->input('is_reduction') ? -$validated['qty'] : $validated['qty'];
        $newStock = max(0, $product->stock + $qtyChange);

        $product->stock = $newStock;
        $product->save();

        StockMutation::create([
            'product_id' => $product->id,
            'type' => $validated['type'],
            'qty_change' => $qtyChange,
            'balance_stock' => $newStock,
            'reference_type' => 'ManualAdjustment',
            'notes' => $validated['notes'],
        ]);

        return back()->with('success', 'Stok produk berhasil disesuaikan.');
    }
}
