<?php

namespace App\Actions;

use App\Models\Category;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateTenantForOwner
{
    private const DEFAULT_CATEGORIES = [
        ['name' => 'Makanan & Minuman', 'slug' => 'makanan-minuman'],
        ['name' => 'Kebutuhan Dapur', 'slug' => 'kebutuhan-dapur'],
        ['name' => 'Perawatan & Kebersihan', 'slug' => 'perawatan-kebersihan'],
        ['name' => 'Snack & Biskuit', 'slug' => 'snack-biskuit'],
    ];

    public function __construct(private CurrentTenant $currentTenant) {}

    public function handle(User $owner, string $storeName): Tenant
    {
        return DB::transaction(function () use ($owner, $storeName) {
            $tenant = Tenant::create([
                'name' => $storeName,
                'slug' => $this->uniqueSlug($storeName),
                'status' => 'active',
            ]);

            $tenant->users()->attach($owner->id, ['role' => Tenant::ROLE_OWNER]);
            $mainOutlet = $tenant->ensureMainOutlet();
            $tenant->currentSubscription();

            $this->currentTenant->runAs($tenant, function () {
                foreach (self::DEFAULT_CATEGORIES as $category) {
                    Category::create($category);
                }
            }, $mainOutlet);

            return $tenant;
        });
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'toko';
        $slug = $base;
        $i = 2;

        while (Tenant::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
