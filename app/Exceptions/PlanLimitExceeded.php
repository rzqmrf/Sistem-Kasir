<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Thrown when an action would exceed the store's plan quota.
 * Rendered as a 422 JSON message or a redirect back with a flash + `plan` error.
 */
class PlanLimitExceeded extends RuntimeException
{
    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $this->getMessage()], 422);
        }

        return back()
            ->withErrors(['plan' => $this->getMessage()])
            ->with('error', $this->getMessage());
    }
}
