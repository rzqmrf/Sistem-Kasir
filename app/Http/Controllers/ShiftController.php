<?php

namespace App\Http\Controllers;

use App\Models\CashMutation;
use App\Models\Shift;
use App\Support\Tenancy\CurrentTenant;
use App\Support\Tenancy\TenantRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    /**
     * Open a new cashier shift in the active outlet
     */
    public function open(Request $request, CurrentTenant $currentTenant): RedirectResponse
    {
        $request->validate([
            'starting_cash' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $outlet = $currentTenant->outletOrFail();

        // Check if there is already an open shift for this user in the active outlet
        $existing = Shift::where('user_id', $user->id)
            ->where('outlet_id', $outlet->id)
            ->where('status', 'open')
            ->first();

        if ($existing) {
            return back()->with('error', "Anda sudah memiliki shift yang aktif di {$outlet->name}.");
        }

        Shift::create([
            'outlet_id' => $outlet->id,
            'user_id' => $user->id,
            'opened_at' => now(),
            'starting_cash' => $request->starting_cash,
            'expected_cash' => $request->starting_cash,
            'status' => 'open',
            'notes' => $request->notes,
        ]);

        return back()->with('success', "Shift kasir di {$outlet->name} berhasil dibuka.");
    }

    /**
     * Record Cash In / Out (Petty Cash)
     */
    public function addMutation(Request $request): JsonResponse
    {
        $request->validate([
            'shift_id' => ['required', TenantRules::exists('shifts')],
            'type' => 'required|in:in,out',
            'amount' => 'required|numeric|min:1',
            'reason' => 'required|string|max:255',
        ]);

        $shift = Shift::findOrFail($request->shift_id);

        if ($shift->status !== 'open') {
            return response()->json(['message' => 'Shift sudah ditutup.'], 422);
        }

        $mutation = CashMutation::create([
            'shift_id' => $shift->id,
            'type' => $request->type,
            'amount' => $request->amount,
            'reason' => $request->reason,
        ]);

        // Recalculate expected cash
        $shift->expected_cash = $shift->calculateExpectedCash();
        $shift->save();

        return response()->json([
            'message' => 'Arus kas laci berhasil dicatat',
            'mutation' => $mutation,
            'expected_cash' => $shift->expected_cash,
        ]);
    }

    /**
     * Close cashier shift and calculate discrepancy
     */
    public function close(Request $request): JsonResponse
    {
        $request->validate([
            'shift_id' => ['required', TenantRules::exists('shifts')],
            'actual_cash' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $shift = Shift::with(['sales.paymentDetails', 'cashMutations'])->findOrFail($request->shift_id);

        if ($shift->status !== 'open') {
            return response()->json(['message' => 'Shift sudah ditutup sebelumnya.'], 422);
        }

        $expectedCash = $shift->calculateExpectedCash();
        $actualCash = (float) $request->actual_cash;
        $difference = $actualCash - $expectedCash;

        $shift->update([
            'closed_at' => now(),
            'expected_cash' => $expectedCash,
            'actual_cash' => $actualCash,
            'difference' => $difference,
            'status' => 'closed',
            'notes' => $request->notes,
        ]);

        return response()->json([
            'message' => 'Shift kasir berhasil ditutup',
            'shift' => $shift,
            'reconciliation' => [
                'starting_cash' => $shift->starting_cash,
                'expected_cash' => $expectedCash,
                'actual_cash' => $actualCash,
                'difference' => $difference,
                'status' => $difference === 0.0 ? 'SEIMBANG' : ($difference > 0 ? 'LEBIH KAS' : 'DEFISIT / KURANG KAS'),
            ],
        ]);
    }
}
