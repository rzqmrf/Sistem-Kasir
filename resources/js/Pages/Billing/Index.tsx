import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, SubscriptionStatus } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, Check, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface PlanLimitMap {
    outlets: number | null;
    users: number | null;
    products: number | null;
}

interface OverageItem {
    used: number;
    limit: number;
}

interface BillingPlan {
    id: number;
    code: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    limits: PlanLimitMap;
    overages: Partial<Record<keyof PlanLimitMap, OverageItem>>;
}

interface BillingInvoice {
    id: number;
    number: string;
    period_months: number;
    amount: number;
    status: 'pending' | 'paid' | 'failed' | 'expired';
    payment_type: string | null;
    snap_token: string | null;
    snap_redirect_url: string | null;
    paid_at: string | null;
    expires_at: string | null;
    created_at: string;
    plan?: {
        id: number;
        name: string;
        code: string;
    };
}

interface BillingPageProps extends Record<string, unknown> {
    currentSubscription: {
        plan: {
            id: number;
            code: string;
            name: string;
            price_monthly: number;
        };
        status: SubscriptionStatus;
        current_period_end: string | null;
        days_left: number | null;
    };
    usage: {
        outlets: number;
        users: number;
        products: number;
    };
    limits: PlanLimitMap;
    plans: BillingPlan[];
    invoices: BillingInvoice[];
    gateway: {
        simulator: boolean;
        can_simulate: boolean;
        client_key: string | null;
        snap_script_url: string;
    };
}

