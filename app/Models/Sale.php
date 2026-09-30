<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_no',
        'shift_id',
        'cashier_id',
        'customer_name',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'grand_total',
        'total_buy_price',
        'paid_amount',
        'change_amount',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'total_buy_price' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'change_amount' => 'decimal:2',
        ];
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function paymentDetails(): HasMany
    {
        return $this->hasMany(PaymentDetail::class);
    }

    public function getGrossProfitAttribute(): float
    {
        return (float) $this->grand_total - (float) $this->total_buy_price;
    }
}
