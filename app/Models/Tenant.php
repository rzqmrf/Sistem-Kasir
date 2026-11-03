<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    use HasFactory;

    public const ROLE_OWNER = 'owner';
    public const ROLE_MANAGER = 'manager';
    public const ROLE_CASHIER = 'cashier';

    protected $fillable = [
        'name',
        'slug',
        'status',
    ];

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    public function outlets(): HasMany
    {
        return $this->hasMany(Outlet::class);
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    /**
     * Every store has exactly one subscription. Stores created before billing existed
     * (or by factories in tests) get a trial on first access instead of being blocked.
     */
    public function currentSubscription(): Subscription
    {
        $subscription = $this->subscription()->with('plan')->first();

        if ($subscription) {
            return $subscription;
        }

        $subscription = Subscription::create([
            'tenant_id' => $this->id,
            'plan_id' => Plan::byCode(Plan::TRIAL_PLAN)->id,
            'status' => Subscription::TRIALING,
            'trial_ends_at' => now()->addDays(Plan::TRIAL_DAYS),
            'current_period_start' => now(),
            'current_period_end' => now()->addDays(Plan::TRIAL_DAYS),
        ]);

        $this->setRelation('subscription', $subscription);

        return $subscription->load('plan');
    }

    public function ensureMainOutlet(): Outlet
    {
        $existing = Outlet::withoutGlobalScopes()
            ->where('tenant_id', $this->id)
            ->orderByDesc('is_main')
            ->orderBy('id')
            ->first();

        if ($existing) {
            return $existing;
        }

        $outlet = new Outlet([
            'name' => 'Cabang Pusat',
            'code' => 'PUSAT',
            'is_main' => true,
            'is_active' => true,
        ]);
        $outlet->tenant_id = $this->id;
        $outlet->save();

        return $outlet;
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
