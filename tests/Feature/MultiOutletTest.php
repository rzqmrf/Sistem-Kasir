<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\Shift;
use App\Models\StockMutation;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MultiOutletTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $owner;
    private User $cashier;
    private Outlet $mainOutlet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();

        $this->tenant = Tenant::factory()->create(['slug' => 'toko-cabang', 'name' => 'Toko Cabang']);
        $this->owner = User::factory()->create(['role' => 'admin']);
        $this->cashier = User::factory()->create(['role' => 'cashier']);

        $this->tenant->users()->attach($this->owner->id, ['role' => Tenant::ROLE_OWNER]);
        $this->tenant->users()->attach($this->cashier->id, ['role' => Tenant::ROLE_CASHIER]);

        $this->mainOutlet = $this->tenant->ensureMainOutlet();
    }

    public function test_pos_automatically_resolves_main_outlet_in_shared_props(): void
    {
        $this->actingAs($this->owner)
            ->get('/t/toko-cabang/pos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('outlet.id', $this->mainOutlet->id)
                ->where('outlet.code', 'PUSAT')
                ->where('outlet.is_main', true)
                ->has('outlets', 1));
    }

    public function test_owner_can_create_branch_switch_outlet_and_main_outlet_cannot_be_deactivated(): void
    {
        $product = $this->createProductIn($this->mainOutlet, ['stock' => 30]);

        $this->actingAs($this->owner)
            ->post('/t/toko-cabang/outlets', [
                'name' => 'Cabang Selatan',
                'code' => 'slt-01',
                'address' => 'Jl. Fatmawati No. 10',
                'phone' => '0811111111',
            ])
            ->assertSessionHasNoErrors();

        $south = Outlet::withoutGlobalScopes()
            ->where('tenant_id', $this->tenant->id)
            ->where('code', 'SLT-01')
            ->sole();

        $this->assertSame(0, $product->stockInOutlet($south->id));
        $this->assertSame(30, $product->stockInOutlet($this->mainOutlet->id));

        // Cashier can switch active outlet, but cannot open outlets management screen
        $this->actingAs($this->cashier)
            ->post('/t/toko-cabang/outlets/switch', ['outlet_id' => $south->id])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->cashier)
            ->get('/t/toko-cabang/pos')
            ->assertInertia(fn (Assert $page) => $page
                ->where('outlet.id', $south->id)
                ->where('products.0.stock', 0));

        $this->actingAs($this->cashier)->get('/t/toko-cabang/outlets')->assertForbidden();

        // Main outlet cannot be deactivated
        $this->actingAs($this->owner)
            ->put("/t/toko-cabang/outlets/{$this->mainOutlet->id}", [
                'name' => 'Cabang Pusat',
                'code' => 'PUSAT',
                'is_active' => false,
            ])
            ->assertSessionHasErrors('is_active');
    }

    public function test_stock_transfer_shifts_and_sales_are_isolated_per_outlet(): void
    {
        $product = $this->createProductIn($this->mainOutlet, ['stock' => 20, 'sell_price' => 5000, 'buy_price' => 3500]);

        $south = app(CurrentTenant::class)->runAs($this->tenant, fn () => Outlet::create([
            'name' => 'Cabang Selatan',
            'code' => 'SLT',
            'is_main' => false,
            'is_active' => true,
        ]));

        // Transfer 8 units from Main to South
        $this->actingAs($this->owner)
            ->post('/t/toko-cabang/outlets/transfer-stock', [
                'from_outlet_id' => $this->mainOutlet->id,
                'to_outlet_id' => $south->id,
                'product_id' => $product->id,
                'qty' => 8,
                'notes' => 'Stok awal cabang',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(12, $product->stockInOutlet($this->mainOutlet->id));
        $this->assertSame(8, $product->stockInOutlet($south->id));
        $this->assertSame(20, $product->fresh()->stock);
        $this->assertSame(2, StockMutation::withoutGlobalScopes()->where('product_id', $product->id)->count());

        // Open shift ONLY in Main Outlet
        app(CurrentTenant::class)->runAs($this->tenant, fn () => Shift::create([
            'outlet_id' => $this->mainOutlet->id,
            'user_id' => $this->cashier->id,
            'opened_at' => now(),
            'starting_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
        ]), $this->mainOutlet);

        // Switch cashier to South Outlet: checkout must fail until South shift is opened
        $this->actingAs($this->cashier)
            ->post('/t/toko-cabang/outlets/switch', ['outlet_id' => $south->id]);

        $this->actingAs($this->cashier)
            ->postJson('/t/toko-cabang/pos/checkout', [
                'items' => [['product_id' => $product->id, 'qty' => 3]],
                'payment_type' => 'cash',
                'paid_amount' => 20000,
            ])
            ->assertStatus(422);

        // Open shift in South Outlet, then checkout 3 units
        $this->actingAs($this->cashier)
            ->post('/t/toko-cabang/shifts/open', ['starting_cash' => 50000])
            ->assertRedirect();

        $this->actingAs($this->cashier)
            ->postJson('/t/toko-cabang/pos/checkout', [
                'items' => [['product_id' => $product->id, 'qty' => 3]],
                'payment_type' => 'cash',
                'paid_amount' => 20000,
            ])
            ->assertOk();

        $this->assertSame(12, $product->stockInOutlet($this->mainOutlet->id));
        $this->assertSame(5, $product->stockInOutlet($south->id));
        $this->assertSame(17, $product->fresh()->stock);
    }

    public function test_reports_filter_metrics_by_outlet_or_aggregate_all(): void
    {
        $product = $this->createProductIn($this->mainOutlet, ['stock' => 50, 'sell_price' => 10000, 'buy_price' => 7000]);

        $south = app(CurrentTenant::class)->runAs($this->tenant, fn () => Outlet::create([
            'name' => 'Cabang Selatan',
            'code' => 'SLT',
            'is_main' => false,
            'is_active' => true,
        ]));

        // Transfer 20 to South
        $this->actingAs($this->owner)->post('/t/toko-cabang/outlets/transfer-stock', [
            'from_outlet_id' => $this->mainOutlet->id,
            'to_outlet_id' => $south->id,
            'product_id' => $product->id,
            'qty' => 20,
        ]);

        // Sale in Main: 1 qty = 10,000
        $this->actingAs($this->owner)->post('/t/toko-cabang/outlets/switch', ['outlet_id' => $this->mainOutlet->id]);
        $this->actingAs($this->owner)->post('/t/toko-cabang/shifts/open', ['starting_cash' => 0]);
        $this->actingAs($this->owner)->postJson('/t/toko-cabang/pos/checkout', [
            'items' => [['product_id' => $product->id, 'qty' => 1]],
            'payment_type' => 'cash',
            'paid_amount' => 10000,
        ])->assertOk();

        // Sale in South: 3 qty = 30,000
        $this->actingAs($this->owner)->post('/t/toko-cabang/outlets/switch', ['outlet_id' => $south->id]);
        $this->actingAs($this->owner)->post('/t/toko-cabang/shifts/open', ['starting_cash' => 0]);
        $this->actingAs($this->owner)->postJson('/t/toko-cabang/pos/checkout', [
            'items' => [['product_id' => $product->id, 'qty' => 3]],
            'payment_type' => 'qris',
            'paid_amount' => 30000,
        ])->assertOk();

        // All outlets combined = 40,000 (2 transactions)
        $this->actingAs($this->owner)
            ->get('/t/toko-cabang/reports')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('metrics.totalTransactions', 2)
                ->where('metrics.totalRevenue', 40000));

        // Filtered to Main = 10,000 (1 transaction)
        $this->actingAs($this->owner)
            ->get("/t/toko-cabang/reports?outlet_id={$this->mainOutlet->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('metrics.totalTransactions', 1)
                ->where('metrics.totalRevenue', 10000));

        // Filtered to South = 30,000 (1 transaction)
        $this->actingAs($this->owner)
            ->get("/t/toko-cabang/reports?outlet_id={$south->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('metrics.totalTransactions', 1)
                ->where('metrics.totalRevenue', 30000));
    }

    public function test_cannot_switch_to_another_tenants_outlet(): void
    {
        $otherTenant = Tenant::factory()->create(['slug' => 'toko-lain']);
        $otherOutlet = $otherTenant->ensureMainOutlet();

        $this->actingAs($this->owner)
            ->post('/t/toko-cabang/outlets/switch', ['outlet_id' => $otherOutlet->id])
            ->assertSessionHasErrors('outlet_id');
    }

    private function createProductIn(Outlet $outlet, array $overrides = []): Product
    {
        return app(CurrentTenant::class)->runAs(
            $this->tenant,
            fn () => Product::create(array_merge([
                'barcode' => (string) fake()->unique()->numerify('899#########'),
                'sku' => null,
                'name' => 'Produk Cabang',
                'buy_price' => 2000,
                'sell_price' => 3000,
                'stock' => 10,
                'min_stock_alert' => 2,
                'unit' => 'pcs',
                'is_active' => true,
            ], $overrides)),
            $outlet,
        );
    }
}
