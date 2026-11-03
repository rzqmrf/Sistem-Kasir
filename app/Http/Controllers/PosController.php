<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Shift;
use App\Models\StockMutation;
use App\Support\Tenancy\CurrentTenant;
use App\Support\Tenancy\TenantRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    /**
     * Render the main Cashier POS screen
     */
    public function index(Request $request, CurrentTenant $currentTenant): Response
    {
        $user = $request->user();
        $outlet = $currentTenant->outletOrFail();

        // Get active shift for this user in the active outlet
        $currentShift = Shift::where('user_id', $user->id)
            ->where('outlet_id', $outlet->id)
            ->where('status', 'open')
            ->latest()
            ->with(['cashMutations'])
            ->first();

        $categories = Category::all();

        $products = Product::where('is_active', true)
            ->with(['category', 'priceTiers', 'outletStocks'])
            ->get()
            ->map(fn (Product $product) => $product->hydrateOutletStock($outlet->id));

        // Get held orders from session
        $heldOrders = session()->get($this->heldOrdersKey(), []);

        return Inertia::render('Pos/Index', [
            'currentShift' => $currentShift,
            'categories' => $categories,
            'products' => $products,
            'heldOrders' => $heldOrders,
        ]);
    }

    /**
     * Search product by barcode or name
     */
    public function search(Request $request, CurrentTenant $currentTenant): JsonResponse
    {
        $query = $request->get('q', '');
        $outlet = $currentTenant->outletOrFail();

        $products = Product::where('is_active', true)
            ->where(function ($q) use ($query) {
                $q->where('barcode', 'like', "%{$query}%")
                    ->orWhere('name', 'like', "%{$query}%")
                    ->orWhere('sku', 'like', "%{$query}%");
            })
            ->with(['priceTiers', 'category', 'outletStocks'])
            ->take(15)
            ->get()
            ->map(fn (Product $product) => $product->hydrateOutletStock($outlet->id));

        return response()->json($products);
    }

    /**
     * Process checkout transaction
     */
    public function checkout(Request $request, CurrentTenant $currentTenant): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => ['required', TenantRules::exists('products')],
            'items.*.qty' => 'required|integer|min:1',
            'customer_name' => 'nullable|string|max:100',
            'payment_type' => 'required|in:cash,qris,transfer,debit',
            'paid_amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $outlet = $currentTenant->outletOrFail();

        $currentShift = Shift::where('user_id', $user->id)
            ->where('outlet_id', $outlet->id)
            ->where('status', 'open')
            ->latest()
            ->first();

        if (! $currentShift) {
            return response()->json([
                'message' => "Laci kasir di {$outlet->name} belum dibuka. Silakan buka shift terlebih dahulu.",
            ], 422);
        }

        return DB::transaction(function () use ($request, $user, $outlet, $currentShift) {
            $itemsData = $request->items;
            $subtotal = 0;
            $totalBuyPrice = 0;
            $saleItemsPayload = [];

            // Generate unique invoice number: INV-YYYYMMDD-XXXX
            $datePrefix = now()->format('Ymd');
            $todayCount = Sale::whereDate('created_at', now()->toDateString())->count() + 1;
            $invoiceNo = 'INV-'.$datePrefix.'-'.str_pad($todayCount, 4, '0', STR_PAD_LEFT);

            foreach ($itemsData as $item) {
                $product = Product::with('priceTiers')->lockForUpdate()->find($item['product_id']);

                if (! $product) {
                    throw new \Exception("Produk ID {$item['product_id']} tidak ditemukan.");
                }

                $outletStock = $product->lockOutletStock($outlet->id);

                if ($outletStock->stock < $item['qty']) {
                    throw new \Exception("Stok tidak mencukupi untuk {$product->name} di {$outlet->name}. Stok tersedia: {$outletStock->stock}");
                }

                // Calculate price based on tiered pricing
                $effectivePrice = $product->getPriceForQuantity((int) $item['qty']);
                $itemSubtotal = $effectivePrice * (int) $item['qty'];
                $itemDiscount = ($product->sell_price - $effectivePrice) * (int) $item['qty'];
                if ($itemDiscount < 0) {
                    $itemDiscount = 0;
                }

                $subtotal += $itemSubtotal;
                $totalBuyPrice += ((float) $product->buy_price * (int) $item['qty']);

                // Deduct outlet stock and sync total stock
                $outletStock->stock -= (int) $item['qty'];
                $outletStock->save();
                $product->recalculateTotalStock();

                // Record stock mutation for this outlet
                StockMutation::create([
                    'outlet_id' => $outlet->id,
                    'product_id' => $product->id,
                    'type' => 'sale',
                    'qty_change' => -(int) $item['qty'],
                    'balance_stock' => $outletStock->stock,
                    'reference_type' => 'Sale',
                    'reference_id' => null,
                    'notes' => "Penjualan Kasir ({$outlet->code}) - Invoice {$invoiceNo}",
                ]);

                $saleItemsPayload[] = [
                    'product_id' => $product->id,
                    'qty' => (int) $item['qty'],
                    'buy_price' => $product->buy_price,
                    'sell_price' => $effectivePrice,
                    'discount_amount' => $itemDiscount,
                    'subtotal' => $itemSubtotal,
                ];
            }

            $grandTotal = $subtotal;
            $paidAmount = (float) $request->paid_amount;
            $changeAmount = max(0, $paidAmount - $grandTotal);

            if ($request->payment_type === 'cash' && $paidAmount < $grandTotal) {
                throw new \Exception('Nominal pembayaran tunai kurang dari total tagihan.');
            }

            // Create Sale record
            $sale = Sale::create([
                'outlet_id' => $outlet->id,
                'invoice_no' => $invoiceNo,
                'shift_id' => $currentShift->id,
                'cashier_id' => $user->id,
                'customer_name' => $request->customer_name ?: 'Pelanggan Umum',
                'subtotal' => $subtotal,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'grand_total' => $grandTotal,
                'total_buy_price' => $totalBuyPrice,
                'paid_amount' => $paidAmount,
                'change_amount' => $changeAmount,
                'status' => 'completed',
                'notes' => $request->notes,
            ]);

            // Save sale items
            foreach ($saleItemsPayload as $sItem) {
                $sale->items()->create($sItem);
            }

            // Save payment detail
            $sale->paymentDetails()->create([
                'payment_type' => $request->payment_type,
                'amount' => $request->payment_type === 'cash' ? $grandTotal : $paidAmount,
                'reference_no' => $request->reference_no ?? null,
            ]);

            // Update shift expected cash
            $currentShift->expected_cash = $currentShift->calculateExpectedCash();
            $currentShift->save();

            // Load full relationships for receipt
            $sale->load(['items.product', 'cashier', 'paymentDetails', 'outlet']);

            return response()->json([
                'message' => 'Transaksi berhasil diproses',
                'sale' => $sale,
            ]);
        });
    }

    /**
     * Hold current order
     */
    public function holdOrder(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'customer_name' => 'nullable|string',
        ]);

        $heldOrders = session()->get($this->heldOrdersKey(), []);

        $newOrder = [
            'id' => (string) Str::uuid(),
            'customer_name' => $request->customer_name ?: 'Pelanggan #'.(count($heldOrders) + 1),
            'items' => $request->items,
            'held_at' => now()->toIso8601String(),
            'total_items' => array_sum(array_column($request->items, 'qty')),
        ];

        $heldOrders[] = $newOrder;
        session()->put($this->heldOrdersKey(), $heldOrders);

        return response()->json([
            'message' => 'Transaksi berhasil diparkir / di-hold',
            'heldOrders' => $heldOrders,
        ]);
    }

    /**
     * Release/Delete a held order
     */
    public function releaseHeldOrder(Request $request, string $id): JsonResponse
    {
        $heldOrders = session()->get($this->heldOrdersKey(), []);
        $heldOrders = array_values(array_filter($heldOrders, fn ($order) => $order['id'] !== $id));
        session()->put($this->heldOrdersKey(), $heldOrders);

        return response()->json([
            'message' => 'Order berhasil dipulihkan',
            'heldOrders' => $heldOrders,
        ]);
    }

    /**
     * Held orders are kept per store and per outlet so switching stores/outlets never mixes carts.
     */
    private function heldOrdersKey(): string
    {
        $ctx = app(CurrentTenant::class);

        return 'pos_held_orders.'.$ctx->id().'.'.$ctx->outletId();
    }
}
