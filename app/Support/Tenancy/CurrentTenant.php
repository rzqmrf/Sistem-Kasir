<?php

namespace App\Support\Tenancy;

use App\Models\Outlet;
use App\Models\Tenant;
use RuntimeException;

/**
 * Holds the tenant and active outlet for the current request (or console run).
 * Registered as a scoped singleton, so it resets between requests/jobs.
 */
class CurrentTenant
{
    private ?Tenant $tenant = null;
    private ?Outlet $outlet = null;

    public function set(?Tenant $tenant): void
    {
        if ($this->tenant?->id !== $tenant?->id) {
            $this->outlet = null;
        }

        $this->tenant = $tenant;
    }

    public function get(): ?Tenant
    {
        return $this->tenant;
    }

    public function id(): ?int
    {
        return $this->tenant?->id;
    }

    public function has(): bool
    {
        return $this->tenant !== null;
    }

    public function getOrFail(): Tenant
    {
        return $this->tenant ?? throw new RuntimeException('No tenant is set for the current context.');
    }

    public function setOutlet(?Outlet $outlet): void
    {
        $this->outlet = $outlet;
    }

    public function outlet(): ?Outlet
    {
        return $this->outlet;
    }

    public function outletId(): ?int
    {
        return $this->outlet?->id;
    }

    public function outletOrFail(): Outlet
    {
        if ($this->outlet) {
            return $this->outlet;
        }

        $tenant = $this->getOrFail();
        $this->outlet = $tenant->ensureMainOutlet();

        return $this->outlet;
    }

    /**
     * Run a callback as the given tenant (and optional outlet), restoring previous context afterwards.
     */
    public function runAs(Tenant $tenant, callable $callback, ?Outlet $outlet = null): mixed
    {
        $previousTenant = $this->tenant;
        $previousOutlet = $this->outlet;

        $this->tenant = $tenant;
        $this->outlet = $outlet;

        try {
            return $callback($tenant);
        } finally {
            $this->tenant = $previousTenant;
            $this->outlet = $previousOutlet;
        }
    }
}
