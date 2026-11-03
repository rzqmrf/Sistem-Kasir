<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    public const STARTER = 'starter';
    public const PRO = 'pro';
    public const BUSINESS = 'business';

    public const TRIAL_PLAN = self::PRO;
    public const TRIAL_DAYS = 14;

    /** Limit keys that can be enforced, mapped to their column. */
    public const LIMITS = [
        'outlets' => 'max_outlets',
        'users' => 'max_users',
        'products' => 'max_products',
    ];

    protected $fillable = [
        'code',
        'name',
        'price_monthly',
        'max_outlets',
        'max_users',
        'max_products',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price_monthly' => 'integer',
            'max_outlets' => 'integer',
            'max_users' => 'integer',
            'max_products' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public static function byCode(string $code): self
    {
        return static::where('code', $code)->firstOrFail();
    }

    public function isFree(): bool
    {
        return $this->price_monthly === 0;
    }

    /**
     * null means unlimited.
     */
    public function limitFor(string $resource): ?int
    {
        return $this->{self::LIMITS[$resource]};
    }

    /**
     * Price for a billing period. Annual billing pays for 10 months (2 months free).
     */
    public function priceFor(int $months): int
    {
        $billableMonths = $months === 12 ? 10 : $months;

        return $this->price_monthly * $billableMonths;
    }
}
