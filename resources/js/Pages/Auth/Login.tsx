import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { Store, UserCheck, ShieldCheck, ArrowRight } from 'lucide-react';
import { FormEventHandler } from 'react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: 'kasir@quickretail.com',
        password: 'password123',
        remember: true as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const setDemoCredentials = (role: 'cashier' | 'admin') => {
        if (role === 'cashier') {
            setData({
                ...data,
                email: 'kasir@quickretail.com',
                password: 'password123',
            });
        } else {
            setData({
                ...data,
                email: 'admin@quickretail.com',
                password: 'password123',
            });
        }
    };

    return (
        <GuestLayout>
            <Head title="Masuk ke QuickRetail POS" />

            {/* Brand Header */}
            <div className="mb-6 text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
                    <Store className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">QuickRetail POS</h2>
                <p className="text-xs text-slate-400 mt-1">Smart Minimarket & Inventory Management System</p>
            </div>

            {/* Quick Demo Login Cards */}
            <div className="mb-6 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                    Pilih Akun Demo Instan:
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setDemoCredentials('cashier')}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                            data.email === 'kasir@quickretail.com'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <UserCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                        <div>
                            <div className="text-xs font-bold text-slate-200">Kasir</div>
                            <div className="text-[10px] text-slate-500">kasir@...</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setDemoCredentials('admin')}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                            data.email === 'admin@quickretail.com'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
                        <div>
                            <div className="text-xs font-bold text-slate-200">Owner / Admin</div>
                            <div className="text-[10px] text-slate-500">admin@...</div>
                        </div>
                    </button>
                </div>
            </div>

            {status && (
                <div className="mb-4 text-xs font-medium text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30 text-center">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <InputLabel htmlFor="email" value="Email Pengguna" className="text-xs text-slate-300 font-semibold" />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full bg-slate-950 border-slate-700 text-white rounded-xl text-xs py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                        autoComplete="username"
                        onChange={(e) => setData('email', e.target.value)}
                    />

                    <InputError message={errors.email} className="mt-1.5" />
                </div>

                <div>
                    <InputLabel htmlFor="password" value="Kata Sandi" className="text-xs text-slate-300 font-semibold" />

                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full bg-slate-950 border-slate-700 text-white rounded-xl text-xs py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />

                    <InputError message={errors.password} className="mt-1.5" />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center cursor-pointer">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                            onChange={(e) =>
                                setData(
                                    'remember',
                                    (e.target.checked || false) as false,
                                )
                            }
                        />
                        <span className="ms-2 text-slate-400">
                            Ingat saya
                        </span>
                    </label>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition flex items-center justify-center gap-2"
                    >
                        <span>Masuk ke Terminal POS</span>
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </form>
        </GuestLayout>
    );
}
