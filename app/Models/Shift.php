<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    use BelongsToTenant, BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'user_id',
        'opened_at',
        'closed_at',
        'starting_cash',
        'expected_cash',
        'actual_cash',
        'difference',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'starting_cash' => 'decimal:2',
            'expected_cash' => 'decimal:2',
            'actual_cash' => 'decimal:2',
            'difference' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cashMutations(): HasMany
    {
        return $this->hasMany(CashMutation::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    /**
     * Calculate current expected cash in drawer
     */
    public function calculateExpectedCash(): float
    {
        $cashSales = $this->sales()
            ->where('status', 'completed')
            ->whereHas('paymentDetails', function ($q) {
                $q->where('payment_type', 'cash');
            })
            ->with(['paymentDetails' => function ($q) {
                $q->where('payment_type', 'cash');
            }])
            ->get()
            ->sum(function ($sale) {
                return (float) $sale->paymentDetails->where('payment_type', 'cash')->sum('amount') - (float) $sale->change_amount;
            });

        $cashIn = (float) $this->cashMutations()->where('type', 'in')->sum('amount');
        $cashOut = (float) $this->cashMutations()->where('type', 'out')->sum('amount');

        return (float) $this->starting_cash + $cashSales + $cashIn - $cashOut;
    }
}
