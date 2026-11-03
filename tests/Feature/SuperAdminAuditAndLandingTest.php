<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Billing\SubscriptionManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SuperAdminAuditAndLandingTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private Tenant $tenantA;
    private User $ownerA;
    private User $cashierA;
    private Tenant $tenantB;
    private User $ownerB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();

        $this->superAdmin = User::factory()->create(['role' => 'admin']);
        $this->superAdmin->forceFill(['is_super_admin' => true])->save();

        $this->tenantA = Tenant::factory()->create(['name' => 'Minimarket Alpha', 'slug' => 'alpha']);
        $this->ownerA = User::factory()->create(['role' => 'admin']);
        $this->cashierA = User::factory()->create(['role' => 'cashier']);
        $this->tenantA->users()->attach($this->ownerA->id, ['role' => Tenant::ROLE_OWNER]);
        $this->tenantA->users()->attach($this->cashierA->id, ['role' => Tenant::ROLE_CASHIER]);
        $this->tenantA->ensureMainOutlet();
        $this->tenantA->currentSubscription();

        $this->tenantB = Tenant::factory()->create(['name' => 'Grosir Beta', 'slug' => 'beta']);
        $this->ownerB = User::factory()->create(['role' => 'admin']);
        $this->tenantB->users()->attach($this->ownerB->id, ['role' => Tenant::ROLE_OWNER]);
        $this->tenantB->ensureMainOutlet();
        $this->tenantB->currentSubscription();
    }

    public function test_super_admin_flag_is_guarded_against_mass_assignment_and_enforced_by_middleware(): void
    {
        $regular = User::create([
            'name' => 'Attacker',
            'email' => 'attacker@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'is_active' => true,
            'is_super_admin' => true,
        ]);

        $this->assertFalse($regular->fresh()->isSuperAdmin());

        $this->actingAs($this->ownerA)->get('/admin')->assertForbidden();
        $this->actingAs($this->ownerA)
            ->patch('/admin/tenants/beta/status', ['status' => 'suspended'])
            ->assertForbidden();

        // Super admin without store membership lands cleanly on /admin via /dashboard
        $this->actingAs($this->superAdmin)
            ->get('/dashboard')
            ->assertRedirect('/admin');
    }

    public function test_super_admin_sees_cross_tenant_mrr_revenue_and_can_suspend_or_reactivate_tenant(): void
    {
        // Settle a paid Pro invoice on Tenant A -> MRR = 149,000, 30d revenue = 149,000
        $proPlan = Plan::byCode(Plan::PRO);
        $invoice = new Invoice([
            'plan_id' => $proPlan->id,
            'number' => 'QR-ADMIN-0001',
            'period_months' => 1,
            'amount' => 149000,
            'status' => Invoice::PENDING,
            'expires_at' => now()->addDay(),
        ]);
        $invoice->tenant_id = $this->tenantA->id;
        $invoice->save();

        app(SubscriptionManager::class)->applyPaidInvoice($invoice);

        $this->actingAs($this->superAdmin)
            ->get('/admin')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Index')
                ->where('metrics.total_tenants', 2)
                ->where('metrics.active_tenants', 2)
                ->where('metrics.suspended_tenants', 0)
                ->where('metrics.mrr', 149000)
                ->where('metrics.revenue_30d', 149000)
                ->has('recentInvoices', 1));

        // Suspend Tenant A -> its MRR stops counting and its owner gets 403 on store routes
        $this->actingAs($this->superAdmin)
            ->patch('/admin/tenants/alpha/status', ['status' => 'suspended'])
            ->assertSessionHasNoErrors();

        $this->assertSame('suspended', $this->tenantA->fresh()->status);

        $this->actingAs($this->ownerA)
            ->get('/t/alpha/pos')
            ->assertForbidden();

        $this->actingAs($this->superAdmin)
            ->get('/admin')
            ->assertInertia(fn (Assert $page) => $page
                ->where('metrics.active_tenants', 1)
                ->where('metrics.suspended_tenants', 1)
                ->where('metrics.mrr', 0));

        // Reactivate Tenant A -> access and MRR return
        $this->actingAs($this->superAdmin)
            ->patch('/admin/tenants/alpha/status', ['status' => 'active'])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->ownerA)
            ->get('/t/alpha/pos')
            ->assertOk();
    }

    public function test_audit_logs_record_product_staff_and_outlet_changes_with_strict_tenant_isolation(): void
    {
        // 1. Product create + price update + stock adjustment on Tenant A
        $this->actingAs($this->ownerA)
            ->post('/t/alpha/products', [
                'barcode' => '899777000111',
                'name' => 'Kopi Bubuk 200g',
                'buy_price' => 12000,
                'sell_price' => 15000,
                'stock' => 20,
                'min_stock_alert' => 5,
                'unit' => 'pack',
            ])
            ->assertSessionHasNoErrors();

        $productA = Product::withoutGlobalScopes()
            ->where('tenant_id', $this->tenantA->id)
            ->sole();

        $this->actingAs($this->ownerA)
            ->put("/t/alpha/products/{$productA->id}", [
                'barcode' => '899777000111',
                'name' => 'Kopi Bubuk 200g',
                'buy_price' => 12500,
                'sell_price' => 16500,
                'min_stock_alert' => 5,
                'unit' => 'pack',
                'is_active' => true,
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->ownerA)
            ->post("/t/alpha/products/{$productA->id}/adjust-stock", [
                'type' => 'restock',
                'qty' => 10,
                'notes' => 'Kiriman gudang',
            ])
            ->assertSessionHasNoErrors();

        // 2. Staff addition on Tenant A
        $this->actingAs($this->ownerA)
            ->post('/t/alpha/staff', [
                'name' => 'Siti Manajer',
                'email' => 'siti@alpha.test',
                'password' => 'password123',
                'role' => 'manager',
            ])
            ->assertSessionHasNoErrors();

        // 3. Separate action on Tenant B
        $this->actingAs($this->ownerB)
            ->post('/t/beta/outlets', [
                'name' => 'Cabang Beta Timur',
                'code' => 'BT-02',
            ])
            ->assertSessionHasNoErrors();

        // Cashier cannot view audit logs
        $this->actingAs($this->cashierA)
            ->get('/t/alpha/audit-logs')
            ->assertForbidden();

        // Owner A sees only Tenant A's 4 logs (never Tenant B's outlet log)
        $this->actingAs($this->ownerA)
            ->get('/t/alpha/audit-logs')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('AuditLogs/Index')
                ->where('logs.total', 4)
                ->has('logs.data', 4));

        // Category filter narrows to staff actions only
        $this->actingAs($this->ownerA)
            ->get('/t/alpha/audit-logs?category=staff')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('logs.total', 1)
                ->where('logs.data.0.action', 'staff.added'));

        // Verify exact before/after price diff recorded on product.updated
        $priceUpdateLog = AuditLog::withoutGlobalScopes()
            ->where('tenant_id', $this->tenantA->id)
            ->where('action', 'product.updated')
            ->sole();

        $this->assertEquals(15000, $priceUpdateLog->changes['sell_price']['before']);
        $this->assertEquals(16500, $priceUpdateLog->changes['sell_price']['after']);
    }
}
