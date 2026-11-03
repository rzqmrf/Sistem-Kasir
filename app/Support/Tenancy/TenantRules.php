<?php

namespace App\Support\Tenancy;

use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Rules\Unique;
use Illuminate\Validation\Rule;

/**
 * Validation rules bypass Eloquent global scopes (they hit the DB directly),
 * so `exists:` / `unique:` must be narrowed to the current tenant explicitly.
 */
class TenantRules
{
    public static function exists(string $table, string $column = 'id'): Exists
    {
        return Rule::exists($table, $column)->where('tenant_id', app(CurrentTenant::class)->id());
    }

    public static function unique(string $table, string $column): Unique
    {
        return Rule::unique($table, $column)->where('tenant_id', app(CurrentTenant::class)->id());
    }
}
