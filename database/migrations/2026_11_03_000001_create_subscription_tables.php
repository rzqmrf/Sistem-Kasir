<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // starter, pro, business
            $table->string('name');
            $table->unsignedInteger('price_monthly')->default(0); // IDR
            $table->unsignedInteger('max_outlets')->nullable(); // null = unlimited
            $table->unsignedInteger('max_users')->nullable();
            $table->unsignedInteger('max_products')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans');
            $table->string('status'); // trialing, active, cancelled
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable(); // null = never expires (free plan)
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans');
            $table->string('number')->unique(); // also used as Midtrans order_id
            $table->unsignedTinyInteger('period_months')->default(1);
            $table->unsignedInteger('amount');
            $table->string('status')->default('pending'); // pending, paid, failed, expired
            $table->string('snap_token')->nullable();
            $table->string('snap_redirect_url')->nullable();
            $table->string('payment_type')->nullable();
            $table->string('gateway_transaction_id')->nullable();
            $table->json('gateway_payload')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        $now = now();

        DB::table('plans')->insert([
            ['code' => 'starter', 'name' => 'Starter', 'price_monthly' => 0, 'max_outlets' => 1, 'max_users' => 2, 'max_products' => 100, 'sort_order' => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'pro', 'name' => 'Pro', 'price_monthly' => 149000, 'max_outlets' => 3, 'max_users' => 10, 'max_products' => 2000, 'sort_order' => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'business', 'name' => 'Business', 'price_monthly' => 399000, 'max_outlets' => null, 'max_users' => null, 'max_products' => null, 'sort_order' => 3, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // Existing stores start a 14-day Pro trial so nothing they already use gets blocked today.
        $proId = DB::table('plans')->where('code', 'pro')->value('id');

        DB::table('tenants')->orderBy('id')->each(function ($tenant) use ($proId, $now) {
            DB::table('subscriptions')->insert([
                'tenant_id' => $tenant->id,
                'plan_id' => $proId,
                'status' => 'trialing',
                'trial_ends_at' => $now->copy()->addDays(14),
                'current_period_start' => $now,
                'current_period_end' => $now->copy()->addDays(14),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
    }
};
