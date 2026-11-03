import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { History, Search, X } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface AuditChangeEntry {
    before: string | number | boolean | null;
    after: string | number | boolean | null;
}

interface AuditLogEntry {
    id: number;
    action: string;
    subject_type: string | null;
    subject_id: number | null;
    summary: string;
    changes: Record<string, AuditChangeEntry> | null;
    ip_address: string | null;
    created_at: string;
    user?: {
        id: number;
        name: string;
        email: string;
    } | null;
}

interface PaginatedAuditLogs {
    data: AuditLogEntry[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface AuditLogPageProps extends Record<string, unknown> {
    logs: PaginatedAuditLogs;
    filters: {
        category: string;
        search: string;
    };
}

const ACTION_BADGES: Record<string, { label: string; className: string }> = {
    product: {
        label: 'Produk & Stok',
        className: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    },
    staff: {
        label: 'Tim & Staf',
        className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    outlet: {
        label: 'Cabang',
        className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
    billing: {
        label: 'Langganan',
        className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    },
    tenant: {
        label: 'Status Toko',
        className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    },
};

function formatChangeValue(val: string | number | boolean | null): string {
    if (val === null || val === undefined || val === '') return 'kosong';
    if (typeof val === 'boolean') return val ? 'aktif' : 'nonaktif';
    if (typeof val === 'number') return val.toLocaleString('id-ID');
    return String(val);
}

function formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function AuditLogsIndex({ logs, filters }: AuditLogPageProps) {
    const { tenant } = usePage<PageProps<AuditLogPageProps>>().props;
    const [search, setSearch] = useState(filters.search ?? '');
    const [category, setCategory] = useState(filters.category ?? '');

    const applyFilters = (nextSearch: string, nextCategory: string) => {
        if (!tenant) return;
        router.get(
            route('audit-logs.index', { tenant: tenant.slug }),
            {
                ...(nextSearch.trim() ? { search: nextSearch.trim() } : {}),
                ...(nextCategory ? { category: nextCategory } : {}),
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        applyFilters(search, category);
    };

    const handleReset = () => {
        setSearch('');
        setCategory('');
        applyFilters('', '');
    };

    const isFiltered = Boolean(filters.search || filters.category);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Riwayat Audit Toko</h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Catatan perubahan harga produk, penyesuaian stok, mutasi staf, dan langganan di {tenant?.name}.
                        </p>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                        Total {logs.total.toLocaleString('id-ID')} aktivitas
                    </span>
                </div>
            }
        >
            <Head title="Riwayat Audit" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-5">
                <form
                    onSubmit={handleSearchSubmit}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row gap-3"
                >
                    <div className="relative flex-1">
                        <label htmlFor="audit-search" className="sr-only">
                            Cari ringkasan aktivitas
                        </label>
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            id="audit-search"
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama produk, email staf, atau nomor invoice..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="audit-category" className="sr-only">
                            Filter kategori aktivitas
                        </label>
                        <select
                            id="audit-category"
                            value={category}
                            onChange={(e) => {
                                const next = e.target.value;
                                setCategory(next);
                                applyFilters(search, next);
                            }}
                            className="w-full sm:w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value="">Semua Kategori</option>
                            <option value="product">Produk & Stok</option>
                            <option value="staff">Tim & Staf</option>
                            <option value="outlet">Cabang</option>
                            <option value="billing">Langganan</option>
                            <option value="tenant">Status Toko</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                            Terapkan
                        </button>
                        {isFiltered && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                            >
                                <X className="h-3.5 w-3.5" />
                                Reset
                            </button>
                        )}
                    </div>
                </form>

                <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                    {logs.data.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <History className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-300">
                                {isFiltered
                                    ? 'Tidak ada aktivitas audit yang cocok dengan filter saat ini.'
                                    : 'Belum ada perubahan sensitif yang tercatat di toko ini.'}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                {isFiltered
                                    ? 'Ubah kata kunci pencarian atau pilih Semua Kategori untuk menampilkan seluruh riwayat.'
                                    : 'Setiap penambahan/perubahan harga produk, penyesuaian stok, mutasi staf, dan pembayaran paket akan muncul di sini.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Waktu</th>
                                        <th className="px-4 py-3 font-semibold">Pelaku</th>
                                        <th className="px-4 py-3 font-semibold">Kategori</th>
                                        <th className="px-4 py-3 font-semibold">Ringkasan & Detail Perubahan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80 text-slate-200 align-top">
                                    {logs.data.map((entry) => {
                                        const prefix = entry.action.split('.')[0] ?? '';
                                        const badge = ACTION_BADGES[prefix] ?? {
                                            label: entry.action,
                                            className: 'bg-slate-800 text-slate-300 border-slate-700',
                                        };
                                        const changeEntries = entry.changes ? Object.entries(entry.changes) : [];

                                        return (
                                            <tr key={entry.id} className="hover:bg-slate-900/40">
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono">
                                                    <div>{formatTimestamp(entry.created_at)}</div>
                                                    {entry.ip_address && (
                                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                                            IP {entry.ip_address}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {entry.user ? (
                                                        <div>
                                                            <div className="font-semibold text-slate-100">
                                                                {entry.user.name}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {entry.user.email}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">Sistem / Webhook</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                                                        {entry.action}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-slate-100 font-medium">{entry.summary}</div>
                                                    {changeEntries.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {changeEntries.map(([field, diff]) => (
                                                                <span
                                                                    key={field}
                                                                    className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                                                                >
                                                                    <span className="text-slate-400">{field}:</span>
                                                                    <span className="text-rose-300">
                                                                        {formatChangeValue(diff.before)}
                                                                    </span>
                                                                    <span className="text-slate-500">-&gt;</span>
                                                                    <span className="text-emerald-300">
                                                                        {formatChangeValue(diff.after)}
                                                                    </span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {logs.last_page > 1 && (
                        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <span>
                                Halaman {logs.current_page} dari {logs.last_page}
                            </span>
                            <div className="flex items-center gap-2">
                                {logs.prev_page_url ? (
                                    <Link
                                        href={logs.prev_page_url}
                                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                                    >
                                        Sebelumnya
                                    </Link>
                                ) : (
                                    <span className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">
                                        Sebelumnya
                                    </span>
                                )}
                                {logs.next_page_url ? (
                                    <Link
                                        href={logs.next_page_url}
                                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                                    >
                                        Berikutnya
                                    </Link>
                                ) : (
                                    <span className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">
                                        Berikutnya
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
