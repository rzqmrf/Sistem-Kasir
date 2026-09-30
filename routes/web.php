<?php

use App\Http\Controllers\PosController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ShiftController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Redirect root to POS or Login
Route::get('/', function () {
    return auth()->check() ? redirect()->route('pos.index') : redirect()->route('login');
});

Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', fn () => redirect()->route('pos.index'))->name('dashboard');

    // POS Cashier Terminal
    Route::get('/pos', [PosController::class, 'index'])->name('pos.index');
    Route::get('/pos/search', [PosController::class, 'search'])->name('pos.search');
    Route::post('/pos/checkout', [PosController::class, 'checkout'])->name('pos.checkout');
    Route::post('/pos/hold', [PosController::class, 'holdOrder'])->name('pos.hold');
    Route::delete('/pos/hold/{id}', [PosController::class, 'releaseHeldOrder'])->name('pos.release-hold');

    // Cashier Shift & Cash Drawer
    Route::post('/shifts/open', [ShiftController::class, 'open'])->name('shifts.open');
    Route::post('/shifts/close', [ShiftController::class, 'close'])->name('shifts.close');
    Route::post('/shifts/mutations', [ShiftController::class, 'addMutation'])->name('shifts.mutations');

    // Products & Inventory Management
    Route::get('/products', [ProductController::class, 'index'])->name('products.index');
    Route::post('/products', [ProductController::class, 'store'])->name('products.store');
    Route::put('/products/{product}', [ProductController::class, 'update'])->name('products.update');
    Route::post('/products/{product}/adjust-stock', [ProductController::class, 'adjustStock'])->name('products.adjust-stock');

    // Reports & Owner Dashboard
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');

    // Profile Settings
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
