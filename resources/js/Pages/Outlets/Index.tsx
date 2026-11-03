import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftRight, CheckCircle2, Edit, MapPin, Plus, X } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface OutletItem {
    id: number;
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    is_main: boolean;
    is_active: boolean;
    open_shifts_count: number;
    completed_sales_count: number;
    total_stock_units: number | string | null;
}

interface TransferProduct {
    id: number;
    name: string;
    barcode: string;
    unit: string;
    stock: number;
    outlet_stocks: {
        outlet_id: number;
        stock: number;
    }[];
}

interface OutletsPageProps extends Record<string, unknown> {
    outletList: OutletItem[];
    products: TransferProduct[];
    activeOutletId: number | null;
}

export default function OutletsIndex({ outletList, products, activeOutletId }: OutletsPageProps) {
    const { tenant } = usePage<PageProps<OutletsPageProps>>().props;

    const [isOutletModalOpen, setIsOutletModalOpen] = useState(false);
    const [editingOutlet, setEditingOutlet] = useState<OutletItem | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    const outletForm = useForm({
        name: '',
        code: '',
        address: '',
        phone: '',
        is_active: true,
    });

    const activeOutlets = outletList.filter((o) => o.is_active);

    const transferForm = useForm({
        from_outlet_id: activeOutlets[0]?.id ? String(activeOutlets[0].id) : '',
        to_outlet_id: activeOutlets[1]?.id ? String(activeOutlets[1].id) : '',
        product_id: products[0]?.id ? String(products[0].id) : '',
        qty: '1',
        notes: '',
    });

    const openAddOutlet = () => {
        setEditingOutlet(null);
        outletForm.setData({
            name: '',
            code: '',
            address: '',
            phone: '',
            is_active: true,
        });
        outletForm.clearErrors();
        setIsOutletModalOpen(true);
    };

    const openEditOutlet = (outlet: OutletItem) => {
        setEditingOutlet(outlet);
        outletForm.setData({
            name: outlet.name,
            code: outlet.code,
            address: outlet.address ?? '',
            phone: outlet.phone ?? '',
            is_active: outlet.is_active,
        });
        outletForm.clearErrors();
        setIsOutletModalOpen(true);
    };

    const submitOutletForm: FormEventHandler = (e) => {
        e.preventDefault();
        if (editingOutlet) {
            outletForm.put(route('outlets.update', { tenant: tenant?.slug, outlet: editingOutlet.id }), {
                onSuccess: () => setIsOutletModalOpen(false),
            });
        } else {
            outletForm.post(route('outlets.store', { tenant: tenant?.slug }), {
                onSuccess: () => {
                    outletForm.reset();
                    setIsOutletModalOpen(false);
                },
            });
        }
    };

    const openTransferModal = () => {
        transferForm.clearErrors();
        transferForm.setData({
            from_outlet_id: activeOutlets[0]?.id ? String(activeOutlets[0].id) : '',
            to_outlet_id: activeOutlets[1]?.id ? String(activeOutlets[1].id) : '',
            product_id: products[0]?.id ? String(products[0].id) : '',
            qty: '1',
            notes: '',
        });
        setIsTransferModalOpen(true);
    };

    const submitTransfer: FormEventHandler = (e) => {
        e.preventDefault();
        transferForm.post(route('outlets.transfer', { tenant: tenant?.slug }), {
            onSuccess: () => setIsTransferModalOpen(false),
        });
    };

    const switchActiveOutlet = (outletId: number) => {
        router.post(
            route('outlets.switch', { tenant: tenant?.slug }),
            { outlet_id: outletId },
            { preserveScroll: true },
        );
    };

    const selectedProduct = products.find((p) => String(p.id) === transferForm.data.product_id);
    const availableInSource = selectedProduct
        ? (selectedProduct.outlet_stocks.find((s) => String(s.outlet_id) === transferForm.data.from_outlet_id)?.stock ?? 0)
        : 0;

    return (
        <AuthenticatedLayout>
            <Head title={`Manajemen Cabang - ${tenant?.name ?? 'Toko'}`} />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                            <MapPin className="h-6 w-6 text-emerald-400" />
                            Cabang & Distribusi Stok
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Kelola daftar cabang fisik, pantau stok unit tiap lokasi, dan pindahkan stok antar cabang.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {activeOutlets.length >= 2 && products.length > 0 && (
                            <button
                                type="button"
                                onClick={openTransferModal}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition-colors"
                            >
                                <ArrowLeftRight className="h-4 w-4 text-emerald-400" />
                                Transfer Stok Antar Cabang
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={openAddOutlet}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Tambah Cabang Baru
                        </button>
                    </div>
                </div>

                {/* Outlets Table */}
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800 text-sm">
                            <thead className="bg-slate-900/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-5 py-3.5">Cabang</th>
                                    <th className="px-5 py-3.5">Alamat & Telepon</th>
                                    <th className="px-5 py-3.5 text-center">Total Unit Stok</th>
                                    <th className="px-5 py-3.5 text-center">Shift Terbuka</th>
                                    <th className="px-5 py-3.5 text-center">Transaksi</th>
                                    <th className="px-5 py-3.5 text-center">Status</th>
                                    <th className="px-5 py-3.5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                                {outletList.map((item) => {
                                    const isCurrent = item.id === activeOutletId;
                                    const units = Number(item.total_stock_units ?? 0);

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white">{item.name}</span>
                                                    {item.is_main && (
                                                        <span className="rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                                            Pusat
                                                        </span>
                                                    )}
                                                    {isCurrent && (
                                                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Aktif di Sesi Ini
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-mono text-slate-400 mt-0.5">
                                                    Kode: {item.code}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-300">
                                                <div>{item.address || <span className="text-slate-500">Belum diisi</span>}</div>
                                                {item.phone && <div className="text-slate-400 mt-0.5">{item.phone}</div>}
                                            </td>
                                            <td className="px-5 py-4 text-center font-mono font-semibold text-slate-100 whitespace-nowrap">
                                                {units.toLocaleString('id-ID')} unit
                                            </td>
                                            <td className="px-5 py-4 text-center whitespace-nowrap">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        item.open_shifts_count > 0
                                                            ? 'bg-emerald-500/15 text-emerald-300'
                                                            : 'bg-slate-800 text-slate-400'
                                                    }`}
                                                >
                                                    {item.open_shifts_count} shift
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center font-mono text-slate-300 whitespace-nowrap">
                                                {item.completed_sales_count.toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-5 py-4 text-center whitespace-nowrap">
                                                {item.is_active ? (
                                                    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                                        Aktif
                                                    </span>
                                                ) : (
                                                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2">
                                                    {item.is_active && !isCurrent && (
                                                        <button
                                                            type="button"
                                                            onClick={() => switchActiveOutlet(item.id)}
                                                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                                                        >
                                                            Pilih Aktif
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditOutlet(item)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                        Edit
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add / Edit Outlet Modal */}
            <Modal show={isOutletModalOpen} maxWidth="md" onClose={() => setIsOutletModalOpen(false)}>
                <form onSubmit={submitOutletForm} className="bg-slate-900 text-slate-100 p-6 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">
                            {editingOutlet ? 'Edit Data Cabang' : 'Tambah Cabang Baru'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setIsOutletModalOpen(false)}
                            className="text-slate-400 hover:text-white"
                            aria-label="Tutup modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="outlet_name" className="block text-xs font-semibold text-slate-300 mb-1">
                                Nama Cabang
                            </label>
                            <input
                                id="outlet_name"
                                type="text"
                                required
                                value={outletForm.data.name}
                                onChange={(e) => outletForm.setData('name', e.target.value)}
                                placeholder="Contoh: Cabang Dago"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <InputError message={outletForm.errors.name} className="mt-1" />
                        </div>

                        <div>
                            <label htmlFor="outlet_code" className="block text-xs font-semibold text-slate-300 mb-1">
                                Kode Cabang (Unik)
                            </label>
                            <input
                                id="outlet_code"
                                type="text"
                                required
                                value={outletForm.data.code}
                                onChange={(e) => outletForm.setData('code', e.target.value.toUpperCase())}
                                placeholder="Contoh: DAGO-01"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <InputError message={outletForm.errors.code} className="mt-1" />
                        </div>

                        <div>
                            <label htmlFor="outlet_address" className="block text-xs font-semibold text-slate-300 mb-1">
                                Alamat Lengkap
                            </label>
                            <input
                                id="outlet_address"
                                type="text"
                                value={outletForm.data.address}
                                onChange={(e) => outletForm.setData('address', e.target.value)}
                                placeholder="Jl. Ir. H. Juanda No. 12"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <InputError message={outletForm.errors.address} className="mt-1" />
                        </div>

                        <div>
                            <label htmlFor="outlet_phone" className="block text-xs font-semibold text-slate-300 mb-1">
                                Nomor Telepon
                            </label>
                            <input
                                id="outlet_phone"
                                type="text"
                                value={outletForm.data.phone}
                                onChange={(e) => outletForm.setData('phone', e.target.value)}
                                placeholder="0812xxxxxxxx"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <InputError message={outletForm.errors.phone} className="mt-1" />
                        </div>

                        {editingOutlet && !editingOutlet.is_main && (
                            <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={outletForm.data.is_active}
                                    onChange={(e) => outletForm.setData('is_active', e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-xs text-slate-300">Cabang aktif beroperasi</span>
                            </label>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsOutletModalOpen(false)}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={outletForm.processing}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {outletForm.processing ? 'Menyimpan...' : 'Simpan Cabang'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Stock Transfer Modal */}
            <Modal show={isTransferModalOpen} maxWidth="md" onClose={() => setIsTransferModalOpen(false)}>
                <form onSubmit={submitTransfer} className="bg-slate-900 text-slate-100 p-6 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <ArrowLeftRight className="h-5 w-5 text-emerald-400" />
                            Transfer Stok Antar Cabang
                        </h2>
                        <button
                            type="button"
                            onClick={() => setIsTransferModalOpen(false)}
                            className="text-slate-400 hover:text-white"
                            aria-label="Tutup modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="from_outlet" className="block text-xs font-semibold text-slate-300 mb-1">
                                    Dari Cabang (Asal)
                                </label>
                                <select
                                    id="from_outlet"
                                    value={transferForm.data.from_outlet_id}
                                    onChange={(e) => transferForm.setData('from_outlet_id', e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                >
                                    {activeOutlets.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.name} ({o.code})
                                        </option>
                                    ))}
                                </select>
                                <InputError message={transferForm.errors.from_outlet_id} className="mt-1" />
                            </div>

                            <div>
                                <label htmlFor="to_outlet" className="block text-xs font-semibold text-slate-300 mb-1">
                                    Ke Cabang (Tujuan)
                                </label>
                                <select
                                    id="to_outlet"
                                    value={transferForm.data.to_outlet_id}
                                    onChange={(e) => transferForm.setData('to_outlet_id', e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                >
                                    {activeOutlets.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.name} ({o.code})
                                        </option>
                                    ))}
                                </select>
                                <InputError message={transferForm.errors.to_outlet_id} className="mt-1" />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="transfer_product" className="block text-xs font-semibold text-slate-300 mb-1">
                                Produk
                            </label>
                            <select
                                id="transfer_product"
                                value={transferForm.data.product_id}
                                onChange={(e) => transferForm.setData('product_id', e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            >
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.barcode})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">
                                Stok tersedia di cabang asal:{' '}
                                <span className="font-mono font-semibold text-emerald-400">
                                    {availableInSource} {selectedProduct?.unit ?? 'pcs'}
                                </span>
                            </p>
                            <InputError message={transferForm.errors.product_id} className="mt-1" />
                        </div>

                        <div>
                            <label htmlFor="transfer_qty" className="block text-xs font-semibold text-slate-300 mb-1">
                                Jumlah Transfer
                            </label>
                            <input
                                id="transfer_qty"
                                type="number"
                                min={1}
                                required
                                value={transferForm.data.qty}
                                onChange={(e) => transferForm.setData('qty', e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <InputError message={transferForm.errors.qty} className="mt-1" />
                        </div>

                        <div>
                            <label htmlFor="transfer_notes" className="block text-xs font-semibold text-slate-300 mb-1">
                                Catatan (Opsional)
                            </label>
                            <input
                                id="transfer_notes"
                                type="text"
                                value={transferForm.data.notes}
                                onChange={(e) => transferForm.setData('notes', e.target.value)}
                                placeholder="Contoh: Kiriman stok akhir pekan"
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                            />
                            <InputError message={transferForm.errors.notes} className="mt-1" />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsTransferModalOpen(false)}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={transferForm.processing}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {transferForm.processing ? 'Memproses...' : 'Proses Transfer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
