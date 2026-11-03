<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Outlet;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SubscriptionAndBillingTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $owner;
    private User $manager;
    private User $cashier;
    private Outlet $mainOutlet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();

        // Ensure local simulator mode by default regardless of developer .env
        config([
            'services.midtrans.server_key' => null,
            'services.midtrans.client_key' => null,
            'services.midtrans.is_production' => false,
        ]);

        $this->tenant = Tenant::factory()->create([
            'name' => 'Toko Langganan',
            'slug' => 'toko-langganan',
        ]);

        $this->owner = User::factory()->create(['role' => 'admin']);
        $this->manager = User::factory()->create(['role' => 'admin']);
        $this->cashier = User::factory()->create(['role' => 'cashier']);

        $this->tenant->users()->attach($this->owner->id, ['role' => Tenant::ROLE_OWNER]);
        $this->tenant->users()->attach($this->manager->id, ['role' => Tenant::ROLE_MANAGER]);
        $this->tenant->users()->attach($this->cashier->id, ['role' => Tenant::ROLE_CASHIER]);

        $this->mainOutlet = $this->tenant->ensureMainOutlet();
        $this->tenant->currentSubscription();
    }

    public function test_new_store_starts_with_14_day_pro_trial(): void
    {
        $this->actingAs($this->owner)
            ->post('/stores', ['name' => 'Cabang Baru Retail'])
            ->assertRedirect('/t/cabang-baru-retail/pos');

        $newTenant = Tenant::where('slug', 'cabang-baru-retail')->sole();
        $sub = $newTenant->subscription()->with('plan')->first();

        $this->assertNotNull($sub);
        $this->assertSame(Plan::PRO, $sub->plan->code);
        $this->assertSame(Subscription::TRIALING, $sub->status);
        $this->assertGreaterThanOrEqual(13, $sub->daysLeft());

        $this->actingAs($this->owner)
            ->get('/t/cabang-baru-retail/billing')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Billing/Index')
                ->where('currentSubscription.plan.code', Plan::PRO)
                ->where('currentSubscription.status', 'trialing')
                ->where('subscription.plan_code', Plan::PRO)
                ->where('subscription.is_expired', false));
    }

    public function test_only_owner_can_access_billing_and_invoices_are_tenant_isolated(): void
    {
        $this->actingAs($this->manager)->get('/t/toko-langganan/billing')->assertForbidden();
        $this->actingAs($this->cashier)->get('/t/toko-langganan/billing')->assertForbidden();
        $this->actingAs($this->manager)
            ->post('/t/toko-langganan/billing/checkout', ['plan_code' => Plan::PRO, 'period_months' => 1])
            ->assertForbidden();

        // Create an invoice in another tenant and verify our owner gets 404 trying to settle it
        $otherTenant = Tenant::factory()->create(['slug' => 'toko-sebelah']);
        $otherInvoice = new Invoice([
            'plan_id' => Plan::byCode(Plan::PRO)->id,
            'number' => 'QR-OTHER-0001',
            'period_months' => 1,
            'amount' => 149000,
            'status' => Invoice::PENDING,
            'expires_at' => now()->addDay(),
        ]);
        $otherInvoice->tenant_id = $otherTenant->id;
        $otherInvoice->save();

        $this->actingAs($this->owner)
            ->post("/t/toko-langganan/billing/invoices/{$otherInvoice->id}/simulate")
            ->assertNotFound();
    }

    public function test_plan_quota_limits_enforce_outlets_staff_products_and_outlet_reactivation(): void
    {
        // Remove manager first so tenant fits Starter (2 users: owner + cashier, 1 outlet)
        $this->tenant->users()->detach($this->manager->id);

        Plan::where('code', Plan::STARTER)->update(['max_products' => 2]);

        $this->actingAs($this->owner)
            ->post('/t/toko-langganan/billing/checkout', [
                'plan_code' => Plan::STARTER,
                'period_months' => 1,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(Plan::STARTER, $this->tenant->currentSubscription()->plan->code);

        // 1. Adding a 2nd active outlet is blocked (max_outlets = 1)
        $this->actingAs($this->owner)
            ->from('/t/toko-langganan/outlets')
            ->post('/t/toko-langganan/outlets', [
                'name' => 'Cabang Kedua',
                'code' => 'CBG-02',
            ])
            ->assertRedirect('/t/toko-langganan/outlets')
            ->assertSessionHasErrors('plan');

        // Reactivating an inactive 2nd outlet is also blocked
        $inactiveOutlet = new Outlet([
            'name' => 'Cabang Lama Nonaktif',
            'code' => 'LAMA-02',
            'is_main' => false,
            'is_active' => false,
        ]);
        $inactiveOutlet->tenant_id = $this->tenant->id;
        $inactiveOutlet->save();

        $this->actingAs($this->owner)
            ->from('/t/toko-langganan/outlets')
            ->put("/t/toko-langganan/outlets/{$inactiveOutlet->id}", [
                'name' => 'Cabang Lama Nonaktif',
                'code' => 'LAMA-02',
                'is_active' => true,
            ])
            ->assertRedirect('/t/toko-langganan/outlets')
            ->assertSessionHasErrors('plan');

        // 2. Adding a 3rd staff member is blocked (max_users = 2)
        $this->actingAs($this->owner)
            ->from('/t/toko-langganan/staff')
            ->post('/t/toko-langganan/staff', [
                'name' => 'Kasir Tiga',
                'email' => 'kasir3@example.com',
                'password' => 'password123',
                'role' => 'cashier',
            ])
            ->assertRedirect('/t/toko-langganan/staff')
            ->assertSessionHasErrors('plan');

        // 3. Adding products beyond max_products (2) is blocked
        for ($i = 1; $i <= 2; $i++) {
            $this->actingAs($this->owner)
                ->post('/t/toko-langganan/products', [
                    'barcode' => "89900000000{$i}",
                    'name' => "Produk {$i}",
                    'buy_price' => 5000,
                    'sell_price' => 7000,
                    'stock' => 10,
                    'min_stock_alert' => 2,
                    'unit' => 'pcs',
                ])
                ->assertSessionHasNoErrors();
        }

        $this->actingAs($this->owner)
            ->from('/t/toko-langganan/products')
            ->post('/t/toko-langganan/products', [
                'barcode' => '899000000003',
                'name' => 'Produk Kelebihan Kuota',
                'buy_price' => 5000,
                'sell_price' => 7000,
                'stock' => 10,
                'min_stock_alert' => 2,
                'unit' => 'pcs',
            ])
            ->assertRedirect('/t/toko-langganan/products')
            ->assertSessionHasErrors('plan');
    }

    public function test_expired_subscription_enforces_read_only_mode_while_allowing_billing_and_downsizing(): void
    {
        // Create a second active branch while trial is still active (now: 2 outlets, 3 users)
        $branchTwo = new Outlet([
            'name' => 'Cabang Dua',
            'code' => 'CBG-02',
            'is_main' => false,
            'is_active' => true,
        ]);
        $branchTwo->tenant_id = $this->tenant->id;
        $branchTwo->save();

        // Expire the trial
        $this->tenant->currentSubscription()->update([
            'status' => Subscription::TRIALING,
            'trial_ends_at' => now()->subDay(),
            'current_period_end' => now()->subDay(),
        ]);

        // Safe GET requests still succeed and surface expired status
        $this->actingAs($this->owner)
            ->get('/t/toko-langganan/pos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('subscription.status', 'expired')
                ->where('subscription.is_expired', true));

        // JSON write (POS checkout) is refused with 402 Payment Required
        $this->actingAs($this->cashier)
            ->postJson('/t/toko-langganan/pos/checkout', [])
            ->assertStatus(402);

        // Form write (creating product) is refused and flashes error
        $this->actingAs($this->owner)
            ->from('/t/toko-langganan/products')
            ->post('/t/toko-langganan/products', [
                'barcode' => '899111222333',
                'name' => 'Produk Saat Expired',
                'buy_price' => 1000,
                'sell_price' => 2000,
                'stock' => 5,
                'min_stock_alert' => 1,
                'unit' => 'pcs',
            ])
            ->assertRedirect('/t/toko-langganan/products')
            ->assertSessionHas('error');

        // Downgrading directly to Starter fails while over quota (2 outlets, 3 users)
        $this->actingAs($this->owner)
            ->from('/t/toko-langganan/billing')
            ->post('/t/toko-langganan/billing/checkout', [
                'plan_code' => Plan::STARTER,
                'period_months' => 1,
            ])
            ->assertRedirect('/t/toko-langganan/billing')
            ->assertSessionHasErrors('plan');

        // Downsizing (deactivating extra branch + removing extra staff) IS permitted while expired
        $this->actingAs($this->owner)
            ->put("/t/toko-langganan/outlets/{$branchTwo->id}", [
                'name' => 'Cabang Dua',
                'code' => 'CBG-02',
                'is_active' => false,
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->owner)
            ->delete("/t/toko-langganan/staff/{$this->manager->id}")
            ->assertSessionHasNoErrors();

        // Now switching to Starter succeeds and restores write access
        $this->actingAs($this->owner)
            ->post('/t/toko-langganan/billing/checkout', [
                'plan_code' => Plan::STARTER,
                'period_months' => 1,
            ])
            ->assertSessionHasNoErrors();

        $this->assertFalse($this->tenant->fresh()->currentSubscription()->isExpired());

        $this->actingAs($this->owner)
            ->post('/t/toko-langganan/products', [
                'barcode' => '899111222333',
                'name' => 'Produk Setelah Aktif Starter',
                'buy_price' => 1000,
                'sell_price' => 2000,
                'stock' => 5,
                'min_stock_alert' => 1,
                'unit' => 'pcs',
            ])
            ->assertSessionHasNoErrors();
    }

    public function test_simulator_checkout_activates_plan_and_early_renewal_extends_period(): void
    {
        $this->actingAs($this->owner)
            ->post('/t/toko-langganan/billing/checkout', [
                'plan_code' => Plan::PRO,
                'period_months' => 1,
            ])
            ->assertSessionHas('pay_invoice_id');

        $invoice = Invoice::withoutGlobalScopes()->where('tenant_id', $this->tenant->id)->sole();
        $this->assertSame(149000, $invoice->amount);
        $this->assertSame(Invoice::PENDING, $invoice->status);

        // Repeating identical checkout reuses the pending invoice instead of creating duplicates
        $this->actingAs($this->owner)
            ->post('/t/toko-langganan/billing/checkout', [
                'plan_code' => Plan::PRO,
                'period_months' => 1,
            ]);
        $this->assertSame(1, Invoice::withoutGlobalScopes()->where('tenant_id', $this->tenant->id)->count());

        // Settle via simulator
        $this->actingAs($this->owner)
            ->post("/t/toko-langganan/billing/invoices/{$invoice->id}/simulate")
            ->assertSessionHas('success');

        $sub = $this->tenant->fresh()->currentSubscription();
        $this->assertSame(Subscription::ACTIVE, $sub->status);
        $this->assertSame(Plan::PRO, $sub->plan->code);
        $firstPeriodEnd = $sub->current_period_end->copy();
        $this->assertTrue($firstPeriodEnd->greaterThan(now()->addDays(27)));

        // Renew for 12 months (10x monthly price = 1,490,000) and verify it extends from $firstPeriodEnd
        $this->actingAs($this->owner)
            ->post('/t/toko-langganan/billing/checkout', [
                'plan_code' => Plan::PRO,
                'period_months' => 12,
            ]);

        $annualInvoice = Invoice::withoutGlobalScopes()
            ->where('tenant_id', $this->tenant->id)
            ->where('period_months', 12)
            ->sole();

        $this->assertSame(1490000, $annualInvoice->amount);

        $this->actingAs($this->owner)
            ->post("/t/toko-langganan/billing/invoices/{$annualInvoice->id}/simulate")
            ->assertSessionHas('success');

        $renewedEnd = $this->tenant->fresh()->currentSubscription()->current_period_end;
        $this->assertEqualsWithDelta(
            $firstPeriodEnd->copy()->addMonths(12)->timestamp,
            $renewedEnd->timestamp,
            5
        );
    }

    public function test_paid_subscription_grants_three_day_grace_period_before_expiring(): void
    {
        $sub = $this->tenant->currentSubscription();
        $sub->update([
            'status' => Subscription::ACTIVE,
            'trial_ends_at' => null,
            'current_period_start' => now()->subMonth(),
            'current_period_end' => now()->subDays(2),
        ]);

        $sub->refresh();
        $this->assertSame('past_due', $sub->displayStatus());
        $this->assertFalse($sub->isExpired());

        // Past the 3-day grace window -> expired
        $sub->update(['current_period_end' => now()->subDays(4)]);
        $sub->refresh();
        $this->assertSame('expired', $sub->displayStatus());
        $this->assertTrue($sub->isExpired());
    }

    public function test_midtrans_snap_and_webhook_signature_flow(): void
    {
        $serverKey = 'SB-Mid-server-secret-key';
        config([
            'services.midtrans.server_key' => $serverKey,
            'services.midtrans.client_key' => 'SB-Mid-client-public-key',
            'services.midtrans.is_production' => false,
        ]);

        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'token' => 'snap-token-xyz-123',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-xyz-123',
            ], 201),
        ]);

        $this->actingAs($this->owner)
            ->post('/t/toko-langganan/billing/checkout', [
                'plan_code' => Plan::BUSINESS,
                'period_months' => 1,
            ])
            ->assertSessionHasNoErrors();

        $invoice = Invoice::withoutGlobalScopes()->where('tenant_id', $this->tenant->id)->sole();
        $this->assertSame('snap-token-xyz-123', $invoice->snap_token);
        $this->assertSame(399000, $invoice->amount);

        // Simulator endpoint is disabled when real Midtrans keys are configured
        $this->actingAs($this->owner)
            ->post("/t/toko-langganan/billing/invoices/{$invoice->id}/simulate")
            ->assertNotFound();

        // 1. Forged webhook signature is rejected with 403
        $this->postJson('/webhooks/midtrans', [
            'order_id' => $invoice->number,
            'status_code' => '200',
            'gross_amount' => '399000.00',
            'transaction_status' => 'settlement',
            'signature_key' => 'forged-signature',
        ])->assertForbidden();

        $this->assertSame(Invoice::PENDING, $invoice->fresh()->status);

        // 2. Valid signature with mismatched gross_amount is rejected with 422
        $tamperedAmount = '10000.00';
        $tamperedSig = hash('sha512', $invoice->number.'200'.$tamperedAmount.$serverKey);

        $this->postJson('/webhooks/midtrans', [
            'order_id' => $invoice->number,
            'status_code' => '200',
            'gross_amount' => $tamperedAmount,
            'transaction_status' => 'settlement',
            'signature_key' => $tamperedSig,
        ])->assertStatus(422);

        $this->assertSame(Invoice::PENDING, $invoice->fresh()->status);

        // 3. Authentic settlement webhook activates Business plan
        $grossAmount = '399000.00';
        $validSig = hash('sha512', $invoice->number.'200'.$grossAmount.$serverKey);

        $this->postJson('/webhooks/midtrans', [
            'order_id' => $invoice->number,
            'status_code' => '200',
            'gross_amount' => $grossAmount,
            'transaction_id' => 'mid-trx-998877',
            'payment_type' => 'qris',
            'transaction_status' => 'settlement',
            'fraud_status' => 'accept',
            'signature_key' => $validSig,
        ])->assertOk();

        $invoice->refresh();
        $this->assertSame(Invoice::PAID, $invoice->status);
        $this->assertSame('qris', $invoice->payment_type);
        $this->assertSame('mid-trx-998877', $invoice->gateway_transaction_id);

        $sub = $this->tenant->fresh()->currentSubscription();
        $this->assertSame(Plan::BUSINESS, $sub->plan->code);
        $this->assertSame(Subscription::ACTIVE, $sub->status);

        // 4. Out-of-order / duplicate webhook never reverts a paid invoice
        $expireSig = hash('sha512', $invoice->number.'407'.$grossAmount.$serverKey);
        $this->postJson('/webhooks/midtrans', [
            'order_id' => $invoice->number,
            'status_code' => '407',
            'gross_amount' => $grossAmount,
            'transaction_status' => 'expire',
            'signature_key' => $expireSig,
        ])->assertOk();

        $this->assertSame(Invoice::PAID, $invoice->fresh()->status);
    }
}
