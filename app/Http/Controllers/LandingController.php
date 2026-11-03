<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class LandingController extends Controller
{
    public function __invoke(): Response
    {
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
            ]);

        return Inertia::render('Welcome', [
            'canLogin' => Route::has('login'),
            'canRegister' => Route::has('register'),
            'plans' => $plans,
            'trialDays' => Plan::TRIAL_DAYS,
        ]);
    }
}
