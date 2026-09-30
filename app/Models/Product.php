<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'barcode',
        'sku',
        'name',
        'buy_price',
        'sell_price',
        'stock',
        'min_stock_alert',
        'unit',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'buy_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'stock' => 'integer',
            'min_stock_alert' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function priceTiers(): HasMany
    {
        return $this->hasMany(ProductPriceTier::class)->orderBy('min_qty', 'asc');
    }

    public function stockMutations(): HasMany
    {
        return $this->hasMany(StockMutation::class)->latest();
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    /**
     * Calculate unit sell price based on quantity (Wholesale/Tier pricing)
     */
    public function getPriceForQuantity(int $qty): float
    {
        $tiers = $this->priceTiers;
        $effectivePrice = (float) $this->sell_price;

        foreach ($tiers as $tier) {
            if ($qty >= $tier->min_qty) {
                $effectivePrice = (float) $tier->tier_price;
            }
        }

        return $effectivePrice;
    }
}
