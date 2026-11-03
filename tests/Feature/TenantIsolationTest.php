<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Sale;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use LogicException;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;
    private Tenant $tenantB;
    private User $ownerA;
    private User $ownerB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();

        [$this->tenantA, $this->ownerA] = $this->makeTenantWithOwner('toko-a');
        [$this->tenantB, $this->ownerB] = $this->makeTenantWithOwner('toko-b');
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/t/toko-a/pos')->assertRedirect('/login');
    }

    public function test_dashboard_redirects_to_the_users_store(): void
    {
        $this->actingAs($this->ownerA)
            ->get('/dashboard')
            ->assertRedirect('/t/toko-a/pos');
    }

    public function test_member_can_open_their_own_store(): void
    {
        $this->actingAs($this->ownerA)
            ->get('/t/toko-a/pos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pos/Index')
                ->where('tenant.slug', 'toko-a')
                ->where('tenant.role', Tenant::ROLE_OWNER));
    }

    public function test_user_cannot_open_a_store_they_do_not_belong_to(): void
    {
        $this->actingAs($this->ownerA)->get('/t/toko-b/pos')->assertNotFound();
        $this->actingAs($this->ownerA)->get('/t/toko-b/reports')->assertNotFound();
    }

    public function test_unknown_store_returns_404(): void
    {
        $this->actingAs($this->ownerA)->get('/t/tidak-ada/pos')->assertNotFound();
    }

    public function test_suspended_store_is_blocked(): void
    {
        $this->tenantA->update(['status' => 'suspended']);

        $this->actingAs($this->ownerA)->get('/t/toko-a/pos')->assertForbidden();
    }

    public function test_pos_only_lists_products_of_the_current_store(): void
    {
        $this->productFor($this->tenantA, ['name' => 'Produk A']);
        $this->productFor($this->tenantB, ['name' => 'Produk B']);

        $this->actingAs($this->ownerA)
            ->get('/t/toko-a/pos')
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 1)
                ->where('products.0.name', 'Produk A'));
    }

    public function test_search_does_not_leak_other_store_products(): void
    {
        $this->productFor($this->tenantB, ['name' => 'Rahasia Toko B']);

        $this->actingAs($this->ownerA)
            ->getJson('/t/toko-a/pos/search?q=Rahasia')
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_cannot_update_another_stores_product_through_own_store_url(): void
    {
        $productB = $this->productFor($this->tenantB);

        $this->actingAs($this->ownerA)
            ->put("/t/toko-a/products/{$productB->id}", $this->productPayload(['name' => 'Dibajak']))
            ->assertNotFound();

        $this->assertSame('Produk Uji', $productB->fresh()->name);
    }

    public function test_cannot_adjust_stock_of_another_stores_product(): void
    {
        $productB = $this->productFor($this->tenantB, ['stock' => 10]);

        $this->actingAs($this->ownerA)
            ->post("/t/toko-a/products/{$productB->id}/adjust-stock", [
                'type' => 'restock', 'qty' => 99, 'notes' => 'x',
            ])
            ->assertNotFound();

        $this->assertSame(10, $productB->fresh()->stock);
    }

    public function test_checkout_rejects_products_from_another_store(): void
    {
        $productB = $this->productFor($this->tenantB, ['stock' => 10]);
        $this->openShiftFor($this->tenantA, $this->ownerA);

        $this->actingAs($this->ownerA)
            ->postJson('/t/toko-a/pos/checkout', [
                'items' => [['product_id' => $productB->id, 'qty' => 1]],
                'payment_type' => 'cash',
                'paid_amount' => 100000,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.product_id');

        $this->assertSame(10, $productB->fresh()->stock);
    }

    public function test_checkout_stamps_sale_with_current_tenant(): void
    {
        $productA = $this->productFor($this->tenantA, ['stock' => 10]);
        $this->openShiftFor($this->tenantA, $this->ownerA);

        $this->actingAs($this->ownerA)
            ->postJson('/t/toko-a/pos/checkout', [
                'items' => [['product_id' => $productA->id, 'qty' => 2]],
                'payment_type' => 'cash',
                'paid_amount' => 100000,
            ])
            ->assertOk();

        $sale = Sale::withoutGlobalScopes()->sole();
        $this->assertSame($this->tenantA->id, $sale->tenant_id);
        $this->assertSame($this->tenantA->id, $sale->items()->withoutGlobalScopes()->first()->tenant_id);
        $this->assertSame($this->tenantA->id, $sale->paymentDetails()->withoutGlobalScopes()->first()->tenant_id);
    }

    public function test_invoice_numbers_are_independent_per_store(): void
    {
        foreach ([[$this->tenantA, $this->ownerA, 'toko-a'], [$this->tenantB, $this->ownerB, 'toko-b']] as [$tenant, $owner, $slug]) {
            $product = $this->productFor($tenant, ['stock' => 10]);
            $this->openShiftFor($tenant, $owner);

            $this->actingAs($owner)->postJson("/t/{$slug}/pos/checkout", [
                'items' => [['product_id' => $product->id, 'qty' => 1]],
                'payment_type' => 'cash',
                'paid_amount' => 100000,
            ])->assertOk();
        }

        $invoices = Sale::withoutGlobalScopes()->pluck('invoice_no')->all();
        $this->assertCount(2, $invoices);
        $this->assertSame($invoices[0], $invoices[1], 'Each store starts its own invoice sequence.');
    }

    public function test_same_barcode_is_allowed_in_different_stores_but_not_within_one(): void
    {
        $this->productFor($this->tenantB, ['barcode' => '8990000000001']);

        $this->actingAs($this->ownerA)
            ->post('/t/toko-a/products', $this->productPayload(['barcode' => '8990000000001']))
            ->assertSessionHasNoErrors();

        $this->actingAs($this->ownerA)
            ->post('/t/toko-a/products', $this->productPayload(['barcode' => '8990000000001', 'sku' => 'LAIN']))
            ->assertSessionHasErrors('barcode');
    }

    public function test_reports_only_aggregate_the_current_store(): void
    {
        $productB = $this->productFor($this->tenantB, ['stock' => 10]);
        $this->openShiftFor($this->tenantB, $this->ownerB);

        $this->actingAs($this->ownerB)->postJson('/t/toko-b/pos/checkout', [
            'items' => [['product_id' => $productB->id, 'qty' => 3]],
            'payment_type' => 'cash',
            'paid_amount' => 100000,
        ])->assertOk();

        $this->actingAs($this->ownerA)
            ->get('/t/toko-a/reports')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('metrics.totalTransactions', 0)
                ->has('paymentBreakdown', 0)
                ->has('topProducts', 0)
                ->has('shiftAudits', 0));
    }

    public function test_held_orders_are_kept_per_store(): void
    {
        $this->tenantB->users()->attach($this->ownerA->id, ['role' => Tenant::ROLE_CASHIER]);

        $this->actingAs($this->ownerA)
            ->postJson('/t/toko-a/pos/hold', ['items' => [['product_id' => 1, 'qty' => 1]]])
            ->assertOk();

        $this->actingAs($this->ownerA)
            ->get('/t/toko-b/pos')
            ->assertInertia(fn (Assert $page) => $page->has('heldOrders', 0));
    }

    public function test_tenant_models_cannot_be_created_without_a_tenant_context(): void
    {
        $this->expectException(LogicException::class);

        Product::create($this->productPayload());
    }

    public function test_registration_creates_a_store_owned_by_the_new_user(): void
    {
        $this->post('/register', [
            'name' => 'Sari',
            'store_name' => 'Warung Sari',
            'email' => 'sari@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect('/dashboard');

        $user = User::where('email', 'sari@example.com')->sole();
        $tenant = Tenant::where('slug', 'warung-sari')->sole();

        $this->assertSame(Tenant::ROLE_OWNER, $user->roleIn($tenant));
    }

    /**
     * @return array{0: Tenant, 1: User}
     */
    private function makeTenantWithOwner(string $slug): array
    {
        $tenant = Tenant::factory()->create(['slug' => $slug, 'name' => strtoupper($slug)]);
        $owner = User::factory()->create(['role' => 'admin']);
        $tenant->users()->attach($owner->id, ['role' => Tenant::ROLE_OWNER]);

        return [$tenant, $owner];
    }

    private function productFor(Tenant $tenant, array $overrides = []): Product
    {
        return app(CurrentTenant::class)->runAs(
            $tenant,
            fn () => Product::create($this->productPayload($overrides)),
        );
    }

    private function openShiftFor(Tenant $tenant, User $user): Shift
    {
        return app(CurrentTenant::class)->runAs($tenant, fn () => Shift::create([
            'user_id' => $user->id,
            'opened_at' => now(),
            'starting_cash' => 0,
            'expected_cash' => 0,
            'status' => 'open',
        ]));
    }

    private function productPayload(array $overrides = []): array
    {
        return array_merge([
            'barcode' => (string) fake()->unique()->numerify('899#########'),
            'sku' => null,
            'name' => 'Produk Uji',
            'buy_price' => 1000,
            'sell_price' => 1500,
            'stock' => 5,
            'min_stock_alert' => 1,
            'unit' => 'pcs',
            'is_active' => true,
        ], $overrides);
    }
}
