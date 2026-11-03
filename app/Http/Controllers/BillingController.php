<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Plan;
use App\Support\Billing\MidtransGateway;
use App\Support\Billing\PlanLimits;
use App\Support\Billing\SubscriptionManager;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class BillingController extends Controller
{
    public function __construct(
        private CurrentTenant $currentTenant,
        private PlanLimits $limits,
        private SubscriptionManager $subscriptions,
        private MidtransGateway $gateway,
    ) {}

    public function index(): Response
    {
        $tenant = $this->currentTenant->getOrFail();
        $subscription = $tenant->currentSubscription();
        $usage = $this->limits->usage($tenant);

        $plans = Plan::where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'code' => $plan->code,
                'name' => $plan->name,
                'price_monthly' => $plan->price_monthly,
                'price_yearly' => $plan->priceFor(12),
                'limits' => [
                    'outlets' => $plan->max_outlets,
                    'users' => $plan->max_users,
                    'products' => $plan->max_products,
                ],
                'overages' => $this->limits->overages($tenant, $plan),
            ]);

        $invoices = Invoice::with('plan:id,name,code')
            ->latest()
            ->take(20)
            ->get();

        return Inertia::render('Billing/Index', [
            'currentSubscription' => [
                'plan' => $subscription->plan->only(['id', 'code', 'name', 'price_monthly']),
                'status' => $subscription->displayStatus(),
                'current_period_end' => $subscription->current_period_end?->toIso8601String(),
                'days_left' => $subscription->daysLeft(),
            ],
            'usage' => $usage,
            'limits' => [
                'outlets' => $subscription->plan->max_outlets,
                'users' => $subscription->plan->max_users,
                'products' => $subscription->plan->max_products,
            ],
            'plans' => $plans,
            'invoices' => $invoices,
            'gateway' => [
                'simulator' => $this->gateway->isSimulator(),
                'can_simulate' => $this->gateway->canSimulate(),
                'client_key' => $this->gateway->clientKey(),
                'snap_script_url' => $this->gateway->snapScriptUrl(),
            ],
        ]);
    }

    /**
     * Creates (or reuses) a pending invoice for a paid plan and returns to the billing page,
     * which opens Snap with the invoice token.
     */
    public function checkout(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'plan_code' => ['required', Rule::exists('plans', 'code')->where('is_active', true)],
            'period_months' => ['required', 'integer', Rule::in([1, 12])],
        ]);

        $tenant = $this->currentTenant->getOrFail();
        $plan = Plan::byCode($validated['plan_code']);
        $months = (int) $validated['period_months'];

        if ($plan->isFree()) {
            $this->subscriptions->switchToFreePlan($tenant);

            return back()->with('success', 'Toko sekarang menggunakan paket Starter (gratis).');
        }

        $overages = $this->limits->overages($tenant, $plan);
        if ($overages) {
            return back()->with('error', "Paket {$plan->name} terlalu kecil untuk pemakaian saat ini: ".$this->limits->describeOverages($overages).'.');
        }

        $invoice = Invoice::where('status', Invoice::PENDING)
            ->where('plan_id', $plan->id)
            ->where('period_months', $months)
            ->where('expires_at', '>', now())
            ->whereNotNull('snap_token')
            ->latest()
            ->first();

        if (! $invoice) {
            $invoice = Invoice::create([
                'plan_id' => $plan->id,
                'number' => $this->nextInvoiceNumber(),
                'period_months' => $months,
                'amount' => $plan->priceFor($months),
                'status' => Invoice::PENDING,
                'expires_at' => now()->addDay(),
            ]);

            try {
                $this->gateway->createSnapTransaction($invoice, $tenant, $request->user());
            } catch (RuntimeException $e) {
                $invoice->update(['status' => Invoice::FAILED]);
                report($e);

                return back()->with('error', 'Gateway pembayaran sedang bermasalah. Coba beberapa saat lagi.');
            }
        }

        return back()
            ->with('success', "Invoice {$invoice->number} dibuat. Selesaikan pembayaran untuk mengaktifkan paket {$plan->name}.")
            ->with('pay_invoice_id', $invoice->id);
    }

    /**
     * Pulls the latest status from Midtrans. Useful in local dev where webhooks cannot reach the app.
     */
    public function checkStatus(Invoice $invoice): RedirectResponse
    {
        if (! $invoice->isPending()) {
            return back()->with('success', "Invoice {$invoice->number} berstatus {$invoice->status}.");
        }

        if ($this->gateway->isSimulator()) {
            return back()->with('error', 'Mode simulator aktif: gunakan tombol "Simulasikan Bayar".');
        }

        try {
            $this->gateway->applyNotification($invoice, $this->gateway->fetchStatus($invoice));
        } catch (RuntimeException $e) {
            report($e);

            return back()->with('error', 'Status pembayaran belum bisa dicek. Coba lagi sebentar.');
        }

        $invoice->refresh();

        return back()->with(
            $invoice->isPaid() ? 'success' : 'error',
            $invoice->isPaid() ? 'Pembayaran diterima. Paket sudah aktif.' : "Status invoice: {$invoice->status}."
        );
    }

    /**
     * Settles a pending invoice without a real payment. Simulator mode + non-production only.
     */
    public function simulatePayment(Invoice $invoice): RedirectResponse
    {
        abort_unless($this->gateway->canSimulate(), 404);

        if (! $invoice->isPending()) {
            return back()->with('error', "Invoice {$invoice->number} sudah {$invoice->status}.");
        }

        $invoice->forceFill(['payment_type' => 'simulator'])->save();
        $this->subscriptions->applyPaidInvoice($invoice);

        return back()->with('success', "Pembayaran simulasi {$invoice->number} berhasil. Paket sudah aktif.");
    }

    private function nextInvoiceNumber(): string
    {
        // Globally unique: it doubles as the Midtrans order_id across all stores.
        return 'QR-'.now()->format('Ymd').'-'.Str::upper(Str::random(8));
    }
}
