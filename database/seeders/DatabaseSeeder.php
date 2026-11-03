<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\OutletStock;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Models\Shift;
use App\Models\StockMutation;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Users
        $admin = User::create([
            'name' => 'Owner / Manager Toko',
            'email' => 'admin@quickretail.com',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);
        $admin->forceFill(['is_super_admin' => true])->save();

        $cashier = User::create([
            'name' => 'Budi Kasir',
            'email' => 'kasir@quickretail.com',
            'password' => Hash::make('password123'),
            'role' => 'cashier',
            'is_active' => true,
        ]);

        // 1b. Tenant (store). Everything below is created inside this tenant's context.
        $currentTenant = app(CurrentTenant::class);
        $demo = Tenant::create(['name' => 'Toko Demo QuickRetail', 'slug' => 'demo', 'status' => 'active']);
        $demo->users()->attach($admin->id, ['role' => Tenant::ROLE_OWNER]);
        $demo->users()->attach($cashier->id, ['role' => Tenant::ROLE_CASHIER]);
        $mainOutlet = $demo->ensureMainOutlet();
        $currentTenant->set($demo);
        $currentTenant->setOutlet($mainOutlet);

        $branchSudirman = Outlet::create([
            'name' => 'Cabang Sudirman',
            'code' => 'SDRM',
            'address' => 'Jl. Jend. Sudirman No. 45',
            'phone' => '081234567890',
            'is_main' => false,
            'is_active' => true,
        ]);

        // 2. Categories
        $catFnb = Category::create(['name' => 'Makanan & Minuman', 'slug' => 'makanan-minuman']);
        $catGroceries = Category::create(['name' => 'Kebutuhan Dapur', 'slug' => 'kebutuhan-dapur']);
        $catToiletries = Category::create(['name' => 'Perawatan & Kebersihan', 'slug' => 'perawatan-kebersihan']);
        $catSnacks = Category::create(['name' => 'Snack & Biskuit', 'slug' => 'snack-biskuit']);

        // 3. Products List
        $productsData = [
            [
                'category_id' => $catFnb->id,
                'barcode' => '8991234567011',
                'sku' => 'FNB-001',
                'name' => 'Indomie Goreng Original 85g',
                'buy_price' => 2750,
                'sell_price' => 3500,
                'stock' => 120,
                'min_stock_alert' => 20,
                'unit' => 'pcs',
                'tiers' => [
                    ['min_qty' => 5, 'tier_price' => 3200],
                    ['min_qty' => 40, 'tier_price' => 3000], // 1 Dus
                ],
            ],
            [
                'category_id' => $catFnb->id,
                'barcode' => '8991234567028',
                'sku' => 'FNB-002',
                'name' => 'Indomie Kuah Ayam Bawang 75g',
                'buy_price' => 2650,
                'sell_price' => 3500,
                'stock' => 95,
                'min_stock_alert' => 20,
                'unit' => 'pcs',
                'tiers' => [
                    ['min_qty' => 5, 'tier_price' => 3200],
                ],
            ],
            [
                'category_id' => $catFnb->id,
                'barcode' => '8998009010012',
                'sku' => 'FNB-003',
                'name' => 'Le Minerale 600ml',
                'buy_price' => 2500,
                'sell_price' => 3500,
                'stock' => 150,
                'min_stock_alert' => 24,
                'unit' => 'botol',
                'tiers' => [
                    ['min_qty' => 6, 'tier_price' => 3000],
                ],
            ],
            [
                'category_id' => $catFnb->id,
                'barcode' => '8996001304123',
                'sku' => 'FNB-004',
                'name' => 'Ultra Milk Cokelat 250ml',
                'buy_price' => 5500,
                'sell_price' => 7000,
                'stock' => 60,
                'min_stock_alert' => 15,
                'unit' => 'pcs',
                'tiers' => [
                    ['min_qty' => 4, 'tier_price' => 6500],
                ],
            ],
            [
                'category_id' => $catGroceries->id,
                'barcode' => '8992775123456',
                'sku' => 'GRO-001',
                'name' => 'Minyak Goreng Bimoli 2L Pouch',
                'buy_price' => 31000,
                'sell_price' => 36500,
                'stock' => 40,
                'min_stock_alert' => 10,
                'unit' => 'pouch',
                'tiers' => [
                    ['min_qty' => 2, 'tier_price' => 35000],
                ],
            ],
            [
                'category_id' => $catGroceries->id,
                'barcode' => '8992775654321',
                'sku' => 'GRO-002',
                'name' => 'Gulaku Gula Pasir Tebu 1kg',
                'buy_price' => 15500,
                'sell_price' => 18500,
                'stock' => 50,
                'min_stock_alert' => 10,
                'unit' => 'pack',
                'tiers' => [
                    ['min_qty' => 3, 'tier_price' => 17800],
                ],
            ],
            [
                'category_id' => $catToiletries->id,
                'barcode' => '8999999123001',
                'sku' => 'TOI-001',
                'name' => 'Lifebuoy Sabun Cair Total 10 450ml',
                'buy_price' => 21000,
                'sell_price' => 26000,
                'stock' => 35,
                'min_stock_alert' => 8,
                'unit' => 'pouch',
                'tiers' => [
                    ['min_qty' => 2, 'tier_price' => 24500],
                ],
            ],
            [
                'category_id' => $catToiletries->id,
                'barcode' => '8999999123002',
                'sku' => 'TOI-002',
                'name' => 'Pepsodent Pencegah Gigi Berlubang 190g',
                'buy_price' => 12500,
                'sell_price' => 16000,
                'stock' => 45,
                'min_stock_alert' => 10,
                'unit' => 'pcs',
                'tiers' => [],
            ],
            [
                'category_id' => $catSnacks->id,
                'barcode' => '8993005112233',
                'sku' => 'SNK-001',
                'name' => 'Oreo Sandwich Vanilla 119g',
                'buy_price' => 8000,
                'sell_price' => 10500,
                'stock' => 70,
                'min_stock_alert' => 12,
                'unit' => 'pack',
                'tiers' => [
                    ['min_qty' => 3, 'tier_price' => 9800],
                ],
            ],
            [
                'category_id' => $catSnacks->id,
                'barcode' => '8993005998877',
                'sku' => 'SNK-002',
                'name' => 'Chitato Sapi Panggang 68g',
                'buy_price' => 9500,
                'sell_price' => 12500,
                'stock' => 50,
                'min_stock_alert' => 10,
                'unit' => 'pack',
                'tiers' => [],
            ],
        ];

        foreach ($productsData as $pData) {
            $tiers = $pData['tiers'];
            unset($pData['tiers']);

            $product = Product::create($pData);

            // Record initial stock mutation
            StockMutation::create([
                'product_id' => $product->id,
                'type' => 'restock',
                'qty_change' => $product->stock,
                'balance_stock' => $product->stock,
                'reference_type' => 'InitialStock',
                'reference_id' => null,
                'notes' => 'Stok awal sistem POS',
            ]);

            // Create tiers
            foreach ($tiers as $tier) {
                ProductPriceTier::create([
                    'product_id' => $product->id,
                    'min_qty' => $tier['min_qty'],
                    'tier_price' => $tier['tier_price'],
                ]);
            }
        }

        // Seed initial stock for second branch on all demo products
        Product::all()->each(function (Product $product) use ($demo, $branchSudirman) {
            OutletStock::where('outlet_id', $branchSudirman->id)
                ->where('product_id', $product->id)
                ->update(['stock' => 25]);
            $product->recalculateTotalStock();
        });

        // 4. Initial Open Shift for Cashier
        Shift::create([
            'user_id' => $cashier->id,
            'opened_at' => now()->subHours(2),
            'closed_at' => null,
            'starting_cash' => 200000, // Modal awal Rp 200.000
            'expected_cash' => 200000,
            'actual_cash' => null,
            'difference' => null,
            'status' => 'open',
            'notes' => 'Shift Pagi Kasir Utama',
        ]);

        // 5. A second, independent store to demonstrate data isolation.
        //    It reuses a barcode from the demo store: uniqueness is per tenant.
        $otherOwner = User::create([
            'name' => 'Pemilik Toko Sebelah',
            'email' => 'owner@tokosebelah.com',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $other = Tenant::create(['name' => 'Toko Sebelah', 'slug' => 'toko-sebelah', 'status' => 'active']);
        $other->users()->attach($otherOwner->id, ['role' => Tenant::ROLE_OWNER]);

        $currentTenant->runAs($other, function () {
            $category = Category::create(['name' => 'Sembako', 'slug' => 'sembako']);

            Product::create([
                'category_id' => $category->id,
                'barcode' => '8991234567011',
                'sku' => 'SBK-001',
                'name' => 'Indomie Goreng (Toko Sebelah)',
                'buy_price' => 2800,
                'sell_price' => 3700,
                'stock' => 40,
                'min_stock_alert' => 10,
                'unit' => 'pcs',
                'is_active' => true,
            ]);
        });

        $currentTenant->set(null);
    }
}
