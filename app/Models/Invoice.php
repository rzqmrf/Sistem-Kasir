<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    use BelongsToTenant;

    public const PENDING = 'pending';
    public const PAID = 'paid';
    public const FAILED = 'failed';
    public const EXPIRED = 'expired';

    protected $fillable = [
        'plan_id',
        'number',
        'period_months',
        'amount',
        'status',
        'snap_token',
        'snap_redirect_url',
        'payment_type',
        'gateway_transaction_id',
        'gateway_payload',
        'paid_at',
        'expires_at',
    ];

    protected $hidden = [
        'gateway_payload',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'period_months' => 'integer',
            'gateway_payload' => 'array',
            'paid_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isPaid(): bool
    {
        return $this->status === self::PAID;
    }
}
