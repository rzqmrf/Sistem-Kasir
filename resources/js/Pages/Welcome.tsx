import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Check, Store } from 'lucide-react';
import { useState } from 'react';

interface PublicPlan {
    id: number;
    code: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    limits: {
        outlets: number | null;
        users: number | null;
        products: number | null;
    };
}

type WelcomeProps = PageProps<{
    canLogin: boolean;
    canRegister: boolean;
    plans: PublicPlan[];
    trialDays: number;
}>;

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
}

function describeLimit(limit: number | null, label: string): string {
    return limit === null ? `${label} tanpa batas` : `Hingga ${limit.toLocaleString('id-ID')} ${label}`;
}

export default function Welcome({ auth, canLogin, canRegister, plans, trialDays }: WelcomeProps) {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    return (
        <>
            <Head title="Kasir POS Multi-Cabang untuk Toko Ritel" />

            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
                <header className="border-b border-slate-800/80 bg-slate-950 sticky top-0 z-30">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <Link href="/" className="flex items-center gap-2.5">
                                <span className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                                    <Store className="h-5 w-5 text-white" />
                                </span>
                                <span className="font-bold text-base tracking-tight text-white">
                                    QuickRetail POS
                                </span>
                            </Link>

                            <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-300">
                                <a href="#operasional" className="hover:text-white transition-colors">
                                    Operasional Toko
                                </a>
                                <a href="#harga" className="hover:text-white transition-colors">
                                    Paket & Harga
                                </a>
                            </nav>
                        </div>

                        <div className="flex items-center gap-2.5">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                                >
                                    Buka Terminal Toko
                                </Link>
                            ) : (
                                <>
                                    {canLogin && (
                                        <Link
                                            href={route('login')}
                                            className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900 transition-colors"
                                        >
                                            Masuk
                                        </Link>
                                    )}
                                    {canRegister && (
                                        <Link
                                            href={route('register')}
                                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                                        >
                                            Daftar Toko Baru
                                        </Link>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1">
                    {/* Hero: Asymmetric 2-column operational pitch + concrete cashier preview */}
                    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                            <div className="lg:col-span-7 space-y-5">
                                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-white leading-[1.15]">
                                    Kasir ritel multi-cabang dengan kontrol laci kas, harga grosir, dan stok terpisah per toko.
                                </h1>

                                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                                    Daftarkan toko Anda, buka shift kasir, pindai barcode produk dengan potongan harga grosir otomatis, dan pantau laba kotor setiap cabang dalam satu akun.
                                </p>

                                <div className="pt-2 flex flex-wrap items-center gap-3">
                                    {auth.user ? (
                                        <Link
                                            href={route('dashboard')}
                                            className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                                        >
                                            Lanjut ke Terminal Kasir
                                        </Link>
                                    ) : (
                                        <>
                                            {canRegister && (
                                                <Link
                                                    href={route('register')}
                                                    className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                                                >
                                                    Buat Toko & Coba Paket Pro {trialDays} Hari
                                                </Link>
                                            )}
                                            {canLogin && (
                                                <Link
                                                    href={route('login')}
                                                    className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                                                >
                                                    Masuk Akun Staf / Owner
                                                </Link>
                                            )}
                                        </>
                                    )}
                                </div>

                                <p className="text-xs text-slate-400">
                                    Tanpa kartu kredit saat pendaftaran. Setelah masa coba {trialDays} hari selesai, Anda tetap dapat memakai paket Starter gratis atau berlangganan via Midtrans.
                                </p>
                            </div>

                            {/* Honest labeled operational preview */}
                            <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900 p-5">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div>
                                        <div className="text-xs font-semibold text-white">
                                            Contoh Struk & Shift Cabang
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Ilustrasi tampilan transaksi pada terminal kasir
                                        </div>
                                    </div>
                                    <span className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                                        CONTOH DATA
                                    </span>
                                </div>

                                <div className="mt-4 space-y-2.5 text-xs">
                                    <div className="flex items-center justify-between text-slate-300">
                                        <div>
                                            <div className="font-medium text-white">Indomie Goreng 85g x 40 pcs</div>
                                            <div className="text-[11px] text-emerald-400">
                                                Harga grosir dus aktif (@ Rp 3.000)
                                            </div>
                                        </div>
                                        <span className="font-mono font-semibold text-white">Rp 120.000</span>
                                    </div>

                                    <div className="flex items-center justify-between text-slate-300">
                                        <div>
                                            <div className="font-medium text-white">Minyak Goreng 2L Pouch x 2</div>
                                            <div className="text-[11px] text-emerald-400">
                                                Harga bertingkat min. 2 (@ Rp 35.000)
                                            </div>
                                        </div>
                                        <span className="font-mono font-semibold text-white">Rp 70.000</span>
                                    </div>

                                    <div className="border-t border-slate-800 pt-3 mt-3 space-y-1.5">
                                        <div className="flex justify-between text-slate-400">
                                            <span>Cabang Aktif</span>
                                            <span className="font-mono text-slate-200">PUSAT (Shift Pagi)</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                            <span>Metode Pembayaran</span>
                                            <span className="text-slate-200">QRIS / Tunai / Transfer</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-white pt-1">
                                            <span>Total Tagihan</span>
                                            <span className="font-mono text-emerald-400">Rp 190.000</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Operational Capabilities: Flagship full-width block + 3 supporting items */}
                    <section
                        id="operasional"
                        className="border-t border-slate-900 bg-slate-900/50 py-14"
                    >
                        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
                            <div className="max-w-2xl">
                                <h2 className="text-xl sm:text-2xl font-bold text-white">
                                    Dirancang untuk alur kerja warung modern, minimarket, dan toko grosir
                                </h2>
                                <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
                                    Setiap fitur langsung terhubung ke stok cabang, laci uang kasir, dan perhitungan HPP.
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                <div className="md:col-span-7 space-y-2">
                                    <h3 className="text-base font-bold text-white">
                                        Isolasi Multi-Toko & Manajemen Stok Multi-Cabang
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                        Satu akun pemilik dapat mengelola beberapa toko terpisah maupun banyak cabang di dalam satu toko. Stok barang dicatat per cabang, pemindahan barang antar-cabang terekam otomatis di mutasi stok, dan laporan omzet serta laba kotor dapat disaring per cabang.
                                    </p>
                                </div>
                                <dl className="md:col-span-5 grid grid-cols-2 gap-3 text-xs border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
                                    <div>
                                        <dt className="text-slate-400">Pemisahan Data</dt>
                                        <dd className="mt-0.5 font-semibold text-slate-100">
                                            Per URL toko (/t/nama-toko)
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-slate-400">Transfer Stok</dt>
                                        <dd className="mt-0.5 font-semibold text-slate-100">
                                            Mutasi keluar/masuk atomik
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-slate-400">Hak Akses Tim</dt>
                                        <dd className="mt-0.5 font-semibold text-slate-100">
                                            Owner, Manajer, dan Kasir
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-slate-400">Riwayat Audit</dt>
                                        <dd className="mt-0.5 font-semibold text-slate-100">
                                            Rekam pelaku & selisih nilai
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                                    <h3 className="text-sm font-bold text-white">
                                        Harga Bertingkat & Tahan Antrean
                                    </h3>
                                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                                        Atur harga eceran dan beberapa tingkatan harga grosir per produk. Kasir juga dapat menahan keranjang pembeli sementara untuk melayani antrean berikutnya.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                                    <h3 className="text-sm font-bold text-white">
                                        Rekonsiliasi Laci Kas per Shift
                                    </h3>
                                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                                        Catat modal awal saat buka shift, kas masuk/keluar operasional, dan hitung selisih uang fisik terhadap uang tunai sistem saat tutup shift.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                                    <h3 className="text-sm font-bold text-white">
                                        Laporan Laba Kotor & HPP
                                    </h3>
                                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                                        Harga beli tersimpan pada setiap item penjualan sehingga perhitungan laba kotor tetap akurat meskipun harga beli stok baru berubah di kemudian hari.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Pricing: Driven directly by real Plan rows from database */}
                    <section id="harga" className="py-14 border-t border-slate-900">
                        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                                        Paket Langganan Transparan
                                    </h2>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-400">
                                        Toko baru langsung memperoleh masa coba Paket Pro selama {trialDays} hari.
                                    </p>
                                </div>

                                <div
                                    role="group"
                                    aria-label="Siklus harga"
                                    className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1 self-start"
                                >
                                    <button
                                        type="button"
                                        aria-pressed={billingCycle === 'monthly'}
                                        onClick={() => setBillingCycle('monthly')}
                                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                            billingCycle === 'monthly'
                                                ? 'bg-emerald-600 text-white'
                                                : 'text-slate-300 hover:text-white'
                                        }`}
                                    >
                                        Bulanan
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={billingCycle === 'yearly'}
                                        onClick={() => setBillingCycle('yearly')}
                                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                            billingCycle === 'yearly'
                                                ? 'bg-emerald-600 text-white'
                                                : 'text-slate-300 hover:text-white'
                                        }`}
                                    >
                                        Tahunan (Bayar 10 Bulan)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {plans.map((plan) => {
                                    const isFree = plan.price_monthly === 0;
                                    const price =
                                        billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

                                    return (
                                        <div
                                            key={plan.id}
                                            className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col justify-between"
                                        >
                                            <div>
                                                <h3 className="text-base font-bold text-white">
                                                    Paket {plan.name}
                                                </h3>

                                                <div className="mt-3 flex items-baseline gap-1.5">
                                                    <span className="text-2xl font-bold text-white">
                                                        {isFree ? 'Gratis' : formatRupiah(price)}
                                                    </span>
                                                    {!isFree && (
                                                        <span className="text-xs text-slate-400">
                                                            / {billingCycle === 'yearly' ? 'tahun' : 'bulan'}
                                                        </span>
                                                    )}
                                                </div>

                                                <ul className="mt-5 pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
                                                    <li className="flex items-center gap-2">
                                                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                                                        <span>
                                                            {describeLimit(plan.limits.outlets, 'cabang aktif')}
                                                        </span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                                                        <span>
                                                            {describeLimit(plan.limits.users, 'anggota tim')}
                                                        </span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                                                        <span>
                                                            {describeLimit(plan.limits.products, 'SKU produk')}
                                                        </span>
                                                    </li>
                                                </ul>
                                            </div>

                                            <div className="mt-6">
                                                {auth.user ? (
                                                    <Link
                                                        href={route('dashboard')}
                                                        className="block w-full text-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                                                    >
                                                        Kelola dari Dashboard Toko
                                                    </Link>
                                                ) : (
                                                    canRegister && (
                                                        <Link
                                                            href={route('register')}
                                                            className={`block w-full text-center rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                                                                plan.code === 'pro'
                                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                                    : 'border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                                                            }`}
                                                        >
                                                            {plan.code === 'pro'
                                                                ? `Coba Paket Pro ${trialDays} Hari`
                                                                : `Mulai dengan ${plan.name}`}
                                                        </Link>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="border-t border-slate-900 py-8">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                        <span>QuickRetail POS · Platform Kasir Ritel Multi-Cabang</span>
                        <div className="flex items-center gap-5">
                            <a href="#operasional" className="hover:text-slate-200">
                                Operasional
                            </a>
                            <a href="#harga" className="hover:text-slate-200">
                                Harga
                            </a>
                            {canLogin && (
                                <Link href={route('login')} className="hover:text-slate-200">
                                    Masuk
                                </Link>
                            )}
                            {canRegister && (
                                <Link href={route('register')} className="hover:text-slate-200">
                                    Daftar Toko
                                </Link>
                            )}
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
