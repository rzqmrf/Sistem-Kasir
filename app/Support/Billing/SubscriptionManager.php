<?php

namespace App\Support\Billing;

use App\Exceptions\PlanLimitExceeded;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Support\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

class SubscriptionManager
{
    public function __construct(private PlanLimits $limits) {}

    /**
     * Applies a paid invoice exactly once. Renewing the same plan while still active
     * extends from the current period end so no paid days are lost.
     */
    public function applyPaidInvoice(Invoice $invoice): void
    {
        DB::transaction(function () use ($invoice) {
            $locked = Invoice::withoutGlobalScopes()->lockForUpdate()->findOrFail($invoice->id);

            if ($locked->isPaid()) {
                return;
            }

            $locked->forceFill([
                'status' => Invoice::PAID,
                'paid_at' => now(),
            ])->save();

            $tenant = Tenant::findOrFail($locked->tenant_id);
            $subscription = $tenant->currentSubscription();

            $extendsCurrent = $subscription->status === Subscription::ACTIVE
                && $subscription->plan_id === $locked->plan_id
                && $subscription->current_period_end?->isFuture();

            $start = $extendsCurrent ? $subscription->current_period_end : now();

            $subscription->update([
                'plan_id' => $locked->plan_id,
                'status' => Subscription::ACTIVE,
                'trial_ends_at' => null,
                'current_period_start' => $extendsCurrent ? $subscription->current_period_start : now(),
                'current_period_end' => $start->copy()->addMonths($locked->period_months),
            ]);

            $planName = Plan::find($locked->plan_id)?->name ?? 'Berbayar';
            AuditLogger::record(
                action: 'billing.invoice_paid',
                summary: "Invoice {$locked->number} lunas, paket {$planName} aktif ({$locked->period_months} bulan).",
                subject: $locked,
                tenantId: $tenant->id,
            );

            $invoice->setRawAttributes($locked->getAttributes(), true);
        });
    }

    /**
     * Moves the store to the free plan. Refused when current usage does not fit.
     *
     * @throws PlanLimitExceeded
     */
    public function switchToFreePlan(Tenant $tenant): void
    {
        $starter = Plan::byCode(Plan::STARTER);
        $overages = $this->limits->overages($tenant, $starter);

        if ($overages) {
            throw new PlanLimitExceeded(
                'Tidak bisa pindah ke paket Starter karena pemakaian saat ini melebihi batas: '
                .$this->limits->describeOverages($overages)
                .'. Kurangi dulu (nonaktifkan cabang, cabut akses staf) lalu coba lagi.'
            );
        }

        $prevPlan = $tenant->currentSubscription()->plan->name;

        $tenant->currentSubscription()->update([
            'plan_id' => $starter->id,
            'status' => Subscription::ACTIVE,
            'trial_ends_at' => null,
            'current_period_start' => now(),
            'current_period_end' => null,
        ]);

        AuditLogger::record(
            action: 'billing.plan_switched',
            summary: 'Mengubah paket toko menjadi Starter (gratis).',
            subject: $tenant->subscription,
            changes: [
                'plan' => ['before' => $prevPlan, 'after' => $starter->name],
            ],
            tenantId: $tenant->id,
        );
    }
}
