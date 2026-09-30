<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMutation extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'type',
        'qty_change',
        'balance_stock',
        'reference_type',
        'reference_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'qty_change' => 'integer',
            'balance_stock' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
