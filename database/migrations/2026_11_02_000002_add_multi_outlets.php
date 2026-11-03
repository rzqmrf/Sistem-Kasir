<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outlets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 30);
            $table->string('address')->nullable();
            $table->string('phone', 30)->nullable();
            $table->boolean('is_main')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('outlet_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained('outlets')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('stock')->default(0);
            $table->timestamps();

            $table->unique(['outlet_id', 'product_id']);
        });

        foreach (['shifts', 'sales', 'stock_mutations'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('outlet_id')->nullable()->after('tenant_id')->constrained('outlets')->nullOnDelete();
            });
        }

        $this->backfillMainOutlets();
    }

    private function backfillMainOutlets(): void
    {
        $now = now();

        DB::table('tenants')->orderBy('id')->each(function ($tenant) use ($now) {
            $outletId = DB::table('outlets')->insertGetId([
                'tenant_id' => $tenant->id,
                'name' => 'Cabang Pusat',
                'code' => 'PUSAT',
                'is_main' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach (['shifts', 'sales', 'stock_mutations'] as $tableName) {
                DB::table($tableName)
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('outlet_id')
                    ->update(['outlet_id' => $outletId]);
            }

            $products = DB::table('products')->where('tenant_id', $tenant->id)->get(['id', 'stock']);
            foreach ($products as $product) {
                DB::table('outlet_product')->insert([
                    'tenant_id' => $tenant->id,
                    'outlet_id' => $outletId,
                    'product_id' => $product->id,
                    'stock' => $product->stock,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });
    }

    public function down(): void
    {
        foreach (['stock_mutations', 'sales', 'shifts'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('outlet_id');
            });
        }

        Schema::dropIfExists('outlet_product');
        Schema::dropIfExists('outlets');
    }
};
