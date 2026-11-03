<?php

namespace App\Support\Billing;

use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Thin wrapper around Midtrans Snap + Core status API.
 *
 * When MIDTRANS_SERVER_KEY is empty the gateway runs in simulator mode:
 * no HTTP calls are made and invoices can be settled from the billing page
 * (only outside production). This keeps local development and tests offline.
 */
class MidtransGateway
{
    public function __construct(private SubscriptionManager $subscriptions) {}

    public function isSimulator(): bool
    {
        return blank(config('services.midtrans.server_key'));
    }

    public function canSimulate(): bool
    {
        return $this->isSimulator() && ! app()->isProduction();
    }

    public function clientKey(): ?string
    {
        return config('services.midtrans.client_key');
    }

    public function snapScriptUrl(): string
    {
        return config('services.midtrans.is_production')
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js';
    }

    /**
     * Creates the Snap transaction and stores the token on the invoice.
     */
    public function createSnapTransaction(Invoice $invoice, Tenant $tenant, User $customer): void
    {
        if ($this->isSimulator()) {
            $invoice->update([
                'snap_token' => 'SIMULATOR-'.Str::upper(Str::random(16)),
                'snap_redirect_url' => null,
            ]);

            return;
        }

        $invoice->loadMissing('plan');

        $response = Http::withBasicAuth(config('services.midtrans.server_key'), '')
            ->acceptJson()
            ->timeout(15)
            ->post($this->snapBaseUrl().'/snap/v1/transactions', [
                'transaction_details' => [
                    'order_id' => $invoice->number,
                    'gross_amount' => $invoice->amount,
                ],
                'item_details' => [[
                    'id' => 'PLAN-'.strtoupper($invoice->plan->code),
                    'price' => $invoice->amount,
                    'quantity' => 1,
                    'name' => Str::limit("Paket {$invoice->plan->name} {$invoice->period_months} bln - {$tenant->name}", 50, ''),
                ]],
                'customer_details' => [
                    'first_name' => $customer->name,
                    'email' => $customer->email,
                ],
                'expiry' => [
                    'unit' => 'hours',
                    'duration' => 24,
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('Gagal membuat transaksi Midtrans: '.$response->json('error_messages.0', $response->body()));
        }

        $invoice->update([
            'snap_token' => $response->json('token'),
            'snap_redirect_url' => $response->json('redirect_url'),
        ]);
    }

    /**
     * Midtrans signature: sha512(order_id + status_code + gross_amount + server_key).
     */
    public function hasValidSignature(array $payload): bool
    {
        $serverKey = config('services.midtrans.server_key');

        if (blank($serverKey) || empty($payload['signature_key'])) {
            return false;
        }

        $expected = hash('sha512',
            ($payload['order_id'] ?? '')
            .($payload['status_code'] ?? '')
            .($payload['gross_amount'] ?? '')
            .$serverKey
        );

        return hash_equals($expected, $payload['signature_key']);
    }

    /**
     * Asks Midtrans for the latest status (used by "Cek Status" when webhooks cannot reach localhost).
     */
    public function fetchStatus(Invoice $invoice): array
    {
        $response = Http::withBasicAuth(config('services.midtrans.server_key'), '')
            ->acceptJson()
            ->timeout(15)
            ->get($this->coreBaseUrl().'/v2/'.urlencode($invoice->number).'/status');

        if ($response->failed()) {
            throw new RuntimeException('Gagal mengambil status Midtrans.');
        }

        return $response->json();
    }

    /**
     * Maps a Midtrans notification/status payload onto the invoice. Idempotent.
     */
    public function applyNotification(Invoice $invoice, array $payload): void
    {
        $transactionStatus = $payload['transaction_status'] ?? null;
        $fraudStatus = $payload['fraud_status'] ?? 'accept';

        // Never let a stale "pending"/"expire" notification undo a settled payment.
        if ($invoice->isPaid()) {
            return;
        }

        if ((int) ($payload['gross_amount'] ?? 0) !== $invoice->amount) {
            throw new RuntimeException("Nominal notifikasi tidak cocok dengan invoice {$invoice->number}.");
        }

        $invoice->forceFill([
            'payment_type' => $payload['payment_type'] ?? $invoice->payment_type,
            'gateway_transaction_id' => $payload['transaction_id'] ?? $invoice->gateway_transaction_id,
            'gateway_payload' => $payload,
        ])->save();

        $isPaid = $transactionStatus === 'settlement'
            || ($transactionStatus === 'capture' && $fraudStatus === 'accept');

        if ($isPaid) {
            $this->subscriptions->applyPaidInvoice($invoice);

            return;
        }

        $nextStatus = match ($transactionStatus) {
            'expire' => Invoice::EXPIRED,
            'deny', 'cancel', 'failure' => Invoice::FAILED,
            default => null, // pending / authorize: keep waiting
        };

        if ($nextStatus) {
            $invoice->forceFill(['status' => $nextStatus])->save();
        }
    }

    private function snapBaseUrl(): string
    {
        return config('services.midtrans.is_production')
            ? 'https://app.midtrans.com'
            : 'https://app.sandbox.midtrans.com';
    }

    private function coreBaseUrl(): string
    {
        return config('services.midtrans.is_production')
            ? 'https://api.midtrans.com'
            : 'https://api.sandbox.midtrans.com';
    }
}
