<?php

use App\Http\Controllers\Admin\SuperAdminController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\MidtransWebhookController;
use App\Http\Controllers\OutletController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\TenantRedirectController;
use Illuminate\Support\Facades\Route;

// Public SaaS Landing & Pricing page
Route::get('/', LandingController::class)->name('landing');

Route::middleware(['auth'])->group(function () {
    // Sends the user to their current/first store: /t/{slug}/pos
    Route::get('/dashboard', TenantRedirectController::class)->name('dashboard');

    // Create an additional store owned by the current user
    Route::post('/stores', [StoreController::class, 'store'])
        ->middleware('throttle:store-creation')
        ->name('stores.store');

    // Profile Settings (account-level, not store-level)
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// Platform Super Admin Panel (cross-tenant metrics & tenant status governance)
Route::prefix('admin')->middleware(['auth', 'super_admin'])->group(function () {
    Route::get('/', [SuperAdminController::class, 'index'])->name('admin.index');
    Route::patch('/tenants/{tenant}/status', [SuperAdminController::class, 'updateTenantStatus'])
        ->name('admin.tenants.status');
});

// Store-scoped routes. Every model query inside is filtered by the resolved tenant.
// `subscribed` turns the store read-only (writes refused) once the subscription has expired.
Route::prefix('t/{tenant}')->middleware(['auth', 'tenant', 'subscribed'])->group(function () {
    // Active outlet switcher (accessible by owner, manager, cashier)
    Route::post('/outlets/switch', [OutletController::class, 'switchOutlet'])->name('outlets.switch');

    // POS Cashier Terminal (accessible by owner, manager, cashier)
    Route::get('/pos', [PosController::class, 'index'])->name('pos.index');
    Route::get('/pos/search', [PosController::class, 'search'])->name('pos.search');
    Route::post('/pos/checkout', [PosController::class, 'checkout'])
        ->middleware('throttle:pos-checkout')
        ->name('pos.checkout');
    Route::post('/pos/hold', [PosController::class, 'holdOrder'])->name('pos.hold');
    Route::delete('/pos/hold/{id}', [PosController::class, 'releaseHeldOrder'])->name('pos.release-hold');

    // Cashier Shift & Cash Drawer (accessible by owner, manager, cashier)
    Route::post('/shifts/open', [ShiftController::class, 'open'])->name('shifts.open');
    Route::post('/shifts/close', [ShiftController::class, 'close'])->name('shifts.close');
    Route::post('/shifts/mutations', [ShiftController::class, 'addMutation'])->name('shifts.mutations');

    // Management routes (restricted to owner & manager)
    Route::middleware(['role:owner,manager'])->group(function () {
        // Products & Inventory Management
        Route::get('/products', [ProductController::class, 'index'])->name('products.index');
        Route::post('/products', [ProductController::class, 'store'])->name('products.store');
        Route::put('/products/{product}', [ProductController::class, 'update'])->name('products.update');
        Route::post('/products/{product}/adjust-stock', [ProductController::class, 'adjustStock'])->name('products.adjust-stock');

        // Outlets & Multi-Branch Inventory Transfer
        Route::get('/outlets', [OutletController::class, 'index'])->name('outlets.index');
        Route::post('/outlets', [OutletController::class, 'store'])->name('outlets.store');
        Route::post('/outlets/transfer-stock', [OutletController::class, 'transferStock'])->name('outlets.transfer');
        Route::put('/outlets/{outlet}', [OutletController::class, 'update'])->name('outlets.update');

        // Reports & Owner Dashboard
        Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');

        // Store Staff & Role Management
        Route::get('/staff', [StaffController::class, 'index'])->name('staff.index');
        Route::post('/staff', [StaffController::class, 'store'])->name('staff.store');
        Route::patch('/staff/{user}', [StaffController::class, 'update'])->name('staff.update');
        Route::delete('/staff/{user}', [StaffController::class, 'destroy'])->name('staff.destroy');

        // Store Activity Audit Logs
        Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
    });

    // Subscription & Billing (owner only, stays writable when the subscription has expired)
    Route::middleware(['role:owner'])->group(function () {
        Route::get('/billing', [BillingController::class, 'index'])->name('billing.index');
        Route::middleware('throttle:billing-actions')->group(function () {
            Route::post('/billing/checkout', [BillingController::class, 'checkout'])->name('billing.checkout');
            Route::post('/billing/invoices/{invoice}/check-status', [BillingController::class, 'checkStatus'])->name('billing.check-status');
            Route::post('/billing/invoices/{invoice}/simulate', [BillingController::class, 'simulatePayment'])->name('billing.simulate');
        });
    });
});

// Midtrans HTTP notification (server-to-server, signature-verified, CSRF-exempt)
Route::post('/webhooks/midtrans', MidtransWebhookController::class)
    ->middleware('throttle:midtrans-webhook')
    ->name('webhooks.midtrans');

require __DIR__.'/auth.php';
