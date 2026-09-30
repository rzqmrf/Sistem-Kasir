import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { Link, usePage } from '@inertiajs/react';
import { 
    Store, 
    ShoppingCart, 
    Package, 
    BarChart3, 
    User as UserIcon, 
    LogOut,
    Menu,
    X,
    Clock
} from 'lucide-react';
import { PropsWithChildren, ReactNode, useState } from 'react';

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = usePage().props.auth.user;
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
            {/* Top Navigation Bar */}
            <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between items-center">
                        {/* Logo & Brand */}
                        <div className="flex items-center gap-8">
                            <Link href="/pos" className="flex items-center gap-2.5 group">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                                    <Store className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                                        QuickRetail <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">POS</span>
                                    </span>
                                    <p className="text-[11px] text-slate-400 font-medium">Smart Minimarket System</p>
                                </div>
                            </Link>

                            {/* Desktop Nav Links */}
                            <div className="hidden space-x-2 md:flex">
                                <NavLink
                                    href={route('pos.index')}
                                    active={route().current('pos.*')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    Terminal Kasir
                                </NavLink>
                                <NavLink
                                    href={route('products.index')}
                                    active={route().current('products.*')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Package className="h-4 w-4" />
                                    Produk & Stok
                                </NavLink>
                                <NavLink
                                    href={route('reports.index')}
                                    active={route().current('reports.*')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    Laporan & Profit
                                </NavLink>
                            </div>
                        </div>

                        {/* Right Area: User info & Shift Status */}
                        <div className="hidden sm:flex sm:items-center sm:gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                                <Clock className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                                <span>{new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>

                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-700 transition"
                                    >
                                        <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role || 'Kasir'}</div>
                                        </div>
                                        <svg
                                            className="h-4 w-4 text-slate-400"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                </Dropdown.Trigger>

                                <Dropdown.Content contentClasses="py-1 bg-slate-900 border border-slate-800 shadow-2xl rounded-xl">
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
                        <div className="-me-2 flex items-center sm:hidden">
                            <button
                                onClick={() => setShowingNavigationDropdown((prev) => !prev)}
                                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none"
                            >
                                {showingNavigationDropdown ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                {showingNavigationDropdown && (
                    <div className="sm:hidden border-t border-slate-800 bg-slate-950 px-4 pt-2 pb-4 space-y-1">
                        <ResponsiveNavLink
                            href={route('pos.index')}
                            active={route().current('pos.*')}
                            className="flex items-center gap-2"
                        >
                            <ShoppingCart className="h-4 w-4" />
                            Terminal Kasir
                        </ResponsiveNavLink>
                        <ResponsiveNavLink
                            href={route('products.index')}
                            active={route().current('products.*')}
                            className="flex items-center gap-2"
                        >
                            <Package className="h-4 w-4" />
                            Produk & Stok
                        </ResponsiveNavLink>
                        <ResponsiveNavLink
                            href={route('reports.index')}
                            active={route().current('reports.*')}
                            className="flex items-center gap-2"
                        >
                            <BarChart3 className="h-4 w-4" />
                            Laporan & Profit
                        </ResponsiveNavLink>

                        <div className="border-t border-slate-800 pt-3 mt-3">
                            <div className="text-sm font-semibold text-slate-200 px-3">{user.name}</div>
                            <div className="text-xs text-slate-400 px-3">{user.email}</div>
                            <div className="mt-2 space-y-1">
                                <ResponsiveNavLink href={route('profile.edit')}>
                                    Profil
                                </ResponsiveNavLink>
                                <ResponsiveNavLink method="post" href={route('logout')} as="button">
                                    Log Out
                                </ResponsiveNavLink>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Optional Header */}
            {header && (
                <header className="bg-slate-950/40 border-b border-slate-800/80 py-4 px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">{header}</div>
                </header>
            )}

            {/* Main Content Body */}
            <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
    );
}
