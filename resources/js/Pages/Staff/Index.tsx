import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, TenantRole } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Plus, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface StaffMember {
    id: number;
    name: string;
    email: string;
    role: TenantRole;
    joined_at: string | null;
}

interface StaffPageProps extends Record<string, unknown> {
    members: StaffMember[];
    canManageManagers: boolean;
}

const ROLE_META: Record<TenantRole, { label: string; badgeClass: string; desc: string }> = {
    owner: {
        label: 'Owner',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        desc: 'Akses penuh seluruh fitur toko, laporan laba, produk, dan manajemen staf.',
    },
    manager: {
        label: 'Manajer',
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        desc: 'Kelola produk, stok, laporan profit, kasir POS, serta tambah/cabut akses Kasir.',
    },
    cashier: {
        label: 'Kasir',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        desc: 'Hanya terminal kasir POS dan manajemen shift laci kas.',
    },
};

export default function StaffIndex({ members, canManageManagers }: StaffPageProps) {
    const { auth, tenant } = usePage<PageProps<StaffPageProps>>().props;
    const currentUserId = auth.user.id;

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [existingAccountMode, setExistingAccountMode] = useState(false);
    const [confirmRemoveMember, setConfirmRemoveMember] = useState<StaffMember | null>(null);

    const form = useForm({
        name: '',
        email: '',
        password: '',
        role: 'cashier' as 'manager' | 'cashier',
    });

    const openAddModal = () => {
        form.reset();
        form.clearErrors();
        setExistingAccountMode(false);
        setIsAddModalOpen(true);
    };

    const submitAddStaff: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('staff.store', { tenant: tenant?.slug }), {
            onSuccess: () => {
                form.reset();
                setIsAddModalOpen(false);
            },
        });
    };

    const handleRoleChange = (member: StaffMember, nextRole: 'manager' | 'cashier') => {
        if (member.role === nextRole) return;
        router.patch(
            route('staff.update', { tenant: tenant?.slug, user: member.id }),
            { role: nextRole },
            { preserveScroll: true },
        );
    };

    const handleRemoveConfirmed = () => {
        if (!confirmRemoveMember) return;
        router.delete(route('staff.destroy', { tenant: tenant?.slug, user: confirmRemoveMember.id }), {
            preserveScroll: true,
            onFinish: () => setConfirmRemoveMember(null),
        });
    };

    const canRemove = (member: StaffMember): boolean => {
        if (member.id === currentUserId || member.role === 'owner') {
            return false;
        }
        if (!canManageManagers && member.role !== 'cashier') {
            return false;
        }
        return true;
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Tim & Staf - ${tenant?.name ?? 'Toko'}`} />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Tim & Hak Akses Staf</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Kelola pengguna yang memiliki akses ke <span className="text-slate-200 font-medium">{tenant?.name}</span> ({members.length} anggota).
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={openAddModal}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                    >
                        <UserPlus className="h-4 w-4" />
                        Tambah Staf
                    </button>
                </div>

                {/* Role Reference Strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(['owner', 'manager', 'cashier'] as TenantRole[]).map((roleKey) => {
                        const meta = ROLE_META[roleKey];
                        return (
                            <div
                                key={roleKey}
                                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col gap-1.5"
                            >
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                                    <span
                                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                                    >
                                        {meta.label}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">{meta.desc}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Staff Table */}
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800 text-sm">
                            <thead className="bg-slate-900/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-5 py-3.5">Nama Staf</th>
                                    <th className="px-5 py-3.5">Email</th>
                                    <th className="px-5 py-3.5">Role Toko</th>
                                    <th className="px-5 py-3.5">Bergabung</th>
                                    <th className="px-5 py-3.5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                                {members.map((member) => {
                                    const meta = ROLE_META[member.role] ?? ROLE_META.cashier;
                                    const isSelf = member.id === currentUserId;
                                    const editableRole = canManageManagers && member.role !== 'owner' && !isSelf;

                                    return (
                                        <tr key={member.id} className="hover:bg-slate-900/40 transition-colors">
                                            <td className="px-5 py-4 font-medium text-white whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div>
                                                            {member.name}{' '}
                                                            {isSelf && (
                                                                <span className="ml-1 text-[11px] font-normal text-slate-400">
                                                                    (Anda)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-300 whitespace-nowrap">{member.email}</td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {editableRole ? (
                                                    <select
                                                        aria-label={`Ubah role ${member.name}`}
                                                        value={member.role}
                                                        onChange={(e) =>
                                                            handleRoleChange(
                                                                member,
                                                                e.target.value as 'manager' | 'cashier',
                                                            )
                                                        }
                                                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                    >
                                                        <option value="manager">Manajer</option>
                                                        <option value="cashier">Kasir</option>
                                                    </select>
                                                ) : (
                                                    <span
                                                        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}
                                                    >
                                                        {meta.label}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-slate-400 whitespace-nowrap text-xs">
                                                {member.joined_at
                                                    ? new Date(member.joined_at).toLocaleDateString('id-ID', {
                                                          day: 'numeric',
                                                          month: 'short',
                                                          year: 'numeric',
                                                      })
                                                    : '-'}
                                            </td>
                                            <td className="px-5 py-4 text-right whitespace-nowrap">
                                                {canRemove(member) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmRemoveMember(member)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Cabut Akses
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-600">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Staff Modal */}
            <Modal show={isAddModalOpen} maxWidth="md" onClose={() => setIsAddModalOpen(false)}>
                <form onSubmit={submitAddStaff} className="bg-slate-900 text-slate-100 p-6 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Plus className="h-5 w-5 text-emerald-400" />
                            Tambah Staf ke Toko
                        </h2>
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="text-slate-400 hover:text-white"
                            aria-label="Tutup modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <label className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={existingAccountMode}
                            onChange={(e) => setExistingAccountMode(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-300">
                            Staf sudah memiliki akun QuickRetail (cukup masukkan email)
                        </span>
                    </label>

                    <div className="space-y-4">
                        {!existingAccountMode && (
                            <div>
                                <label htmlFor="staff_name" className="block text-xs font-semibold text-slate-300 mb-1">
                                    Nama Lengkap
                                </label>
                                <input
                                    id="staff_name"
                                    type="text"
                                    required={!existingAccountMode}
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="Contoh: Rina Putri"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <InputError message={form.errors.name} className="mt-1" />
                            </div>
                        )}

                        <div>
                            <label htmlFor="staff_email" className="block text-xs font-semibold text-slate-300 mb-1">
                                Alamat Email
                            </label>
                            <input
                                id="staff_email"
                                type="email"
                                required
                                value={form.data.email}
                                onChange={(e) => form.setData('email', e.target.value)}
                                placeholder="kasir@tokoanda.com"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <InputError message={form.errors.email} className="mt-1" />
                        </div>

                        {!existingAccountMode && (
                            <div>
                                <label
                                    htmlFor="staff_password"
                                    className="block text-xs font-semibold text-slate-300 mb-1"
                                >
                                    Password Awal (minimal 8 karakter)
                                </label>
                                <input
                                    id="staff_password"
                                    type="password"
                                    required={!existingAccountMode}
                                    minLength={8}
                                    value={form.data.password}
                                    onChange={(e) => form.setData('password', e.target.value)}
                                    placeholder="Minimal 8 karakter"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <InputError message={form.errors.password} className="mt-1" />
                            </div>
                        )}

                        <div>
                            <label htmlFor="staff_role" className="block text-xs font-semibold text-slate-300 mb-1">
                                Role di Toko Ini
                            </label>
                            <select
                                id="staff_role"
                                value={form.data.role}
                                onChange={(e) => form.setData('role', e.target.value as 'manager' | 'cashier')}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                                <option value="cashier">Kasir — Terminal POS & Shift</option>
                                {canManageManagers && (
                                    <option value="manager">Manajer — Produk, Stok, Laporan, & Kasir</option>
                                )}
                            </select>
                            <InputError message={form.errors.role} className="mt-1" />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {form.processing ? 'Menyimpan...' : 'Simpan Staf'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Confirm Remove Modal */}
            <Modal show={Boolean(confirmRemoveMember)} maxWidth="sm" onClose={() => setConfirmRemoveMember(null)}>
                <div className="bg-slate-900 text-slate-100 p-6 border border-slate-800">
                    <h2 className="text-base font-bold text-white">Cabut Akses Staf?</h2>
                    <p className="text-sm text-slate-400 mt-2">
                        <span className="text-white font-medium">{confirmRemoveMember?.name}</span> tidak lagi dapat
                        membuka toko <span className="text-white font-medium">{tenant?.name}</span>. Riwayat transaksi
                        sebelumnya tetap tersimpan.
                    </p>
                    <div className="mt-6 flex justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={() => setConfirmRemoveMember(null)}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleRemoveConfirmed}
                            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                        >
                            Ya, Cabut Akses
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