const STATUS_META: Record<SubscriptionStatus, { label: string; badgeClass: string }> = {
    trialing: {
        label: 'Masa Coba',
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    },
    active: {
        label: 'Aktif',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
    past_due: {
        label: 'Masa Tenggang',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    expired: {
        label: 'Kedaluwarsa (Baca-Saja)',
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    },
};

const INVOICE_STATUS_META: Record<BillingInvoice['status'], { label: string; badgeClass: string }> = {
    pending: {
        label: 'Menunggu Bayar',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    paid: {
        label: 'Lunas',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
    failed: {
        label: 'Gagal',
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    },
    expired: {
        label: 'Kedaluwarsa',
        badgeClass: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
    },
};

const RESOURCE_LABELS: Record<keyof PlanLimitMap, string> = {
    outlets: 'Cabang Aktif',
    users: 'Anggota Tim',
    products: 'Katalog Produk',
};

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function describeLimit(limit: number | null, unit: string): string {
    return limit === null ? `${unit} tanpa batas` : `Maks. ${limit.toLocaleString('id-ID')} ${unit}`;
}

export default function BillingIndex({
    currentSubscription,
    usage,
    limits,
    plans,
    invoices,
    gateway,
}: BillingPageProps) {
    const { tenant, flash } = usePage<PageProps<BillingPageProps>>().props;
    const [periodMonths, setPeriodMonths] = useState<1 | 12>(1);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [snapReady, setSnapReady] = useState(false);
    const openedInvoiceRef = useRef<number | null>(null);

    useEffect(() => {
        if (gateway.simulator || !gateway.client_key || typeof document === 'undefined') {
            return;
        }

        if (window.snap) {
            setSnapReady(true);
            return;
        }

        const existing = document.querySelector<HTMLScriptElement>('script[data-midtrans-snap="true"]');
        if (existing) {
            const onLoad = () => setSnapReady(true);
            existing.addEventListener('load', onLoad);
            return () => existing.removeEventListener('load', onLoad);
        }

        const script = document.createElement('script');
        script.src = gateway.snap_script_url;
        script.async = true;
        script.dataset.midtransSnap = 'true';
        script.setAttribute('data-client-key', gateway.client_key);
        script.onload = () => setSnapReady(true);
        document.body.appendChild(script);
    }, [gateway.simulator, gateway.client_key, gateway.snap_script_url]);

    const handleCheckStatus = useCallback(
        (invoiceId: number) => {
            if (!tenant) return;
            setBusyAction(`check-${invoiceId}`);
            router.post(
                route('billing.check-status', { tenant: tenant.slug, invoice: invoiceId }),
                {},
                {
                    preserveScroll: true,
                    onFinish: () => setBusyAction(null),
                },
            );
        },
        [tenant],
    );

    const openSnapPayment = useCallback(
        (invoice: BillingInvoice) => {
            if (!invoice.snap_token) return;

            if (window.snap) {
                window.snap.pay(invoice.snap_token, {
                    onSuccess: () => handleCheckStatus(invoice.id),
                    onPending: () => handleCheckStatus(invoice.id),
                });
                return;
            }

            if (invoice.snap_redirect_url) {
                window.open(invoice.snap_redirect_url, '_blank', 'noopener,noreferrer');
            }
        },
        [handleCheckStatus],
    );

    useEffect(() => {
        const payId = flash?.pay_invoice_id;
        if (!payId || gateway.simulator || !snapReady || openedInvoiceRef.current === payId) {
            return;
        }

        const target = invoices.find((inv) => inv.id === payId && inv.status === 'pending');
        if (target) {
            openedInvoiceRef.current = payId;
            openSnapPayment(target);
        }
    }, [flash?.pay_invoice_id, gateway.simulator, snapReady, invoices, openSnapPayment]);

    const handleCheckout = (planCode: string) => {
        if (!tenant) return;
        setBusyAction(`checkout-${planCode}`);
        router.post(
            route('billing.checkout', { tenant: tenant.slug }),
            {
                plan_code: planCode,
                period_months: periodMonths,
            },
            {
                preserveScroll: true,
                onFinish: () => setBusyAction(null),
            },
        );
    };

    const handleSimulatePayment = (invoiceId: number) => {
        if (!tenant) return;
        setBusyAction(`sim-${invoiceId}`);
        router.post(
            route('billing.simulate', { tenant: tenant.slug, invoice: invoiceId }),
            {},
            {
                preserveScroll: true,
                onFinish: () => setBusyAction(null),
            },
        );
    };

    const statusMeta = STATUS_META[currentSubscription.status] ?? STATUS_META.active;
    const resourceKeys: Array<keyof PlanLimitMap> = ['outlets', 'users', 'products'];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Langganan & Tagihan</h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Kelola kuota toko, perpanjangan paket, dan pembayaran invoice {tenant?.name}.
                        </p>
                    </div>
                    {gateway.can_simulate && (
                        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                            <span>Mode Simulator Lokal (MIDTRANS_SERVER_KEY kosong)</span>
                        </div>
                    )}
                </div>
            }
        >
            <Head title="Langganan & Tagihan" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
                {/* Ringkasan Paket Aktif & Pemakaian Kuota */}
                <section
                    aria-labelledby="current-plan-heading"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-5"
                >
                    <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-950 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-medium text-slate-400">Paket Toko Saat Ini</span>
                                <span
                                    className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                                >
                                    {statusMeta.label}
                                </span>
                            </div>

                            <h2 id="current-plan-heading" className="mt-2 text-2xl font-bold text-white">
                                Paket {currentSubscription.plan.name}
                            </h2>
                            <p className="mt-1 text-sm text-slate-400">
                                {currentSubscription.plan.price_monthly === 0
                                    ? 'Gratis selamanya tanpa batas waktu.'
                                    : `${formatRupiah(currentSubscription.plan.price_monthly)} / bulan`}
                            </p>
                        </div>

                        <dl className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <dt className="text-slate-400">Berakhir pada</dt>
                                <dd className="mt-0.5 font-semibold text-slate-200">
                                    {currentSubscription.current_period_end
                                        ? formatDateTime(currentSubscription.current_period_end)
                                        : 'Tidak kedaluwarsa'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-400">Sisa masa aktif</dt>
                                <dd className="mt-0.5 font-semibold text-slate-200">
                                    {currentSubscription.days_left === null
                                        ? 'Tanpa batas waktu'
                                        : `${currentSubscription.days_left} hari`}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-950 p-5">
                        <h3 className="text-sm font-semibold text-slate-200">Pemakaian Kuota Toko</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Batas dihitung dari cabang yang aktif, anggota tim terdaftar, dan total SKU produk.
                        </p>

                        <div className="mt-4 space-y-4">
                            {resourceKeys.map((key) => {
                                const used = usage[key];
                                const limit = limits[key];
                                const ratio = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                                const isFull = limit !== null && used >= limit;
                                const isNear = limit !== null && !isFull && ratio >= 80;

                                return (
                                    <div key={key}>
                                        <div className="flex items-baseline justify-between text-xs mb-1.5">
                                            <span className="font-medium text-slate-200">{RESOURCE_LABELS[key]}</span>
                                            <span className="font-mono text-slate-300">
                                                {used.toLocaleString('id-ID')} /{' '}
                                                {limit === null ? 'Tanpa batas' : limit.toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                                            {limit === null ? (
                                                <div className="h-full w-full bg-emerald-500/35" />
                                            ) : (
                                                <div
                                                    className={`h-full transition-all ${
                                                        isFull
                                                            ? 'bg-rose-500'
                                                            : isNear
                                                              ? 'bg-amber-400'
                                                              : 'bg-emerald-500'
                                                    }`}
                                                    style={{ width: `${ratio}%` }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Pilihan Paket */}
                <section aria-labelledby="plans-heading" className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                        <div>
                            <h2 id="plans-heading" className="text-base font-bold text-white">
                                Pilihan Paket Langganan
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Perpanjangan paket aktif yang sama akan otomatis menambah durasi dari tanggal berakhir saat ini.
                            </p>
                        </div>

                        <div
                            role="group"
                            aria-label="Siklus penagihan"
                            className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1 self-start"
                        >
                            <button
                                type="button"
                                aria-pressed={periodMonths === 1}
                                onClick={() => setPeriodMonths(1)}
                                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    periodMonths === 1
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                Bulanan
                            </button>
                            <button
                                type="button"
                                aria-pressed={periodMonths === 12}
                                onClick={() => setPeriodMonths(12)}
                                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    periodMonths === 12
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                Tahunan (Hemat 2 Bulan)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plans.map((plan) => {
                            const isCurrentPlan = currentSubscription.plan.code === plan.code;
                            const isFree = plan.price_monthly === 0;
                            const displayedPrice = periodMonths === 12 ? plan.price_yearly : plan.price_monthly;
                            const overageEntries = Object.entries(plan.overages) as Array<
                                [keyof PlanLimitMap, OverageItem]
                            >;
                            const hasOverages = overageEntries.length > 0;
                            const isCurrentFreeActive =
                                isCurrentPlan && isFree && currentSubscription.status === 'active';
                            const isSubmitting = busyAction === `checkout-${plan.code}`;

                            let buttonLabel = 'Pilih Paket';
                            if (isFree) {
                                buttonLabel = isCurrentFreeActive ? 'Paket Aktif' : 'Pindah ke Starter';
                            } else if (isCurrentPlan && currentSubscription.status === 'active') {
                                buttonLabel = periodMonths === 12 ? 'Perpanjang 1 Tahun' : 'Perpanjang 1 Bulan';
                            } else if (isCurrentPlan && currentSubscription.status === 'trialing') {
                                buttonLabel = 'Aktifkan Paket Pro';
                            } else {
                                buttonLabel = `Pilih ${plan.name}`;
                            }

                            return (
                                <div
                                    key={plan.id}
                                    className={`rounded-xl border p-5 flex flex-col justify-between ${
                                        isCurrentPlan
                                            ? 'border-emerald-500/50 bg-slate-950'
                                            : 'border-slate-800 bg-slate-950/70'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-base font-bold text-white">{plan.name}</h3>
                                            {isCurrentPlan && (
                                                <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                                                    Paket Saat Ini
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-3 flex items-baseline gap-1.5">
                                            <span className="text-2xl font-bold text-white">
                                                {isFree ? 'Gratis' : formatRupiah(displayedPrice)}
                                            </span>
                                            {!isFree && (
                                                <span className="text-xs text-slate-400">
                                                    / {periodMonths === 12 ? 'tahun' : 'bulan'}
                                                </span>
                                            )}
                                        </div>

                                        <ul className="mt-4 space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-4">
                                            <li className="flex items-center gap-2">
                                                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                                <span>{describeLimit(plan.limits.outlets, 'cabang aktif')}</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                                <span>{describeLimit(plan.limits.users, 'anggota tim')}</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                                <span>{describeLimit(plan.limits.products, 'produk')}</span>
                                            </li>
                                        </ul>

                                        {hasOverages && (
                                            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                                                Melebihi kuota saat ini:{' '}
                                                {overageEntries
                                                    .map(
                                                        ([k, o]) =>
                                                            `${o.used} ${RESOURCE_LABELS[k].toLowerCase()} (maks. ${o.limit})`,
                                                    )
                                                    .join(', ')}
                                                .
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        disabled={hasOverages || isCurrentFreeActive || busyAction !== null}
                                        onClick={() => handleCheckout(plan.code)}
                                        className={`mt-5 w-full rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                            isCurrentPlan && !isFree
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                : isFree
                                                  ? 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                                                  : 'bg-slate-100 text-slate-950 hover:bg-white'
                                        }`}
                                    >
                                        {isSubmitting ? 'Memproses...' : buttonLabel}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Riwayat Invoice */}
                <section
                    aria-labelledby="invoices-heading"
                    className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden"
                >
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-emerald-400" />
                            <h2 id="invoices-heading" className="text-sm font-bold text-white">
                                Riwayat Tagihan & Pembayaran
                            </h2>
                        </div>
                        <span className="text-xs text-slate-400">{invoices.length} invoice terbaru</span>
                    </div>

                    {invoices.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                            <p className="text-sm font-medium text-slate-300">
                                Belum ada invoice yang diterbitkan untuk toko ini.
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                Pilih paket berbayar (Pro atau Business) di atas untuk membuat invoice pembayaran.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Nomor Invoice</th>
                                        <th className="px-4 py-3 font-semibold">Paket & Durasi</th>
                                        <th className="px-4 py-3 font-semibold">Nominal</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold">Tanggal</th>
                                        <th className="px-4 py-3 font-semibold text-right">Tindakan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                                    {invoices.map((inv) => {
                                        const meta = INVOICE_STATUS_META[inv.status] ?? INVOICE_STATUS_META.pending;
                                        const isPending = inv.status === 'pending';

                                        return (
                                            <tr key={inv.id} className="hover:bg-slate-900/40">
                                                <td className="px-4 py-3 font-mono font-medium text-white whitespace-nowrap">
                                                    {inv.number}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-semibold text-slate-100">
                                                        {inv.plan?.name ?? '—'}
                                                    </span>{' '}
                                                    <span className="text-slate-400">
                                                        ({inv.period_months} bulan)
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-semibold whitespace-nowrap">
                                                    {formatRupiah(inv.amount)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                                                    >
                                                        {meta.label}
                                                    </span>
                                                    {inv.payment_type && (
                                                        <span className="ml-2 text-[11px] text-slate-400">
                                                            via {inv.payment_type}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                                    {inv.paid_at
                                                        ? `Dibayar ${formatDateTime(inv.paid_at)}`
                                                        : `Dibuat ${formatDateTime(inv.created_at)}`}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    {isPending ? (
                                                        <div className="inline-flex items-center justify-end gap-2">
                                                            {gateway.can_simulate && (
                                                                <button
                                                                    type="button"
                                                                    disabled={busyAction !== null}
                                                                    onClick={() => handleSimulatePayment(inv.id)}
                                                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                                                >
                                                                    {busyAction === `sim-${inv.id}`
                                                                        ? 'Memproses...'
                                                                        : 'Simulasikan Bayar'}
                                                                </button>
                                                            )}

                                                            {!gateway.simulator && inv.snap_token && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        disabled={busyAction !== null}
                                                                        onClick={() => openSnapPayment(inv)}
                                                                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                                                    >
                                                                        <span>Bayar via Snap</span>
                                                                        <ExternalLink className="h-3 w-3" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={busyAction !== null}
                                                                        onClick={() => handleCheckStatus(inv.id)}
                                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                                                                    >
                                                                        <RefreshCw className="h-3 w-3" />
                                                                        <span>
                                                                            {busyAction === `check-${inv.id}`
                                                                                ? 'Mengecek...'
                                                                                : 'Cek Status'}
                                                                        </span>
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
