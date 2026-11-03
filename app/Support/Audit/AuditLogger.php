<?php

namespace App\Support\Audit;

use App\Models\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Model;

class AuditLogger
{
    /**
     * Records a sensitive business or administrative action scoped to a tenant.
     *
     * @param  array<string, mixed>|null  $changes
     */
    public static function record(
        string $action,
        string $summary,
        ?Model $subject = null,
        ?array $changes = null,
        ?int $tenantId = null,
        ?int $userId = null,
    ): AuditLog {
        $resolvedTenantId = $tenantId
            ?? ($subject ? $subject->getAttribute('tenant_id') : null)
            ?? app(CurrentTenant::class)->id();

        $log = new AuditLog([
            'user_id' => $userId ?? auth()->id(),
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'summary' => $summary,
            'changes' => $changes ?: null,
            'ip_address' => app()->runningInConsole() && ! app()->runningUnitTests()
                ? null
                : request()?->ip(),
            'created_at' => now(),
        ]);

        $log->tenant_id = $resolvedTenantId;
        $log->save();

        return $log;
    }

    /**
     * Builds a compact { field: { before, after } } diff for modified attributes.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  list<string>  $fields
     * @return array<string, array{before: mixed, after: mixed}>
     */
    public static function diff(array $before, array $after, array $fields): array
    {
        $diff = [];

        foreach ($fields as $field) {
            $oldVal = $before[$field] ?? null;
            $newVal = $after[$field] ?? null;

            if ((string) $oldVal !== (string) $newVal) {
                $diff[$field] = [
                    'before' => $oldVal,
                    'after' => $newVal,
                ];
            }
        }

        return $diff;
    }
}
