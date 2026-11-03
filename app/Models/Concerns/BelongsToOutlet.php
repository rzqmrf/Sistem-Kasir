<?php

namespace App\Models\Concerns;

use App\Models\Outlet;
use App\Models\Tenant;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToOutlet
{
    public static function bootBelongsToOutlet(): void
    {
        static::creating(function ($model) {
            if ($model->outlet_id) {
                return;
            }

            $outletId = app(CurrentTenant::class)->outletId();

            if (! $outletId && $model->tenant_id) {
                $outletId = Tenant::find($model->tenant_id)?->ensureMainOutlet()->id;
            }

            $model->outlet_id = $outletId;
        });
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }
}
