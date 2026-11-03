import Dropdown from '@/Components/Dropdown';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Store,
    ShoppingCart,
    Package,
    BarChart3,
    Users,
    MapPin,
    CreditCard,
    History,
    Shield,
    AlertTriangle,
    User as UserIcon,
    LogOut,
    Menu,
    X,
    Clock,
    Plus,
    Check,
    ChevronsUpDown,
} from 'lucide-react';
import { FormEventHandler, PropsWithChildren, ReactNode, useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
    owner: 'Owner',
    manager: 'Manajer',
    cashier: 'Kasir',
};

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, tenant, tenants = [], outlet, outlets = [], subscription, flash } = usePage().props;
    const user = auth.user;

    if (typeof Ziggy !== 'undefined' && Ziggy) {
        Ziggy.defaults = tenant?.slug ? { ...Ziggy.defaults, tenant: tenant.slug } : {};
    }

    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);

    const storeForm = useForm({
        name: '',
    });

    const isOwner = tenant?.role === 'owner';
    const canManageStore = tenant ? tenant.role === 'owner' || tenant.role === 'manager' : false;
    const tenantRoute = (name: string) => (tenant ? route(name, { tenant: tenant.slug }) : route('dashboard'));

    const handleCreateStore: FormEventHandler = (e) => {
        e.preventDefault();
        storeForm.post(route('stores.store'), {
            onSuccess: () => {
                storeForm.reset();
                setShowCreateStoreModal(false);
            },
        });
    };

    const handleSwitchOutlet = (outletId: number) => {
        if (!tenant || outlet?.id === outletId) return;
        router.post(
            route('outlets.switch', { tenant: tenant.slug }),
            { outlet_id: outletId },
            { preserveScroll: true },
        );
    };

    const currentRoleLabel = tenant?.role ? ROLE_LABELS[tenant.role] ?? tenant.role : user.role || 'Kasir';

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
            <nav className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between items-center">
                        <div className="flex items-center gap-4 lg:gap-6">
                            {/* Store & Outlet Switchers */}
                            <div className="flex items-center gap-2">
                                <Link
                                    href={tenantRoute('pos.index')}
                                    className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center hover:bg-emerald-500 transition-colors shrink-0"
                                >
                                    <Store className="h-5 w-5 text-white" />
                                </Link>

                                {/* Store Switcher */}
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button
                                            type="button"
                                            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-slate-800/80 transition-colors"
                                        >
                                            <div>
                                                <div className="text-sm font-bold tracking-tight text-white truncate max-w-[140px] sm:max-w-[180px]">
                                                    {tenant?.name ?? 'QuickRetail POS'}
                                                </div>
                                                <p className="text-[11px] text-slate-400 font-medium">
                                                    {tenant ? `/t/${tenant.slug}` : 'Pilih atau buat toko'}
                                                </p>
                                            </div>
                                            <ChevronsUpDown className="h-4 w-4 text-slate-400 shrink-0" />
                                        </button>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content
                                        align="left"
                                        width="48"
                                        contentClasses="py-1.5 bg-slate-900 border border-slate-800 shadow-xl rounded-xl min-w-[240px]"
                                    >
                                        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                            Daftar Toko Anda
                                        </div>
                                        {tenants.map((item) => {
                                            const isCurrent = tenant?.id === item.id;
                                            return (
                                                <Link
                                                    key={item.id}
                                                    href={route('pos.index', { tenant: item.slug })}
                                                    className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                                                        isCurrent
                                                            ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                                                            : 'text-slate-200 hover:bg-slate-800'
                                                    }`}
                                                >
                                                    <div className="truncate pr-2">
                                                        <div className="truncate">{item.name}</div>
                                                        <div className="text-[11px] text-slate-400">
                                                            {item.role ? ROLE_LABELS[item.role] ?? item.role : ''}
                                                        </div>
                                                    </div>
                                                    {isCurrent && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                                                </Link>
                                            );
                                        })}
                                        <div className="border-t border-slate-800 mt-1 pt-1 px-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setShowCreateStoreModal(true)}
                                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-800 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Buat Toko Baru
                                            </button>
                                        </div>
                                    </Dropdown.Content>
                                </Dropdown>

                                {/* Active Outlet Switcher */}
                                {tenant && outlet && (
                                    <Dropdown>
                                        <Dropdown.Trigger>
                                            <button
                                                type="button"
                                                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                                                title="Cabang Aktif"
                                            >
                                                <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                                <span className="truncate max-w-[120px]">{outlet.name}</span>
                                                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            </button>
                                        </Dropdown.Trigger>

                                        <Dropdown.Content
                                            align="left"
                                            width="48"
                                            contentClasses="py-1.5 bg-slate-900 border border-slate-800 shadow-xl rounded-xl min-w-[230px]"
                                        >
                                            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                Cabang Aktif
                                            </div>
                                            {outlets.map((item) => {
                                                const isActive = outlet.id === item.id;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => handleSwitchOutlet(item.id)}
                                                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                                            isActive
                                                                ? 'bg-emerald-500/10 text-emerald-300 font-semibold'
                                                                : 'text-slate-200 hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <div className="truncate pr-2">
                                                            <div className="truncate">{item.name}</div>
                                                            <div className="text-[10px] font-mono text-slate-400">
                                                                {item.code} {item.is_main ? '• Pusat' : ''}
                                                            </div>
                                                        </div>
                                                        {isActive && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                            {canManageStore && (
                                                <div className="border-t border-slate-800 mt-1 pt-1 px-1.5">
                                                    <Link
                                                        href={tenantRoute('outlets.index')}
                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-800 transition-colors"
                                                    >
                                                        <MapPin className="h-3.5 w-3.5" />
                                                        Kelola Cabang & Stok
                                                    </Link>
                                                </div>
                                            )}
                                        </Dropdown.Content>
                                    </Dropdown>
                                )}
                            </div>

                            {/* Desktop Nav Links */}
                            {tenant && (
                                <div className="hidden space-x-1 lg:flex">
                                    <NavLink
                                        href={tenantRoute('pos.index')}
                                        active={route().current('pos.*')}
                                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <ShoppingCart className="h-4 w-4" />
                                        Kasir
                                    </NavLink>

                                    {canManageStore && (
                                        <>
                                            <NavLink
                                                href={tenantRoute('products.index')}
                                                active={route().current('products.*')}
                                                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <Package className="h-4 w-4" />
                                                Produk
                                            </NavLink>
                                            <NavLink
                                                href={tenantRoute('outlets.index')}
                                                active={route().current('outlets.*')}
                                                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <MapPin className="h-4 w-4" />
                                                Cabang
                                            </NavLink>
                                            <NavLink
                                                href={tenantRoute('reports.index')}
                                                active={route().current('reports.*')}
                                                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                                Laporan
                                            </NavLink>
                                            <NavLink
                                                href={tenantRoute('staff.index')}
                                                active={route().current('staff.*')}
                                                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <Users className="h-4 w-4" />
                                                Staf
                                            </NavLink>
                                            <NavLink
                                                href={tenantRoute('audit-logs.index')}
                                                active={route().current('audit-logs.*')}
                                                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <History className="h-4 w-4" />
                                                Audit
                                            </NavLink>
                                        </>
                                    )}

                                    {isOwner && (
                                        <NavLink
                                            href={tenantRoute('billing.index')}
                                            active={route().current('billing.*')}
                                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <CreditCard className="h-4 w-4" />
                                            Langganan
                                        </NavLink>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right Area: Date & User Menu */}
                        <div className="hidden sm:flex sm:items-center sm:gap-3">
                            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                                <span>
                                    {new Date().toLocaleDateString('id-ID', {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </span>
                            </div>

                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-700 transition"
                                    >
                                        <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                                                {currentRoleLabel}
                                            </div>
                                        </div>
                                    </button>
                                </Dropdown.Trigger>

                                <Dropdown.Content contentClasses="py-1 bg-slate-900 border border-slate-800 shadow-2xl rounded-xl">
                                    {user.is_super_admin && (
                                        <Dropdown.Link
                                            href={route('admin.index')}
                                            className="flex items-center gap-2 text-emerald-300 hover:bg-slate-800 hover:text-emerald-200"
                                        >
                                            <Shield className="h-4 w-4" />
                                            Super Admin Platform
                                        </Dropdown.Link>
                                    )}
                                    <Dropdown.Link
                                        href={route('profile.edit')}
                                        className="flex items-center gap-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    >
                                        <UserIcon className="h-4 w-4" />
                                        Profil Pengguna
                                    </Dropdown.Link>
                                    <Dropdown.Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                        className="flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 w-full text-left"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Keluar (Log Out)
                                    </Dropdown.Link>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="-me-2 flex items-center lg:hidden">
                            <button
                                onClick={() => setShowingNavigationDropdown((prev) => !prev)}
                                aria-label="Buka menu navigasi"
                                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none"
                            >
                                {showingNavigationDropdown ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                {showingNavigationDropdown && (
                    <div className="lg:hidden border-t border-slate-800 bg-slate-950 px-4 pt-2 pb-4 space-y-1">
                        {tenant && (
                            <>
                                <ResponsiveNavLink
                                    href={tenantRoute('pos.index')}
                                    active={route().current('pos.*')}
                                    className="flex items-center gap-2"
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    Terminal Kasir
                                </ResponsiveNavLink>
                                {canManageStore && (
                                    <>
                                        <ResponsiveNavLink
                                            href={tenantRoute('products.index')}
                                            active={route().current('products.*')}
                                            className="flex items-center gap-2"
                                        >
                                            <Package className="h-4 w-4" />
                                            Produk & Stok
                                        </ResponsiveNavLink>
                                        <ResponsiveNavLink
                                            href={tenantRoute('outlets.index')}
                                            active={route().current('outlets.*')}
                                            className="flex items-center gap-2"
                                        >
                                            <MapPin className="h-4 w-4" />
                                            Cabang & Transfer Stok
                                        </ResponsiveNavLink>
                                        <ResponsiveNavLink
                                            href={tenantRoute('reports.index')}
                                            active={route().current('reports.*')}
                                            className="flex items-center gap-2"
                                        >
                                            <BarChart3 className="h-4 w-4" />
                                            Laporan & Profit
                                        </ResponsiveNavLink>
                                        <ResponsiveNavLink
                                            href={tenantRoute('staff.index')}
                                            active={route().current('staff.*')}
                                            className="flex items-center gap-2"
                                        >
                                            <Users className="h-4 w-4" />
                                            Tim & Staf
                                        </ResponsiveNavLink>
                                        <ResponsiveNavLink
                                            href={tenantRoute('audit-logs.index')}
                                            active={route().current('audit-logs.*')}
                                            className="flex items-center gap-2"
                                        >
                                            <History className="h-4 w-4" />
                                            Riwayat Audit
                                        </ResponsiveNavLink>
                                    </>
                                )}
                                {isOwner && (
                                    <ResponsiveNavLink
                                        href={tenantRoute('billing.index')}
                                        active={route().current('billing.*')}
                                        className="flex items-center gap-2"
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        Langganan & Tagihan
                                    </ResponsiveNavLink>
                                )}
                            </>
                        )}

                        {tenant && outlets.length > 0 && (
                            <div className="border-t border-slate-800 pt-3 mt-3 space-y-1">
                                <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Cabang Aktif
                                </div>
                                {outlets.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setShowingNavigationDropdown(false);
                                            handleSwitchOutlet(item.id);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm ${
                                            outlet?.id === item.id
                                                ? 'bg-emerald-500/10 text-emerald-300 font-semibold'
                                                : 'text-slate-300 hover:bg-slate-800'
                                        }`}
                                    >
                                        <span>
                                            {item.name} ({item.code})
                                        </span>
                                        {outlet?.id === item.id && <Check className="h-4 w-4 text-emerald-400" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tenants.length > 0 && (
                            <div className="border-t border-slate-800 pt-3 mt-3 space-y-1">
                                <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Pindah Toko
                                </div>
                                {tenants.map((item) => (
                                    <ResponsiveNavLink
                                        key={item.id}
                                        href={route('pos.index', { tenant: item.slug })}
                                        active={tenant?.id === item.id}
                                    >
                                        {item.name} ({item.role ? ROLE_LABELS[item.role] ?? item.role : ''})
                                    </ResponsiveNavLink>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowingNavigationDropdown(false);
                                        setShowCreateStoreModal(true);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-slate-800 rounded-md"
                                >
                                    <Plus className="h-4 w-4" />
                                    Buat Toko Baru
                                </button>
                            </div>
                        )}

                        <div className="border-t border-slate-800 pt-3 mt-3">
                            <div className="text-sm font-semibold text-slate-200 px-3">{user.name}</div>
                            <div className="text-xs text-slate-400 px-3">{user.email}</div>
                            <div className="mt-2 space-y-1">
                                {user.is_super_admin && (
                                    <ResponsiveNavLink
                                        href={route('admin.index')}
                                        active={route().current('admin.*')}
                                    >
                                        Super Admin Platform
                                    </ResponsiveNavLink>
                                )}
                                <ResponsiveNavLink href={route('profile.edit')}>Profil</ResponsiveNavLink>
                                <ResponsiveNavLink method="post" href={route('logout')} as="button">
                                    Log Out
                                </ResponsiveNavLink>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {tenant && subscription && (subscription.status === 'expired' || subscription.status === 'past_due' || (subscription.status === 'trialing' && subscription.days_left !== null && subscription.days_left <= 5)) && (
                <div
                    role="alert"
                    className={`border-b px-4 py-2.5 text-xs sm:text-sm ${
                        subscription.status === 'expired'
                            ? 'border-rose-500/30 bg-rose-950/60 text-rose-200'
                            : 'border-amber-500/30 bg-amber-950/50 text-amber-200'
                    }`}
                >
                    <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>
                                {subscription.status === 'expired' &&
                                    `Langganan ${subscription.plan_name} telah berakhir. Toko dalam mode baca-saja (transaksi baru & perubahan data dikunci).`}
                                {subscription.status === 'past_due' &&
                                    `Masa aktif paket ${subscription.plan_name} telah lewat (masa tenggang). Segera perpanjang agar operasional kasir tidak terkunci.`}
                                {subscription.status === 'trialing' &&
                                    `Masa coba Paket ${subscription.plan_name} tersisa ${subscription.days_left} hari lagi.`}
                            </span>
                        </div>
                        {isOwner && !route().current('billing.*') && (
                            <Link
                                href={tenantRoute('billing.index')}
                                className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                            >
                                Kelola Langganan
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {header && (
                <header className="bg-slate-950/40 border-b border-slate-800/80 py-4 px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">{header}</div>
                </header>
            )}

            {(flash?.success || flash?.error) && (
                <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pt-4">
                    <div
                        role="status"
                        className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                            flash.error
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        }`}
                    >
                        {flash.error ?? flash.success}
                    </div>
                </div>
            )}

            <main className="flex-1">{children}</main>

            {/* Create New Store Modal */}
            <Modal show={showCreateStoreModal} maxWidth="md" onClose={() => setShowCreateStoreModal(false)}>
                <form onSubmit={handleCreateStore} className="bg-slate-900 text-slate-100 p-6 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Buat Toko Baru</h2>
                        <button
                            type="button"
                            onClick={() => setShowCreateStoreModal(false)}
                            className="text-slate-400 hover:text-white"
                            aria-label="Tutup modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <p className="text-sm text-slate-400 mb-4">
                        Toko baru memiliki katalog produk, cabang, stok, shift kasir, dan laporan terpisah, serta langsung mendapat masa coba Paket Pro 14 hari.
                    </p>

                    <div>
                        <label htmlFor="new_store_name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Nama Toko
                        </label>
                        <input
                            id="new_store_name"
                            type="text"
                            required
                            value={storeForm.data.name}
                            onChange={(e) => storeForm.setData('name', e.target.value)}
                            placeholder="Contoh: Minimarket Sejahtera"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <InputError message={storeForm.errors.name} className="mt-1.5" />
                    </div>

                    <div className="mt-6 flex justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={() => setShowCreateStoreModal(false)}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={storeForm.processing}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {storeForm.processing ? 'Membuat...' : 'Buat Toko'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
