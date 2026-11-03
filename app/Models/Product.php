<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use BelongsToTenant, HasFactory;

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

    protected static function booted(): void
    {
        static::created(function (Product $product) {
            $tenant = Tenant::find($product->tenant_id);
            if (! $tenant) {
                return;
            }

            $activeOutlet = app(CurrentTenant::class)->outlet() ?? $tenant->ensureMainOutlet();
            $outlets = Outlet::withoutGlobalScopes()->where('tenant_id', $tenant->id)->get();

            foreach ($outlets as $outlet) {
                $existing = OutletStock::withoutGlobalScopes()
                    ->where('outlet_id', $outlet->id)
                    ->where('product_id', $product->id)
                    ->exists();

                if (! $existing) {
                    $row = new OutletStock([
                        'outlet_id' => $outlet->id,
                        'product_id' => $product->id,
                        'stock' => $outlet->id === $activeOutlet->id ? (int) $product->stock : 0,
                    ]);
                    $row->tenant_id = $tenant->id;
                    $row->save();
                }
            }

            $product->recalculateTotalStock();
        });
    }

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

    public function outletStocks(): HasMany
    {
        return $this->hasMany(OutletStock::class);
    }

    public function stockMutations(): HasMany
    {
        return $this->hasMany(StockMutation::class)->latest();
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function stockInOutlet(int $outletId): int
    {
        if ($this->relationLoaded('outletStocks')) {
            return (int) ($this->outletStocks->firstWhere('outlet_id', $outletId)?->stock ?? 0);
        }

        return (int) (OutletStock::withoutGlobalScopes()
            ->where('outlet_id', $outletId)
            ->where('product_id', $this->id)
            ->value('stock') ?? 0);
    }

    public function lockOutletStock(int $outletId): OutletStock
    {
        $row = OutletStock::withoutGlobalScopes()
            ->where('outlet_id', $outletId)
            ->where('product_id', $this->id)
            ->lockForUpdate()
            ->first();

        if (! $row) {
            $created = new OutletStock([
                'outlet_id' => $outletId,
                'product_id' => $this->id,
                'stock' => 0,
            ]);
            $created->tenant_id = $this->tenant_id;
            $created->save();

            $row = OutletStock::withoutGlobalScopes()
                ->whereKey($created->id)
                ->lockForUpdate()
                ->firstOrFail();
        }

        return $row;
    }

    public function recalculateTotalStock(): void
    {
        $total = (int) OutletStock::withoutGlobalScopes()
            ->where('product_id', $this->id)
            ->sum('stock');

        $this->forceFill(['stock' => $total])->saveQuietly();
    }

    public function hydrateOutletStock(int $outletId): self
    {
        $outletQty = $this->stockInOutlet($outletId);
        $this->setAttribute('total_stock', (int) $this->stock);
        $this->setAttribute('stock', $outletQty);

        return $this;
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
