<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPriceTier extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'min_qty',
        'tier_price',
    ];

    protected function casts(): array
    {
        return [
            'min_qty' => 'integer',
            'tier_price' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
