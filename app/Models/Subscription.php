<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    public const TRIALING = 'trialing';
    public const ACTIVE = 'active';

    /** Days after period end during which the store still works normally. */
    public const GRACE_DAYS = 3;

    protected $fillable = [
        'tenant_id',
        'plan_id',
        'status',
        'trial_ends_at',
        'current_period_start',
        'current_period_end',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function onTrial(): bool
    {
        return $this->status === self::TRIALING && $this->current_period_end?->isFuture();
    }

    /**
     * Past the period end but still inside the grace window.
     */
    public function inGracePeriod(): bool
    {
        if (! $this->current_period_end || $this->current_period_end->isFuture()) {
            return false;
        }

        return $this->current_period_end->copy()->addDays(self::GRACE_DAYS)->isFuture();
    }

    /**
     * Expired = writes are blocked until the owner pays or moves to the free plan.
     * A null period end (free plan) never expires.
     */
    public function isExpired(): bool
    {
        if (! $this->current_period_end) {
            return false;
        }

        $graceDays = $this->status === self::TRIALING ? 0 : self::GRACE_DAYS;

        return $this->current_period_end->copy()->addDays($graceDays)->isPast();
    }

    public function daysLeft(): ?int
    {
        if (! $this->current_period_end) {
            return null;
        }

        return max(0, (int) ceil(now()->diffInHours($this->current_period_end, false) / 24));
    }

    public function displayStatus(): string
    {
        return match (true) {
            $this->isExpired() => 'expired',
            $this->inGracePeriod() => 'past_due',
            $this->onTrial() => 'trialing',
            default => 'active',
        };
    }
}
