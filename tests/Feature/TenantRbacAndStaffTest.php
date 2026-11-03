<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TenantRbacAndStaffTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $owner;
    private User $manager;
    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();

        $this->tenant = Tenant::factory()->create(['slug' => 'toko-utama', 'name' => 'Toko Utama']);
        $this->owner = User::factory()->create(['role' => 'admin']);
        $this->manager = User::factory()->create(['role' => 'admin']);
        $this->cashier = User::factory()->create(['role' => 'cashier']);

        $this->tenant->users()->attach($this->owner->id, ['role' => Tenant::ROLE_OWNER]);
        $this->tenant->users()->attach($this->manager->id, ['role' => Tenant::ROLE_MANAGER]);
        $this->tenant->users()->attach($this->cashier->id, ['role' => Tenant::ROLE_CASHIER]);
    }

    public function test_creating_additional_store_seeds_default_categories_and_redirects_to_pos(): void
    {
        $this->actingAs($this->owner)
            ->post('/stores', ['name' => 'Cabang Melati'])
            ->assertRedirect('/t/cabang-melati/pos');

        $newStore = Tenant::where('slug', 'cabang-melati')->sole();

        $this->assertSame(Tenant::ROLE_OWNER, $this->owner->roleIn($newStore));
        $this->assertSame(
            4,
            Category::withoutGlobalScopes()->where('tenant_id', $newStore->id)->count(),
        );
    }

    public function test_cashier_can_use_pos_and_shifts_but_is_forbidden_from_management_routes(): void
    {
        $this->actingAs($this->cashier)
            ->get('/t/toko-utama/pos')
            ->assertOk();

        $this->actingAs($this->cashier)
            ->post('/t/toko-utama/shifts/open', ['starting_cash' => 150000])
            ->assertRedirect();

        $this->actingAs($this->cashier)->get('/t/toko-utama/products')->assertForbidden();
        $this->actingAs($this->cashier)->post('/t/toko-utama/products', [])->assertForbidden();
        $this->actingAs($this->cashier)->get('/t/toko-utama/reports')->assertForbidden();
        $this->actingAs($this->cashier)->get('/t/toko-utama/staff')->assertForbidden();
        $this->actingAs($this->cashier)->post('/t/toko-utama/staff', [])->assertForbidden();
    }

    public function test_manager_can_access_management_pages_and_manage_cashiers_only(): void
    {
        $this->actingAs($this->manager)->get('/t/toko-utama/products')->assertOk();
        $this->actingAs($this->manager)->get('/t/toko-utama/reports')->assertOk();
        $this->actingAs($this->manager)
            ->get('/t/toko-utama/staff')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Staff/Index')
                ->where('canManageManagers', false)
                ->has('members', 3));

        // Manager can add a cashier
        $this->actingAs($this->manager)
            ->post('/t/toko-utama/staff', [
                'name' => 'Kasir Baru',
                'email' => 'kasir.baru@example.com',
                'password' => 'password123',
                'role' => Tenant::ROLE_CASHIER,
            ])
            ->assertSessionHasNoErrors();

        $newCashier = User::where('email', 'kasir.baru@example.com')->sole();
        $this->assertSame(Tenant::ROLE_CASHIER, $newCashier->roleIn($this->tenant));

        // Manager cannot add a manager
        $this->actingAs($this->manager)
            ->post('/t/toko-utama/staff', [
                'name' => 'Manajer Ilegal',
                'email' => 'mgr@example.com',
                'password' => 'password123',
                'role' => Tenant::ROLE_MANAGER,
            ])
            ->assertForbidden();

        // Manager cannot change roles
        $this->actingAs($this->manager)
            ->patch("/t/toko-utama/staff/{$newCashier->id}", ['role' => Tenant::ROLE_MANAGER])
            ->assertForbidden();

        // Manager cannot remove owner
        $this->actingAs($this->manager)
            ->delete("/t/toko-utama/staff/{$this->owner->id}")
            ->assertForbidden();

        // Manager can remove cashier
        $this->actingAs($this->manager)
            ->delete("/t/toko-utama/staff/{$newCashier->id}")
            ->assertRedirect();

        $this->assertFalse($newCashier->belongsToTenant($this->tenant));
    }

    public function test_owner_can_attach_existing_user_promote_to_manager_and_cannot_remove_self(): void
    {
        $existingUser = User::factory()->create(['email' => 'lintas@example.com']);

        // Existing user needs no password to be attached to this store
        $this->actingAs($this->owner)
            ->post('/t/toko-utama/staff', [
                'email' => 'lintas@example.com',
                'role' => Tenant::ROLE_CASHIER,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(Tenant::ROLE_CASHIER, $existingUser->roleIn($this->tenant));

        // Owner promotes cashier to manager
        $this->actingAs($this->owner)
            ->patch("/t/toko-utama/staff/{$existingUser->id}", ['role' => Tenant::ROLE_MANAGER])
            ->assertSessionHasNoErrors();

        $this->assertSame(Tenant::ROLE_MANAGER, $existingUser->fresh()->roleIn($this->tenant));

        // Owner cannot remove self
        $this->actingAs($this->owner)
            ->delete("/t/toko-utama/staff/{$this->owner->id}")
            ->assertForbidden();

        // Non-member returns 404
        $outsider = User::factory()->create();
        $this->actingAs($this->owner)
            ->patch("/t/toko-utama/staff/{$outsider->id}", ['role' => Tenant::ROLE_CASHIER])
            ->assertNotFound();
    }

    public function test_shared_inertia_props_list_only_active_stores_for_switcher(): void
    {
        $second = Tenant::factory()->create(['slug' => 'cabang-dua', 'name' => 'Cabang Dua']);
        $suspended = Tenant::factory()->suspended()->create(['slug' => 'nonaktif', 'name' => 'Nonaktif']);

        $second->users()->attach($this->owner->id, ['role' => Tenant::ROLE_MANAGER]);
        $suspended->users()->attach($this->owner->id, ['role' => Tenant::ROLE_OWNER]);

        $this->actingAs($this->owner)
            ->get('/t/toko-utama/pos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('tenants', 2));
    }
}
