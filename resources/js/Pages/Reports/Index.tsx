import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { 
    BarChart3, 
    TrendingUp, 
    DollarSign, 
    CreditCard, 
    Receipt, 
    ShoppingBag, 
    Calendar, 
    ArrowUpRight, 
    ShieldAlert, 
    CheckCircle2, 
    AlertTriangle,
    Coins,
    Award
} from 'lucide-react';
import React, { useState } from 'react';
import { Sale, Shift } from '@/types/pos';

interface Props {
    metrics: {
        totalRevenue: number;
        totalHpp: number;
        totalGrossProfit: number;
        totalTransactions: number;
        profitMargin: number;
    };
    paymentBreakdown: {
        payment_type: string;
        total_amount: number;
        count: number;
    }[];
    topProducts: {
        id: number;
        name: string;
        barcode: string;
        total_qty: number;
        total_sales: number;
        total_profit: number;
    }[];
    shiftAudits: Shift[];
    recentSales: {
        data: Sale[];
        links: any[];
        total: number;
    };
    outlets?: {
        id: number;
        name: string;
        code: string;
        is_main: boolean;
    }[];
    filters: {
        start_date: string;
        end_date: string;
        outlet_id?: number | null;
    };
}

export default function ReportsIndex({
    metrics,
    paymentBreakdown,
    topProducts,
    shiftAudits,
    recentSales,
    outlets = [],
    filters,
}: Props) {
    const [startDate, setStartDate] = useState(filters.start_date);
    const [endDate, setEndDate] = useState(filters.end_date);
    const [outletId, setOutletId] = useState(filters.outlet_id ? String(filters.outlet_id) : '');

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('reports.index'), {
            start_date: startDate,
            end_date: endDate,
            outlet_id: outletId || undefined,
        }, { preserveState: true });
    };

    const formatRp = (val: number | string) => {
        const num = Number(val) || 0;
        return 'Rp ' + num.toLocaleString('id-ID');
    };

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Penjualan & Analisis Laba" />

            <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
                {/* Header & Date Range Filter */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                            <BarChart3 className="h-7 w-7 text-emerald-400" />
                            Laporan Keuangan & Analitik Bisnis
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Pantau omset, total HPP, margin laba kotor, dan audit rekonsiliasi kasir secara real-time
                        </p>
                    </div>

                    <form onSubmit={handleFilter} className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
                        {outlets.length > 0 && (
                            <select
                                aria-label="Filter Cabang"
                                value={outletId}
                                onChange={(e) => setOutletId(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">Semua Cabang</option>
                                {outlets.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name} ({o.code})
                                    </option>
                                ))}
                            </select>
                        )}

                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <Calendar className="h-4 w-4 text-emerald-400 ml-2" />
                            <span>Dari:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span>Sampai:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <button
                            type="submit"
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md"
                        >
                            Terapkan
                        </button>
                    </form>
                </div>

                {/* 1. TOP STATS / KPI CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Total Omset */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold">Total Omset Penjualan</span>
                            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                <DollarSign className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-black text-emerald-400 tracking-tight">
                                {formatRp(metrics.totalRevenue)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                Dari {metrics.totalTransactions} transaksi selesai
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Total HPP */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold">Total Modal (HPP)</span>
                            <div className="h-8 w-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                                <ShoppingBag className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-black text-slate-200 tracking-tight">
                                {formatRp(metrics.totalHpp)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                Modal barang yang terjual
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Laba Kotor */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold">Laba Kotor (Gross Profit)</span>
                            <div className="h-8 w-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-black text-teal-300 tracking-tight">
                                {formatRp(metrics.totalGrossProfit)}
                            </div>
                            <div className="text-[11px] text-teal-400 font-semibold mt-1 flex items-center gap-1">
                                <ArrowUpRight className="h-3 w-3" /> Margin Laba: {metrics.profitMargin}%
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Transaksi */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold">Rata-rata Transaksi</span>
                            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                                <Receipt className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-black text-amber-300 tracking-tight">
                                {metrics.totalTransactions > 0 
                                    ? formatRp(metrics.totalRevenue / metrics.totalTransactions)
                                    : 'Rp 0'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                Rata-rata belanja per struk
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. GRID: TOP PRODUCTS & PAYMENT METHODS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Top 10 Fast Moving Products (7 cols) */}
                    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                <Award className="h-4 w-4 text-amber-400" />
                                10 Produk Terlaris (Fast-Moving)
                            </h3>
                            <span className="text-xs text-slate-500">Berdasarkan kuantitas</span>
                        </div>

                        <div className="space-y-3">
                            {topProducts.length === 0 ? (
                                <p className="text-xs text-slate-500 py-6 text-center">Belum ada data penjualan pada periode ini.</p>
                            ) : (
                                topProducts.map((item, idx) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-6 w-6 rounded-lg font-bold flex items-center justify-center text-[10px] ${
                                                idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                                            }`}>
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-200">{item.name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">{item.barcode}</div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="font-bold text-emerald-400">{item.total_qty} Terjual</div>
                                            <div className="text-[10px] text-slate-400">
                                                Omset: {formatRp(item.total_sales)} | Laba: <strong className="text-teal-400">{formatRp(item.total_profit)}</strong>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Payment Breakdown (5 cols) */}
                    <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4">
                                <CreditCard className="h-4 w-4 text-emerald-400" />
                                Komposisi Metode Pembayaran
                            </h3>

                            <div className="space-y-3">
                                {paymentBreakdown.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-6 text-center">Belum ada transaksi.</p>
                                ) : (
                                    paymentBreakdown.map((pm) => {
                                        const percent = metrics.totalRevenue > 0 
                                            ? Math.round((pm.total_amount / metrics.totalRevenue) * 100) 
                                            : 0;
                                        return (
                                            <div key={pm.payment_type} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                                                <div className="flex justify-between text-xs font-semibold text-slate-200">
                                                    <span className="uppercase">{pm.payment_type} ({pm.count} transaksi)</span>
                                                    <span className="text-emerald-400">{formatRp(pm.total_amount)} ({percent}%)</span>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                                    <div 
                                                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 mt-4 flex items-center gap-2">
                            <Coins className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>Pembayaran tunai langsung tercatat dan diakumulasikan ke laci kasir kas aktif.</span>
                        </div>
                    </div>
                </div>

                {/* 3. SHIFT AUDIT & DISCREPANCY RECONCILIATION TABLE */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-rose-400" />
                                Audit Rekonsiliasi Shift Kasir & Selisih Laci
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Deteksi kecocokan antara uang fisik kasir dengan perhitungan sistem saat tutup shift
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/80 border-b border-slate-800 uppercase font-bold text-[10px] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Kasir</th>
                                    <th className="px-4 py-3">Waktu Buka</th>
                                    <th className="px-4 py-3">Waktu Tutup</th>
                                    <th className="px-4 py-3">Modal Awal</th>
                                    <th className="px-4 py-3">Ekspektasi Sistem</th>
                                    <th className="px-4 py-3">Uang Fisik Kasir</th>
                                    <th className="px-4 py-3">Selisih Kas</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                                {shiftAudits.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-6 text-slate-500">
                                            Tidak ada riwayat shift pada rentang tanggal ini.
                                        </td>
                                    </tr>
                                ) : (
                                    shiftAudits.map((shift) => {
                                        const diff = Number(shift.difference) || 0;
                                        const isBalanced = shift.status === 'closed' && diff === 0;
                                        const isDeficit = shift.status === 'closed' && diff < 0;
                                        const isSurplus = shift.status === 'closed' && diff > 0;

                                        return (
                                            <tr key={shift.id} className="hover:bg-slate-800/40 transition">
                                                <td className="px-4 py-3 font-bold text-slate-200">
                                                    <div>{shift.user?.name || 'Kasir'}</div>
                                                    {shift.outlet && (
                                                        <div className="text-[10px] font-mono font-normal text-slate-400">
                                                            {shift.outlet.name} ({shift.outlet.code})
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-slate-400">
                                                    {new Date(shift.opened_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                                                </td>
                                                <td className="px-4 py-3 text-slate-400">
                                                    {shift.closed_at 
                                                        ? new Date(shift.closed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                                                        : <span className="text-amber-400 font-bold">Sedang Aktif</span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono">{formatRp(shift.starting_cash)}</td>
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-400">{formatRp(shift.expected_cash)}</td>
                                                <td className="px-4 py-3 font-mono">
                                                    {shift.actual_cash !== null ? formatRp(shift.actual_cash) : '-'}
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold">
                                                    {shift.status === 'closed' ? (
                                                        <span className={isBalanced ? 'text-emerald-400' : isSurplus ? 'text-blue-400' : 'text-rose-400'}>
                                                            {isBalanced ? 'Rp 0' : (isSurplus ? `+${formatRp(diff)}` : `-${formatRp(Math.abs(diff))}`)}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {shift.status === 'open' ? (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                                            Aktif
                                                        </span>
                                                    ) : isBalanced ? (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                                            Seimbang
                                                        </span>
                                                    ) : isSurplus ? (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                                                            Lebih Kas
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                                                            Defisit / Kurang
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. RECENT TRANSACTIONS LEDGER */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-emerald-400" />
                        Histori Transaksi Kasir Terakhir
                    </h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/80 border-b border-slate-800 uppercase font-bold text-[10px] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">No. Invoice</th>
                                    <th className="px-4 py-3">Waktu</th>
                                    <th className="px-4 py-3">Kasir</th>
                                    <th className="px-4 py-3">Pelanggan</th>
                                    <th className="px-4 py-3">Metode</th>
                                    <th className="px-4 py-3">Total Belanja</th>
                                    <th className="px-4 py-3">Laba Kotor</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                                {recentSales.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-6 text-slate-500">
                                            Belum ada data transaksi pada rentang tanggal ini.
                                        </td>
                                    </tr>
                                ) : (
                                    recentSales.data.map((sale) => {
                                        const profit = Number(sale.grand_total) - Number(sale.total_buy_price);
                                        return (
                                            <tr key={sale.id} className="hover:bg-slate-800/40 transition">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                                                    <div>{sale.invoice_no}</div>
                                                    {sale.outlet && (
                                                        <div className="text-[10px] font-normal text-slate-400">
                                                            {sale.outlet.code}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-slate-400">
                                                    {new Date(sale.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                                                </td>
                                                <td className="px-4 py-3 text-slate-300">{sale.cashier?.name || 'Kasir'}</td>
                                                <td className="px-4 py-3 text-slate-300">{sale.customer_name}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] uppercase font-semibold">
                                                        {sale.payment_details?.[0]?.payment_type || 'Tunai'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-100">{formatRp(sale.grand_total)}</td>
                                                <td className="px-4 py-3 font-bold text-teal-300">+{formatRp(profit)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                                        Selesai
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
