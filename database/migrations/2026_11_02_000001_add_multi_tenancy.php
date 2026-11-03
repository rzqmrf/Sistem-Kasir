<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Business tables that become tenant-owned.
     */
    private array $tenantTables = [
        'categories',
        'products',
        'product_price_tiers',
        'shifts',
        'cash_mutations',
        'sales',
        'sale_items',
        'payment_details',
        'stock_mutations',
    ];

    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('active'); // active, suspended
            $table->timestamps();
        });

        Schema::create('tenant_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('cashier'); // owner, manager, cashier
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id']);
        });

        foreach ($this->tenantTables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            });
        }

        $this->backfillExistingData();

        foreach ($this->tenantTables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable(false)->change();
            });
        }

        // Uniqueness is now per tenant: two stores may share a barcode or invoice number.
        // Old indexes are dropped only if present (SQLite table rebuilds may already have merged them).
        $this->dropIndexesIfExist('categories', ['categories_slug_unique']);
        $this->dropIndexesIfExist('products', ['products_barcode_unique', 'products_barcode_index', 'products_sku_unique']);
        $this->dropIndexesIfExist('sales', ['sales_invoice_no_unique', 'sales_invoice_no_index']);

        Schema::table('categories', function (Blueprint $table) {
            $table->unique(['tenant_id', 'slug']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->unique(['tenant_id', 'barcode']);
            $table->unique(['tenant_id', 'sku']);
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->unique(['tenant_id', 'invoice_no']);
            $table->index(['tenant_id', 'status', 'created_at']);
        });
    }

    private function dropIndexesIfExist(string $tableName, array $indexes): void
    {
        foreach ($indexes as $index) {
            if (Schema::hasIndex($tableName, $index)) {
                Schema::table($tableName, fn (Blueprint $table) => str_ends_with($index, '_unique')
                    ? $table->dropUnique($index)
                    : $table->dropIndex($index));
            }
        }
    }

    /**
     * Existing single-store data is moved into one default tenant so nothing is lost.
     */
    private function backfillExistingData(): void
    {
        $hasData = DB::table('users')->exists() || DB::table('products')->exists();

        if (! $hasData) {
            return;
        }

        $now = now();
        $tenantId = DB::table('tenants')->insertGetId([
            'name' => 'Toko Utama',
            'slug' => 'toko-utama',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ($this->tenantTables as $tableName) {
            DB::table($tableName)->update(['tenant_id' => $tenantId]);
        }

        DB::table('users')->orderBy('id')->each(function ($user) use ($tenantId, $now) {
            DB::table('tenant_user')->insert([
                'tenant_id' => $tenantId,
                'user_id' => $user->id,
                'role' => $user->role === 'admin' ? 'owner' : 'cashier',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'status', 'created_at']);
            $table->dropUnique(['tenant_id', 'invoice_no']);
            $table->unique('invoice_no');
            $table->index('invoice_no');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'barcode']);
            $table->dropUnique(['tenant_id', 'sku']);
            $table->unique('barcode');
            $table->index('barcode');
            $table->unique('sku');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'slug']);
            $table->unique('slug');
        });

        foreach (array_reverse($this->tenantTables) as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('tenant_id');
            });
        }

        Schema::dropIfExists('tenant_user');
        Schema::dropIfExists('tenants');
    }
};
