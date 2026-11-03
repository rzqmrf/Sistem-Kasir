<?php

namespace App\Support\Billing;

use App\Exceptions\PlanLimitExceeded;
use App\Models\Outlet;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Tenant;

class PlanLimits
{
    private const LABELS = [
        'outlets' => 'cabang aktif',
        'users' => 'anggota tim',
        'products' => 'produk',
    ];

    /**
     * Current usage per limited resource. Queries bypass the tenant scope on purpose
     * so this also works outside a request (e.g. plan change checks, webhooks).
     *
     * @return array<string, int>
     */
    public function usage(Tenant $tenant): array
    {
        return [
            'outlets' => Outlet::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->count(),
            'users' => $tenant->users()->count(),
            'products' => Product::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->count(),
        ];
    }

    /**
     * @throws PlanLimitExceeded
     */
    public function ensureCanAdd(Tenant $tenant, string $resource, int $adding = 1): void
    {
        $plan = $tenant->currentSubscription()->plan;
        $limit = $plan->limitFor($resource);

        if ($limit === null) {
            return;
        }

        $used = $this->usage($tenant)[$resource];

        if ($used + $adding > $limit) {
            $label = self::LABELS[$resource];

            throw new PlanLimitExceeded(
                "Paket {$plan->name} dibatasi {$limit} {$label} (terpakai {$used}). Upgrade paket di menu Langganan untuk menambah lagi."
            );
        }
    }

    /**
     * Resources whose current usage would not fit into the given plan.
     *
     * @return array<string, array{used: int, limit: int}>
     */
    public function overages(Tenant $tenant, Plan $plan): array
    {
        $over = [];

        foreach ($this->usage($tenant) as $resource => $used) {
            $limit = $plan->limitFor($resource);

            if ($limit !== null && $used > $limit) {
                $over[$resource] = ['used' => $used, 'limit' => $limit];
            }
        }

        return $over;
    }

    public function describeOverages(array $overages): string
    {
        return collect($overages)
            ->map(fn ($o, $resource) => "{$o['used']} ".self::LABELS[$resource]." (maks. {$o['limit']})")
            ->implode(', ');
    }
}
