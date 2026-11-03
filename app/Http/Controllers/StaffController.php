<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\User;
use App\Support\Audit\AuditLogger;
use App\Support\Billing\PlanLimits;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StaffController extends Controller
{
    public function index(Request $request, CurrentTenant $currentTenant): Response
    {
        $tenant = $currentTenant->getOrFail();
        $actorRole = $request->user()->roleIn($tenant);

        $roleOrder = [
            Tenant::ROLE_OWNER => 1,
            Tenant::ROLE_MANAGER => 2,
            Tenant::ROLE_CASHIER => 3,
        ];

        $members = $tenant->users()
            ->orderBy('name')
            ->get()
            ->sortBy(fn (User $member) => $roleOrder[$member->pivot->role] ?? 99)
            ->values()
            ->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'role' => $member->pivot->role,
                'joined_at' => $member->pivot->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Staff/Index', [
            'members' => $members,
            'canManageManagers' => $actorRole === Tenant::ROLE_OWNER,
        ]);
    }

    public function store(Request $request, CurrentTenant $currentTenant, PlanLimits $limits): RedirectResponse
    {
        $tenant = $currentTenant->getOrFail();
        $actorRole = $request->user()->roleIn($tenant);

        $baseValidated = $request->validate([
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255'],
            'role' => ['required', 'string', 'in:manager,cashier'],
        ]);

        if ($actorRole !== Tenant::ROLE_OWNER && $baseValidated['role'] !== Tenant::ROLE_CASHIER) {
            abort(403, 'Manajer hanya dapat menambahkan staf dengan role Kasir.');
        }

        $existingUser = User::where('email', $baseValidated['email'])->first();

        if ($existingUser && $existingUser->belongsToTenant($tenant)) {
            throw ValidationException::withMessages([
                'email' => 'Pengguna dengan email ini sudah terdaftar di toko ini.',
            ]);
        }

        $limits->ensureCanAdd($tenant, 'users');

        if (! $existingUser) {
            $newAccountData = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', 'min:8'],
            ]);
        } else {
            $newAccountData = [];
        }

        DB::transaction(function () use ($tenant, $existingUser, $baseValidated, $newAccountData) {
            $targetUser = $existingUser ?? User::create([
                'name' => $newAccountData['name'],
                'email' => $baseValidated['email'],
                'password' => Hash::make($newAccountData['password']),
                'role' => $baseValidated['role'] === Tenant::ROLE_MANAGER ? 'admin' : 'cashier',
                'is_active' => true,
            ]);

            $tenant->users()->attach($targetUser->id, [
                'role' => $baseValidated['role'],
            ]);

            AuditLogger::record(
                action: 'staff.added',
                summary: "Menambahkan staf {$targetUser->email} dengan role {$baseValidated['role']}.",
                subject: $targetUser,
                changes: [
                    'role' => ['before' => null, 'after' => $baseValidated['role']],
                ],
                tenantId: $tenant->id,
            );
        });

        return back()->with('success', 'Staf berhasil ditambahkan ke toko.');
    }

    public function update(Request $request, User $user, CurrentTenant $currentTenant): RedirectResponse
    {
        $tenant = $currentTenant->getOrFail();
        $actorRole = $request->user()->roleIn($tenant);

        if (! $user->belongsToTenant($tenant)) {
            abort(404);
        }

        $targetRole = $user->roleIn($tenant);

        if ($targetRole === Tenant::ROLE_OWNER) {
            abort(403, 'Role pemilik toko tidak dapat diubah.');
        }

        if ($actorRole !== Tenant::ROLE_OWNER) {
            abort(403, 'Hanya pemilik toko yang dapat mengubah role staf.');
        }

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:manager,cashier'],
        ]);

        $tenant->users()->updateExistingPivot($user->id, [
            'role' => $validated['role'],
        ]);

        if ($targetRole !== $validated['role']) {
            AuditLogger::record(
                action: 'staff.role_updated',
                summary: "Mengubah role staf {$user->email} dari {$targetRole} menjadi {$validated['role']}.",
                subject: $user,
                changes: [
                    'role' => ['before' => $targetRole, 'after' => $validated['role']],
                ],
                tenantId: $tenant->id,
            );
        }

        return back()->with('success', 'Role staf berhasil diperbarui.');
    }

    public function destroy(Request $request, User $user, CurrentTenant $currentTenant): RedirectResponse
    {
        $tenant = $currentTenant->getOrFail();
        $actorRole = $request->user()->roleIn($tenant);

        if (! $user->belongsToTenant($tenant)) {
            abort(404);
        }

        if ($user->id === $request->user()->id) {
            abort(403, 'Anda tidak dapat mengeluarkan akun Anda sendiri.');
        }

        $targetRole = $user->roleIn($tenant);

        if ($targetRole === Tenant::ROLE_OWNER) {
            abort(403, 'Pemilik toko tidak dapat dikeluarkan.');
        }

        if ($actorRole !== Tenant::ROLE_OWNER && $targetRole !== Tenant::ROLE_CASHIER) {
            abort(403, 'Manajer hanya dapat mengeluarkan staf Kasir.');
        }

        $tenant->users()->detach($user->id);

        AuditLogger::record(
            action: 'staff.removed',
            summary: "Mencabut akses staf {$user->email} ({$targetRole}).",
            subject: $user,
            changes: [
                'role' => ['before' => $targetRole, 'after' => null],
            ],
            tenantId: $tenant->id,
        );

        return back()->with('success', 'Akses staf ke toko berhasil dicabut.');
    }
}
