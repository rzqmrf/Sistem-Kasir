import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { SubscriptionStatus } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Search, Shield, X } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface AdminTenantRow {
    id: number;
    name: string;
    slug: string;
    status: 'active' | 'suspended';
    created_at: string | null;
    owner: {
        name: string;
        email: string;
    } | null;
    subscription: {
        plan_name: string;
        plan_code: string;
        status: SubscriptionStatus;
        days_left: number | null;
    };
    counts: {
        outlets: number;
        users: number;
        products: number;
    };
}

interface PaginatedTenants {
    data: AdminTenantRow[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface PlatformInvoiceRow {
    id: number;
    number: string;
    period_months: number;
    amount: number;
    status: 'pending' | 'paid' | 'failed' | 'expired';
    paid_at: string | null;
    created_at: string;
    tenant?: {
        id: number;
        name: string;
        slug: string;
    } | null;
    plan?: {
        id: number;
        name: string;
        code: string;
    } | null;
}

interface AdminPageProps extends Record<string, unknown> {
    metrics: {
        total_tenants: number;
        active_tenants: number;
        suspended_tenants: number;
        trialing_tenants: number;
        mrr: number;
        revenue_30d: number;
    };
    tenantList: PaginatedTenants;
    recentInvoices: PlatformInvoiceRow[];
    filters: {
        search: string;
        status: string;
    };
}

const SUB_STATUS_LABELS: Record<SubscriptionStatus, string> = {
    trialing: 'Trial',
    active: 'Aktif',
    past_due: 'Masa Tenggang',
    expired: 'Kedaluwarsa',
};

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export default function SuperAdminIndex({ metrics, tenantList, recentInvoices, filters }: AdminPageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [confirmTarget, setConfirmTarget] = useState<AdminTenantRow | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const applyFilters = (nextSearch: string, nextStatus: string) => {
        router.get(
            route('admin.index'),
            {
                ...(nextSearch.trim() ? { search: nextSearch.trim() } : {}),
                ...(nextStatus ? { status: nextStatus } : {}),
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        applyFilters(search, status);
    };

    const confirmStatusToggle = () => {
        if (!confirmTarget) return;
        const nextStatus = confirmTarget.status === 'active' ? 'suspended' : 'active';
        setSubmitting(true);
        router.patch(
            route('admin.tenants.status', { tenant: confirmTarget.slug }),
            { status: nextStatus },
            {
                preserveScroll: true,
                onFinish: () => {
                    setSubmitting(false);
                    setConfirmTarget(null);
                },
            },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <Shield className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">
                                Panel Super Admin Platform
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Pemantauan seluruh toko terdaftar, pendapatan berulang bulanan (MRR), dan kontrol status tenant.
                            </p>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title="Super Admin Platform" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
                {/* Ringkasan Metrik Nyata Platform */}
                <section aria-label="Metrik Platform" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="text-xs font-medium text-slate-400">MRR Aktif</div>
                        <div className="mt-1.5 text-2xl font-bold text-white">{formatRupiah(metrics.mrr)}</div>
                        <div className="mt-1 text-[11px] text-slate-400">
                            Dari paket berbayar berstatus aktif
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="text-xs font-medium text-slate-400">Pembayaran Masuk (30 Hari)</div>
                        <div className="mt-1.5 text-2xl font-bold text-emerald-400">
                            {formatRupiah(metrics.revenue_30d)}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">Total invoice lunas 30 hari terakhir</div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="text-xs font-medium text-slate-400">Toko Aktif / Total</div>
                        <div className="mt-1.5 text-2xl font-bold text-white">
                            {metrics.active_tenants.toLocaleString('id-ID')}{' '}
                            <span className="text-sm font-normal text-slate-400">
                                / {metrics.total_tenants.toLocaleString('id-ID')}
                            </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                            {metrics.trialing_tenants.toLocaleString('id-ID')} toko sedang masa coba
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="text-xs font-medium text-slate-400">Toko Ditangguhkan</div>
                        <div className="mt-1.5 text-2xl font-bold text-rose-300">
                            {metrics.suspended_tenants.toLocaleString('id-ID')}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                            Akses operasional dikunci sementara
                        </div>
                    </div>
                </section>

                {/* Direktori Tenant */}
                <section aria-labelledby="tenants-heading" className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h2 id="tenants-heading" className="text-base font-bold text-white">
                            Daftar Toko (Tenant)
                        </h2>

                        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <label htmlFor="tenant-search" className="sr-only">
                                    Cari toko
                                </label>
                                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    id="tenant-search"
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Nama toko atau slug..."
                                    className="rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            <label htmlFor="tenant-status" className="sr-only">
                                Filter status toko
                            </label>
                            <select
                                id="tenant-status"
                                value={status}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setStatus(next);
                                    applyFilters(search, next);
                                }}
                                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                            >
                                <option value="">Semua Status</option>
                                <option value="active">Aktif</option>
                                <option value="suspended">Ditangguhkan</option>
                            </select>

                            <button
                                type="submit"
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                                Cari
                            </button>

                            {(filters.search || filters.status) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        setStatus('');
                                        applyFilters('', '');
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Reset
                                </button>
                            )}
                        </form>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                        {tenantList.data.length === 0 ? (
                            <div className="px-6 py-10 text-center text-xs text-slate-400">
                                Tidak ditemukan toko yang sesuai dengan pencarian saat ini.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Toko</th>
                                            <th className="px-4 py-3 font-semibold">Pemilik</th>
                                            <th className="px-4 py-3 font-semibold">Paket & Langganan</th>
                                            <th className="px-4 py-3 font-semibold">Pemakaian</th>
                                            <th className="px-4 py-3 font-semibold">Status</th>
                                            <th className="px-4 py-3 font-semibold text-right">Kontrol</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/80 text-slate-200">
                                        {tenantList.data.map((row) => {
                                            const isActive = row.status === 'active';
                                            return (
                                                <tr key={row.id} className="hover:bg-slate-900/40">
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="font-semibold text-white">{row.name}</div>
                                                        <div className="text-[11px] font-mono text-slate-400">
                                                            /t/{row.slug} · daftar {formatDate(row.created_at)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {row.owner ? (
                                                            <div>
                                                                <div className="text-slate-100">{row.owner.name}</div>
                                                                <div className="text-[11px] text-slate-400">
                                                                    {row.owner.email}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="font-semibold text-slate-100">
                                                            {row.subscription.plan_name}
                                                        </span>
                                                        <div className="text-[11px] text-slate-400">
                                                            {SUB_STATUS_LABELS[row.subscription.status] ??
                                                                row.subscription.status}
                                                            {row.subscription.days_left !== null
                                                                ? ` (${row.subscription.days_left} hari)`
                                                                : ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                                                        {row.counts.outlets} cabang · {row.counts.users} tim ·{' '}
                                                        {row.counts.products} SKU
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                                                                isActive
                                                                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                                                                    : 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                                                            }`}
                                                        >
                                                            {isActive ? 'Aktif' : 'Ditangguhkan'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmTarget(row)}
                                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                                isActive
                                                                    ? 'border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                                                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                            }`}
                                                        >
                                                            {isActive ? 'Tangguhkan' : 'Aktifkan'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {tenantList.last_page > 1 && (
                            <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                <span>
                                    Halaman {tenantList.current_page} dari {tenantList.last_page}
                                </span>
                                <div className="flex items-center gap-2">
                                    {tenantList.prev_page_url && (
                                        <Link
                                            href={tenantList.prev_page_url}
                                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                                        >
                                            Sebelumnya
                                        </Link>
                                    )}
                                    {tenantList.next_page_url && (
                                        <Link
                                            href={tenantList.next_page_url}
                                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                                        >
                                            Berikutnya
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Invoice Lintas Tenant Terbaru */}
                <section
                    aria-labelledby="platform-invoices-heading"
                    className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden"
                >
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                        <h2 id="platform-invoices-heading" className="text-sm font-bold text-white">
                            Invoice Langganan Terbaru (Seluruh Toko)
                        </h2>
                        <span className="text-xs text-slate-400">{recentInvoices.length} transaksi terakhir</span>
                    </div>

                    {recentInvoices.length === 0 ? (
                        <div className="px-5 py-8 text-center text-xs text-slate-400">
                            Belum ada transaksi invoice berbayar di seluruh platform.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Nomor Invoice</th>
                                        <th className="px-4 py-3 font-semibold">Toko</th>
                                        <th className="px-4 py-3 font-semibold">Paket</th>
                                        <th className="px-4 py-3 font-semibold">Nominal</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold">Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                                    {recentInvoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-slate-900/40">
                                            <td className="px-4 py-3 font-mono text-white whitespace-nowrap">
                                                {inv.number}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {inv.tenant ? inv.tenant.name : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {inv.plan?.name ?? '-'} ({inv.period_months} bln)
                                            </td>
                                            <td className="px-4 py-3 font-semibold whitespace-nowrap">
                                                {formatRupiah(inv.amount)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap uppercase font-mono text-[11px]">
                                                {inv.status}
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                                {formatDate(inv.paid_at ?? inv.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <Modal show={confirmTarget !== null} maxWidth="md" onClose={() => setConfirmTarget(null)}>
                {confirmTarget && (
                    <div className="bg-slate-900 text-slate-100 p-6 border border-slate-800">
                        <h3 className="text-base font-bold text-white">
                            {confirmTarget.status === 'active'
                                ? `Tangguhkan ${confirmTarget.name}?`
                                : `Aktifkan kembali ${confirmTarget.name}?`}
                        </h3>
                        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                            {confirmTarget.status === 'active'
                                ? 'Seluruh anggota tim toko ini tidak akan dapat membuka halaman kasir, produk, maupun laporan sampai status diaktifkan kembali.'
                                : 'Pemilik dan staf toko akan dapat mengakses kembali terminal kasir serta data operasional toko.'}
                        </p>

                        <div className="mt-6 flex justify-end gap-2.5">
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setConfirmTarget(null)}
                                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={confirmStatusToggle}
                                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                                    confirmTarget.status === 'active'
                                        ? 'bg-rose-600 hover:bg-rose-500'
                                        : 'bg-emerald-600 hover:bg-emerald-500'
                                }`}
                            >
                                {submitting
                                    ? 'Menyimpan...'
                                    : confirmTarget.status === 'active'
                                      ? 'Ya, Tangguhkan Toko'
                                      : 'Ya, Aktifkan Toko'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}
