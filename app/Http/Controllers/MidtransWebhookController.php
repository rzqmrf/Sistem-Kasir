<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Support\Billing\MidtransGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Receives Midtrans HTTP notifications. Public, CSRF-exempt, authenticated by signature.
 */
class MidtransWebhookController extends Controller
{
    public function __invoke(Request $request, MidtransGateway $gateway): JsonResponse
    {
        $payload = $request->all();

        if (! $gateway->hasValidSignature($payload)) {
            Log::warning('Midtrans notification rejected: invalid signature', [
                'order_id' => $payload['order_id'] ?? null,
            ]);

            return response()->json(['message' => 'Invalid signature'], 403);
        }

        // No tenant context here: the tenant scope is inactive, lookup is by the unique invoice number.
        $invoice = Invoice::where('number', $payload['order_id'] ?? '')->first();

        if (! $invoice) {
            // 200 so Midtrans stops retrying notifications for orders that are not ours.
            return response()->json(['message' => 'Unknown order'], 200);
        }

        try {
            $gateway->applyNotification($invoice, $payload);
        } catch (RuntimeException $e) {
            report($e);

            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'OK']);
    }
}
