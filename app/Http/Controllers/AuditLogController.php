<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    private const ALLOWED_CATEGORIES = ['product', 'staff', 'outlet', 'billing', 'tenant'];

    public function index(Request $request): Response
    {
        $category = $request->string('category')->toString();
        $search = trim($request->string('search')->toString());

        $logs = AuditLog::query()
            ->with('user:id,name,email')
            ->when(
                in_array($category, self::ALLOWED_CATEGORIES, true),
                fn ($q) => $q->where('action', 'like', "{$category}.%")
            )
            ->when(
                $search !== '',
                fn ($q) => $q->where('summary', 'like', "%{$search}%")
            )
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('AuditLogs/Index', [
            'logs' => $logs,
            'filters' => [
                'category' => in_array($category, self::ALLOWED_CATEGORIES, true) ? $category : '',
                'search' => $search,
            ],
        ]);
    }
}
