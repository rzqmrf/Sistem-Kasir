<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'is_super_admin' => 'boolean',
        ];
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class, 'cashier_id');
    }

    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    public function belongsToTenant(Tenant $tenant): bool
    {
        return $this->tenants()->whereKey($tenant->id)->exists();
    }

    public function roleIn(Tenant $tenant): ?string
    {
        return $this->tenants()->whereKey($tenant->id)->first()?->pivot->role;
    }

    /**
     * Tenant to land on after login: the last one used in this session, else the first membership.
     */
    public function defaultTenant(?int $preferredTenantId = null): ?Tenant
    {
        if ($preferredTenantId) {
            $preferred = $this->tenants()
                ->where('tenants.status', 'active')
                ->whereKey($preferredTenantId)
                ->first();

            if ($preferred) {
                return $preferred;
            }
        }

        return $this->tenants()->where('tenants.status', 'active')->orderBy('tenants.id')->first()
            ?? $this->tenants()->orderBy('tenants.id')->first();
    }

    public function isSuperAdmin(): bool
    {
        return (bool) $this->is_super_admin;
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isCashier(): bool
    {
        return $this->role === 'cashier';
    }
}
