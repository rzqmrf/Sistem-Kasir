import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { 
    Package, 
    Plus, 
    Search, 
    Edit, 
    ArrowUpDown, 
    AlertTriangle, 
    Sparkles, 
    Boxes, 
    Trash2, 
    Check, 
    X,
    Barcode,
    Layers
} from 'lucide-react';
import React, { useState } from 'react';
import { Category, Product, PriceTier } from '@/types/pos';

interface Props {
    products: {
        data: Product[];
        links: any[];
        total: number;
        current_page: number;
        last_page: number;
    };
    categories: Category[];
    filters: {
        search?: string;
        category_id?: string;
    };
}

export default function ProductsIndex({ products, categories, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [categoryId, setCategoryId] = useState(filters.category_id || '');

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        barcode: '',
        sku: '',
        name: '',
        category_id: '',
        buy_price: '',
        sell_price: '',
        stock: '0',
        min_stock_alert: '10',
        unit: 'pcs',
        is_active: true,
        tiers: [] as { min_qty: number; tier_price: number }[],
    });

    // Stock Adjust State
    const [adjustType, setAdjustType] = useState<'restock' | 'adjustment' | 'return'>('restock');
    const [adjustQty, setAdjustQty] = useState('');
    const [isReduction, setIsReduction] = useState(false);
    const [adjustNotes, setAdjustNotes] = useState('');

    // Handle Search filter
    const handleFilter = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        router.get(route('products.index'), {
            search: search || undefined,
            category_id: categoryId || undefined,
        }, { preserveState: true });
    };

    // Open Add Modal
    const handleOpenAdd = () => {
        setEditingProduct(null);
        setFormData({
            barcode: '',
            sku: '',
            name: '',
            category_id: categories[0]?.id.toString() || '',
            buy_price: '',
            sell_price: '',
            stock: '0',
            min_stock_alert: '10',
            unit: 'pcs',
            is_active: true,
            tiers: [],
        });
        setIsFormModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            barcode: product.barcode,
            sku: product.sku || '',
            name: product.name,
            category_id: product.category_id?.toString() || '',
            buy_price: product.buy_price.toString(),
            sell_price: product.sell_price.toString(),
            stock: product.stock.toString(),
            min_stock_alert: product.min_stock_alert.toString(),
            unit: product.unit,
            is_active: product.is_active,
            tiers: (product.price_tiers || []).map((t) => ({
                min_qty: t.min_qty,
                tier_price: Number(t.tier_price),
            })),
        });
        setIsFormModalOpen(true);
    };

    // Open Stock Adjustment Modal
    const handleOpenAdjust = (product: Product) => {
        setAdjustingProduct(product);
        setAdjustType('restock');
        setAdjustQty('');
        setIsReduction(false);
        setAdjustNotes('');
        setIsAdjustModalOpen(true);
    };

    // Add Tier Row
    const handleAddTier = () => {
        setFormData({
            ...formData,
            tiers: [...formData.tiers, { min_qty: 6, tier_price: Number(formData.sell_price) * 0.9 || 0 }],
        });
    };

    // Remove Tier Row
    const handleRemoveTier = (index: number) => {
        setFormData({
            ...formData,
            tiers: formData.tiers.filter((_, i) => i !== index),
        });
    };

    // Submit Product Add / Update
    const handleSubmitProduct = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...formData,
            category_id: formData.category_id ? Number(formData.category_id) : null,
            buy_price: parseFloat(formData.buy_price) || 0,
            sell_price: parseFloat(formData.sell_price) || 0,
            stock: parseInt(formData.stock) || 0,
            min_stock_alert: parseInt(formData.min_stock_alert) || 0,
            tiers: formData.tiers.map((t) => ({
                min_qty: Number(t.min_qty),
                tier_price: Number(t.tier_price),
            })),
        };

        if (editingProduct) {
            router.put(route('products.update', editingProduct.id), payload, {
                onSuccess: () => setIsFormModalOpen(false),
            });
        } else {
            router.post(route('products.store'), payload, {
                onSuccess: () => setIsFormModalOpen(false),
            });
        }
    };

    // Submit Stock Adjustment
    const handleSubmitAdjust = (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustingProduct) return;

        router.post(route('products.adjust-stock', adjustingProduct.id), {
            type: adjustType,
            qty: parseInt(adjustQty) || 1,
            is_reduction: isReduction,
            notes: adjustNotes || 'Penyesuaian stok manual',
        }, {
            onSuccess: () => setIsAdjustModalOpen(false),
        });
    };

    const formatRp = (val: number | string) => {
        const num = Number(val) || 0;
        return 'Rp ' + num.toLocaleString('id-ID');
    };

    return (
        <AuthenticatedLayout>
            <Head title="Manajemen Produk & Stok" />

            <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
                {/* Header Title & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                            <Package className="h-7 w-7 text-emerald-400" />
                            Katalog Produk & Inventori
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Kelola harga HPP, harga jual, harga grosir bertingkat, dan stok barang masuk
                        </p>
                    </div>

                    <button
                        onClick={handleOpenAdd}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition flex items-center gap-2 self-start sm:self-auto"
                    >
                        <Plus className="h-4 w-4" />
                        Tambah Produk Baru
                    </button>
                </div>

                {/* Filter & Search Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
                    <form onSubmit={handleFilter} className="flex-1 relative flex items-center">
                        <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari berdasarkan Barcode, SKU, atau Nama Produk..."
                            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                        />
                    </form>

                    <div className="flex items-center gap-2">
                        <select
                            value={categoryId}
                            onChange={(e) => {
                                setCategoryId(e.target.value);
                                router.get(route('products.index'), {
                                    search: search || undefined,
                                    category_id: e.target.value || undefined,
                                }, { preserveState: true });
                            }}
                            className="bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                        >
                            <option value="">Semua Kategori</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => handleFilter()}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                        >
                            Filter
                        </button>
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/80 border-b border-slate-800 uppercase font-bold text-[10px] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3.5">Barcode / SKU</th>
                                    <th className="px-4 py-3.5">Nama Produk</th>
                                    <th className="px-4 py-3.5">Kategori</th>
                                    <th className="px-4 py-3.5">Harga Beli (HPP)</th>
                                    <th className="px-4 py-3.5">Harga Jual</th>
                                    <th className="px-4 py-3.5">Harga Grosir</th>
                                    <th className="px-4 py-3.5 text-center">Stok</th>
                                    <th className="px-4 py-3.5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                                {products.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-slate-500">
                                            Tidak ada produk yang cocok dengan pencarian.
                                        </td>
                                    </tr>
                                ) : (
                                    products.data.map((product) => {
                                        const isLowStock = product.stock <= product.min_stock_alert;
                                        const hasTiers = product.price_tiers && product.price_tiers.length > 0;
                                        return (
                                            <tr key={product.id} className="hover:bg-slate-800/40 transition">
                                                <td className="px-4 py-3">
                                                    <div className="font-mono text-emerald-400 font-semibold">{product.barcode}</div>
                                                    {product.sku && <div className="text-[10px] text-slate-500 font-mono">{product.sku}</div>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-100">{product.name}</div>
                                                    <div className="text-[10px] text-slate-400">Satuan: {product.unit}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                                                        {product.category?.name || 'Tanpa Kategori'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-400">
                                                    {formatRp(product.buy_price)}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-100">
                                                    {formatRp(product.sell_price)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {hasTiers ? (
                                                        <div className="space-y-0.5">
                                                            {product.price_tiers?.map((t) => (
                                                                <div key={t.id} className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                                                                    <Sparkles className="h-2.5 w-2.5" /> $\ge$ {t.min_qty} pcs: {formatRp(t.tier_price)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 text-[10px]">Standard</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                        isLowStock 
                                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    }`}>
                                                        {isLowStock && <AlertTriangle className="h-3 w-3" />}
                                                        {product.stock} {product.unit}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => handleOpenAdjust(product)}
                                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                                                            title="Koreksi / Restock Stok"
                                                        >
                                                            <ArrowUpDown className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEdit(product)}
                                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition"
                                                            title="Edit Produk & Harga Grosir"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {products.last_page > 1 && (
                        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <div>Total: {products.total} Produk</div>
                            <div className="flex gap-1">
                                {products.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                                            link.active
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ================= MODALS ================= */}

            {/* 1. ADD / EDIT PRODUCT MODAL */}
            {isFormModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <Package className="h-5 w-5 text-emerald-400" />
                                {editingProduct ? 'Edit Informasi Produk' : 'Tambah Produk Baru'}
                            </h3>
                            <button
                                onClick={() => setIsFormModalOpen(false)}
                                className="h-7 w-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitProduct} className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Barcode (EAN-13 / Code 128) *</label>
                                    <div className="relative">
                                        <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                        <input
                                            type="text"
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            placeholder="Contoh: 8991234567011"
                                            required
                                            className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-white font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">SKU / Kode Internal (Opsional)</label>
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        placeholder="Contoh: FNB-001"
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Nama Produk *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: Indomie Goreng Original 85g"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Kategori</label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                                    >
                                        <option value="">Pilih Kategori</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Satuan</label>
                                    <input
                                        type="text"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        placeholder="pcs, botol, pack, dus"
                                        required
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Harga Beli / HPP (Rp) *</label>
                                    <input
                                        type="number"
                                        value={formData.buy_price}
                                        onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
                                        placeholder="2750"
                                        required
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Harga Jual Standar (Rp) *</label>
                                    <input
                                        type="number"
                                        value={formData.sell_price}
                                        onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                                        placeholder="3500"
                                        required
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-bold text-emerald-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Stok Awal</label>
                                    <input
                                        type="number"
                                        disabled={!!editingProduct}
                                        value={formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                                    />
                                    {editingProduct && <span className="text-[10px] text-slate-500">Gunakan tombol penyesuaian untuk ubah stok</span>}
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-300 mb-1">Peringatan Batas Stok Menipis</label>
                                    <input
                                        type="number"
                                        value={formData.min_stock_alert}
                                        onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            {/* Wholesale / Tiered Pricing Section */}
                            <div className="border-t border-slate-800 pt-4 mt-2">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                                            <Sparkles className="h-4 w-4 text-amber-400" />
                                            Harga Grosir Bertingkat (Tier Pricing)
                                        </h4>
                                        <p className="text-[11px] text-slate-400">Atur harga otomatis lebih murah jika pelanggan membeli dalam jumlah banyak</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddTier}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1 transition"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Tambah Tier
                                    </button>
                                </div>

                                {formData.tiers.length === 0 ? (
                                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center text-slate-500 text-xs">
                                        Belum ada aturan harga grosir. Klik "Tambah Tier" untuk menambahkan.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {formData.tiers.map((tier, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                                <span className="text-slate-400 text-xs">Min Beli:</span>
                                                <input
                                                    type="number"
                                                    value={tier.min_qty}
                                                    onChange={(e) => {
                                                        const updated = [...formData.tiers];
                                                        updated[idx].min_qty = parseInt(e.target.value) || 2;
                                                        setFormData({ ...formData, tiers: updated });
                                                    }}
                                                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold"
                                                />
                                                <span className="text-slate-400 text-xs">Harga / Unit: Rp</span>
                                                <input
                                                    type="number"
                                                    value={tier.tier_price}
                                                    onChange={(e) => {
                                                        const updated = [...formData.tiers];
                                                        updated[idx].tier_price = parseFloat(e.target.value) || 0;
                                                        setFormData({ ...formData, tiers: updated });
                                                    }}
                                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-amber-300 font-bold"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTier(idx)}
                                                    className="text-slate-500 hover:text-rose-400 p-1"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-900/30"
                                >
                                    {editingProduct ? 'Simpan Perubahan' : 'Simpan Produk Baru'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. STOCK ADJUSTMENT / RESTOCK MODAL */}
            {isAdjustModalOpen && adjustingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <ArrowUpDown className="h-5 w-5 text-amber-400" />
                                Penyesuaian Stok Barang
                            </h3>
                            <button
                                onClick={() => setIsAdjustModalOpen(false)}
                                className="h-7 w-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAdjust} className="p-5 space-y-4 text-xs">
                            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                                <div className="font-bold text-slate-200">{adjustingProduct.name}</div>
                                <div className="text-slate-400 mt-0.5">Stok Saat Ini: <strong className="text-emerald-400">{adjustingProduct.stock} {adjustingProduct.unit}</strong></div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Jenis Penyesuaian</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'restock', label: 'Restock / Masuk' },
                                        { id: 'adjustment', label: 'Opname / Koreksi' },
                                        { id: 'return', label: 'Retur Supplier' },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setAdjustType(t.id as any)}
                                            className={`py-2 px-1 rounded-xl font-semibold text-center border transition ${
                                                adjustType === t.id
                                                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                                                    : 'bg-slate-950 text-slate-400 border-slate-800'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {adjustType === 'adjustment' && (
                                <div className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                                    <input
                                        type="checkbox"
                                        id="reductionCheck"
                                        checked={isReduction}
                                        onChange={(e) => setIsReduction(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
                                    />
                                    <label htmlFor="reductionCheck" className="text-slate-300 font-semibold cursor-pointer">
                                        Koreksi Pengurangan (Barang Rusak / Hilang)
                                    </label>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Jumlah Perubahan ({adjustingProduct.unit}) *</label>
                                <input
                                    type="number"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(e.target.value)}
                                    placeholder="Contoh: 24"
                                    required
                                    min="1"
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-white font-bold"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-300 mb-1">Catatan / No. Surat Jalan / Alasan</label>
                                <input
                                    type="text"
                                    value={adjustNotes}
                                    onChange={(e) => setAdjustNotes(e.target.value)}
                                    placeholder="Restock dari Distributor ABC / Barang bocor"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-white"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-lg shadow-amber-900/30"
                            >
                                Konfirmasi Penyesuaian Stok
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
