import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { 
    Barcode, 
    Search, 
    Plus, 
    Minus, 
    Trash2, 
    CreditCard, 
    DollarSign, 
    QrCode, 
    PauseCircle, 
    PlayCircle, 
    Printer, 
    CheckCircle2, 
    AlertTriangle, 
    Lock, 
    Unlock, 
    ArrowDownRight, 
    ArrowUpRight, 
    Sparkles,
    ShoppingBag,
    Coins,
    X
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { Category, Product, Shift, HeldOrder, CartItem, Sale } from '@/types/pos';

interface Props {
    currentShift: Shift | null;
    categories: Category[];
    products: Product[];
    heldOrders: HeldOrder[];
}

export default function PosIndex({ currentShift, categories, products, heldOrders: initialHeldOrders }: Props) {
    // State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(initialHeldOrders);

    // Modals
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
    const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(!currentShift);
    const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
    const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);

    // Checkout & Payment State
    const [paymentType, setPaymentType] = useState<'cash' | 'qris' | 'transfer' | 'debit'>('cash');
    const [paidAmount, setPaidAmount] = useState<string>('');
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

    // Shift Form State
    const [startingCashInput, setStartingCashInput] = useState('200000');
    const [actualCashInput, setActualCashInput] = useState('');
    const [shiftNotes, setShiftNotes] = useState('');
    const [mutationType, setMutationType] = useState<'in' | 'out'>('out');
    const [mutationAmount, setMutationAmount] = useState('');
    const [mutationReason, setMutationReason] = useState('');

    // Refs
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const paidInputRef = useRef<HTMLInputElement>(null);

    // Focus barcode input on mount and when modals close
    useEffect(() => {
        if (!isCheckoutOpen && !isReceiptOpen && !isHeldModalOpen && !isOpenShiftModalOpen && !isCloseShiftModalOpen && !isMutationModalOpen) {
            barcodeInputRef.current?.focus();
        }
    }, [isCheckoutOpen, isReceiptOpen, isHeldModalOpen, isOpenShiftModalOpen, isCloseShiftModalOpen, isMutationModalOpen]);

    // Keyboard Shortcuts (F2, F4, F8, F9, ESC)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                barcodeInputRef.current?.focus();
                barcodeInputRef.current?.select();
            } else if (e.key === 'F4') {
                e.preventDefault();
                if (cart.length > 0 && currentShift) {
                    openCheckout();
                }
            } else if (e.key === 'F8') {
                e.preventDefault();
                if (cart.length > 0) {
                    handleHoldCart();
                }
            } else if (e.key === 'F9') {
                e.preventDefault();
                setIsHeldModalOpen(true);
            } else if (e.key === 'Escape') {
                setIsCheckoutOpen(false);
                setIsReceiptOpen(false);
                setIsHeldModalOpen(false);
                setIsCloseShiftModalOpen(false);
                setIsMutationModalOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, currentShift]);

    // Calculate item pricing based on tiered/wholesale rules
    const calculateItemPrice = (product: Product, qty: number) => {
        const basePrice = Number(product.sell_price);
        let appliedPrice = basePrice;
        let isTierApplied = false;

        if (product.price_tiers && product.price_tiers.length > 0) {
            // Sort tiers descending by min_qty
            const sortedTiers = [...product.price_tiers].sort((a, b) => b.min_qty - a.min_qty);
            for (const tier of sortedTiers) {
                if (qty >= tier.min_qty) {
                    appliedPrice = Number(tier.tier_price);
                    isTierApplied = true;
                    break;
                }
            }
        }

        const subtotal = appliedPrice * qty;
        const discountAmount = (basePrice - appliedPrice) * qty;

        return {
            original_price: basePrice,
            applied_price: appliedPrice,
            is_tier_applied: isTierApplied,
            subtotal,
            discount_amount: Math.max(0, discountAmount),
        };
    };

    // Add product to cart
    const addToCart = (product: Product, quantityToAdd = 1) => {
        if (!currentShift) {
            setIsOpenShiftModalOpen(true);
            return;
        }

        if (product.stock <= 0) {
            alert(`Stok produk ${product.name} telah habis!`);
            return;
        }

        setCart((prevCart) => {
            const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);

            if (existingIndex > -1) {
                const existingItem = prevCart[existingIndex];
                const newQty = existingItem.qty + quantityToAdd;

                if (newQty > product.stock) {
                    alert(`Stok hanya tersedia ${product.stock} ${product.unit}`);
                    return prevCart;
                }

                const priceCalc = calculateItemPrice(product, newQty);
                const updatedItem: CartItem = {
                    ...existingItem,
                    qty: newQty,
                    ...priceCalc,
                };

                const updatedCart = [...prevCart];
                updatedCart[existingIndex] = updatedItem;
                return updatedCart;
            } else {
                const priceCalc = calculateItemPrice(product, quantityToAdd);
                const newItem: CartItem = {
                    product,
                    qty: quantityToAdd,
                    ...priceCalc,
                };
                return [newItem, ...prevCart];
            }
        });

        setSearchQuery('');
        barcodeInputRef.current?.focus();
    };

    // Update quantity in cart
    const updateQty = (productId: number, delta: number) => {
        setCart((prevCart) => {
            return prevCart
                .map((item) => {
                    if (item.product.id === productId) {
                        const newQty = item.qty + delta;
                        if (newQty <= 0) return null;
                        if (newQty > item.product.stock) {
                            alert(`Maksimal stok tersedia: ${item.product.stock}`);
                            return item;
                        }
                        const priceCalc = calculateItemPrice(item.product, newQty);
                        return {
                            ...item,
                            qty: newQty,
                            ...priceCalc,
                        };
                    }
                    return item;
                })
                .filter(Boolean) as CartItem[];
        });
    };

    // Remove item from cart
    const removeFromCart = (productId: number) => {
        setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
    };

    // Barcode Scanner submission handler
    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchQuery.trim();
        if (!trimmed) return;

        // Try exact match on barcode or sku first
        const exactMatch = products.find(
            (p) => p.barcode.toLowerCase() === trimmed.toLowerCase() || (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase())
        );

        if (exactMatch) {
            addToCart(exactMatch);
        } else {
            // Partial match on name
            const nameMatch = products.find((p) => p.name.toLowerCase().includes(trimmed.toLowerCase()));
            if (nameMatch) {
                addToCart(nameMatch);
            } else {
                alert(`Produk dengan barcode/nama "${trimmed}" tidak ditemukan.`);
            }
        }
    };

    // Totals Calculation
    const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
    const subtotal = cart.reduce((acc, item) => acc + item.original_price * item.qty, 0);
    const totalDiscount = cart.reduce((acc, item) => acc + item.discount_amount, 0);
    const grandTotal = cart.reduce((acc, item) => acc + item.subtotal, 0);

    const paidNum = parseFloat(paidAmount) || 0;
    const changeAmount = Math.max(0, paidNum - grandTotal);

    // Open Checkout Modal
    const openCheckout = () => {
        setPaymentType('cash');
        setPaidAmount(grandTotal.toString());
        setCheckoutError(null);
        setIsCheckoutOpen(true);
        setTimeout(() => paidInputRef.current?.select(), 100);
    };

    // Execute Checkout API
    const handleCheckoutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isProcessingCheckout) return;

        if (paymentType === 'cash' && paidNum < grandTotal) {
            setCheckoutError('Nominal uang tunai kurang dari total belanja.');
            return;
        }

        setIsProcessingCheckout(true);
        setCheckoutError(null);

        try {
            const payload = {
                items: cart.map((item) => ({
                    product_id: item.product.id,
                    qty: item.qty,
                })),
                customer_name: customerName || 'Pelanggan Umum',
                payment_type: paymentType,
                paid_amount: paymentType === 'cash' ? paidNum : grandTotal,
            };

            const res = await axios.post(route('pos.checkout'), payload);
            setLastSale(res.data.sale);
            setIsCheckoutOpen(false);
            setCart([]);
            setCustomerName('');
            setIsReceiptOpen(true);
            router.reload({ only: ['products', 'currentShift'] });
        } catch (err: any) {
            setCheckoutError(err.response?.data?.message || 'Terjadi kesalahan saat memproses transaksi.');
        } finally {
            setIsProcessingCheckout(false);
        }
    };

    // Hold / Park Cart
    const handleHoldCart = async () => {
        if (cart.length === 0) return;

        try {
            const payload = {
                customer_name: customerName || `Antrean #${heldOrders.length + 1}`,
                items: cart.map((item) => ({
                    product_id: item.product.id,
                    qty: item.qty,
                    product_name: item.product.name,
                    subtotal: item.subtotal,
                })),
            };

            const res = await axios.post(route('pos.hold'), payload);
            setHeldOrders(res.data.heldOrders);
            setCart([]);
            setCustomerName('');
            alert('Transaksi berhasil diparkir! Anda dapat melayani antrean berikutnya.');
        } catch (err) {
            alert('Gagal memarkir transaksi.');
        }
    };

    // Resume Parked Cart
    const handleResumeHeldOrder = async (held: HeldOrder) => {
        try {
            await axios.delete(route('pos.release-hold', held.id));
            setHeldOrders((prev) => prev.filter((o) => o.id !== held.id));

            // Populate cart with held items
            const newCartItems: CartItem[] = [];
            for (const hItem of held.items) {
                const product = products.find((p) => p.id === hItem.product_id);
                if (product) {
                    const priceCalc = calculateItemPrice(product, hItem.qty);
                    newCartItems.push({
                        product,
                        qty: hItem.qty,
                        ...priceCalc,
                    });
                }
            }

            setCart(newCartItems);
            setCustomerName(held.customer_name);
            setIsHeldModalOpen(false);
        } catch (err) {
            alert('Gagal memulihkan transaksi.');
        }
    };

    // Open Shift Form Submit
    const handleOpenShift = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route('shifts.open'), {
            starting_cash: parseFloat(startingCashInput) || 0,
            notes: shiftNotes,
        }, {
            onSuccess: () => {
                setIsOpenShiftModalOpen(false);
            }
        });
    };

    // Close Shift Form Submit
    const handleCloseShift = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentShift) return;

        try {
            const res = await axios.post(route('shifts.close'), {
                shift_id: currentShift.id,
                actual_cash: parseFloat(actualCashInput) || 0,
                notes: shiftNotes,
            });

            alert(`Shift kasir berhasil ditutup. Status Rekonsiliasi: ${res.data.reconciliation.status}`);
            setIsCloseShiftModalOpen(false);
            router.reload();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Gagal menutup shift.');
        }
    };

    // Petty Cash Mutation Submit
    const handleAddMutation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentShift) return;

        try {
            await axios.post(route('shifts.mutations'), {
                shift_id: currentShift.id,
                type: mutationType,
                amount: parseFloat(mutationAmount) || 0,
                reason: mutationReason,
            });

            alert('Arus kas laci berhasil dicatat!');
            setIsMutationModalOpen(false);
            setMutationAmount('');
            setMutationReason('');
            router.reload();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Gagal mencatat mutasi kas.');
        }
    };

    // Format Rupiah Helper
    const formatRp = (val: number | string) => {
        const num = Number(val) || 0;
        return 'Rp ' + num.toLocaleString('id-ID');
    };

    // Filter products
    const filteredProducts = products.filter((p) => {
        const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
        const matchesSearch = searchQuery
            ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.barcode.includes(searchQuery) ||
              (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
            : true;
        return matchesCategory && matchesSearch;
    });

    return (
        <AuthenticatedLayout>
            <Head title="Terminal Kasir POS" />

            <div className="flex flex-col h-[calc(100vh-4.1rem)] bg-slate-950 overflow-hidden">
                {/* 1. TOP STATUS & ACTION BAR */}
                <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Shift Info */}
                    <div className="flex items-center gap-3">
                        {currentShift ? (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                <Unlock className="h-3.5 w-3.5" />
                                <span className="font-semibold">Shift Aktif</span>
                                <span className="text-slate-400">|</span>
                                <span>Modal Awal: {formatRp(currentShift.starting_cash)}</span>
                                <span className="text-slate-400">|</span>
                                <span>Ekspektasi Kas Laci: <strong className="text-emerald-300">{formatRp(currentShift.expected_cash)}</strong></span>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsOpenShiftModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
                            >
                                <Lock className="h-3.5 w-3.5" />
                                Buka Shift Kasir Baru
                            </button>
                        )}

                        {currentShift && (
                            <>
                                <button
                                    onClick={() => setIsMutationModalOpen(true)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
                                >
                                    <Coins className="h-3.5 w-3.5 text-amber-400" />
                                    Kas Masuk / Keluar (Petty Cash)
                                </button>
                                <button
                                    onClick={() => {
                                        setActualCashInput(currentShift.expected_cash.toString());
                                        setIsCloseShiftModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5"
                                >
                                    <Lock className="h-3.5 w-3.5" />
                                    Tutup Shift
                                </button>
                            </>
                        )}
                    </div>

                    {/* Shortcuts Cheat Sheet & Held Orders */}
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => setIsHeldModalOpen(true)}
                            className="relative flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium transition"
                        >
                            <PauseCircle className="h-3.5 w-3.5" />
                            <span>Parkir Order (F9)</span>
                            {heldOrders.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                                    {heldOrders.length}
                                </span>
                            )}
                        </button>

                        <div className="hidden lg:flex items-center gap-2 text-slate-400 bg-slate-800/60 px-3 py-1 rounded-lg border border-slate-700/50">
                            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[10px]">F2</kbd> Cari/Barcode</span>
                            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[10px]">F4</kbd> Bayar</span>
                            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[10px]">F8</kbd> Hold</span>
                        </div>
                    </div>
                </div>

                {/* 2. MAIN POS WORKSPACE */}
                <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
                    {/* LEFT / CENTER: BARCODE & PRODUCT CATALOG (7 or 8 cols) */}
                    <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col border-r border-slate-800 bg-slate-950 p-4 overflow-y-auto">
                        {/* Barcode & Search Input Bar */}
                        <form onSubmit={handleBarcodeSubmit} className="relative mb-4">
                            <div className="relative flex items-center">
                                <Barcode className="absolute left-4 h-6 w-6 text-emerald-400 pointer-events-none" />
                                <input
                                    ref={barcodeInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Scan Barcode EAN-13 atau Ketik Nama Produk (Tekan Enter)... [F2]"
                                    className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl pl-13 pr-24 py-3.5 text-base font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-inner transition"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-md"
                                >
                                    <Search className="h-3.5 w-3.5" />
                                    Cari
                                </button>
                            </div>
                        </form>

                        {/* Category Filter Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-thin">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                                    selectedCategory === null
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                                }`}
                            >
                                Semua Produk ({products.length})
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                                        selectedCategory === cat.id
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Product Quick-Click Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 flex-1 overflow-y-auto pr-1">
                            {filteredProducts.map((product) => {
                                const hasTiers = product.price_tiers && product.price_tiers.length > 0;
                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="group bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800/80 hover:border-emerald-500/50 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 active:scale-[0.98]"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-1 mb-1.5">
                                                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 group-hover:bg-slate-700">
                                                    {product.barcode}
                                                </span>
                                                {hasTiers && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                                        <Sparkles className="h-2.5 w-2.5" /> Grosir
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-semibold text-slate-100 group-hover:text-emerald-300 line-clamp-2 transition-colors">
                                                {product.name}
                                            </h3>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-end justify-between">
                                            <div>
                                                <div className="text-xs text-slate-400">
                                                    Stok: <span className={product.stock <= product.min_stock_alert ? 'text-rose-400 font-bold' : 'text-slate-300'}>{product.stock} {product.unit}</span>
                                                </div>
                                                <div className="text-sm font-bold text-emerald-400">
                                                    {formatRp(product.sell_price)}
                                                </div>
                                            </div>
                                            <button className="h-7 w-7 rounded-lg bg-slate-800 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white flex items-center justify-center transition-colors shadow-sm">
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT: ACTIVE CART & CHECKOUT TERMINAL (5 or 4 cols) */}
                    <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col bg-slate-900 h-full">
                        {/* Cart Header */}
                        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5 text-emerald-400" />
                                <h2 className="text-sm font-bold text-slate-100">Keranjang Transaksi</h2>
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
                                    {totalItems} item
                                </span>
                            </div>

                            {cart.length > 0 && (
                                <button
                                    onClick={() => setCart([])}
                                    className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Kosongkan
                                </button>
                            )}
                        </div>

                        {/* Customer Name input */}
                        <div className="px-3.5 pt-2 pb-1 bg-slate-900/60 border-b border-slate-800/50 flex items-center gap-2">
                            <span className="text-xs text-slate-400">Pelanggan:</span>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Nama Pelanggan (Opsional / Umum)"
                                className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                            />
                        </div>

                        {/* Cart Items List */}
                        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 divide-y divide-slate-800/50">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                    <ShoppingBag className="h-12 w-12 text-slate-700 mb-2 stroke-[1.5]" />
                                    <p className="text-sm font-medium">Keranjang masih kosong</p>
                                    <p className="text-xs text-slate-600 mt-1">Scan barcode atau klik produk di sebelah kiri</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.product.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="text-xs font-semibold text-slate-200 truncate">{item.product.name}</h4>
                                                {item.is_tier_applied && (
                                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                                                        Grosir
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                {formatRp(item.applied_price)} x {item.qty} {item.product.unit}
                                                {item.discount_amount > 0 && (
                                                    <span className="text-emerald-400 ml-1.5 font-medium">
                                                        (Hemat {formatRp(item.discount_amount)})
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Qty Counter & Subtotal */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                                                <button
                                                    onClick={() => updateQty(item.product.id, -1)}
                                                    className="h-6 w-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </button>
                                                <span className="w-8 text-center text-xs font-bold text-slate-100">{item.qty}</span>
                                                <button
                                                    onClick={() => updateQty(item.product.id, 1)}
                                                    className="h-6 w-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                            </div>

                                            <div className="w-20 text-right font-bold text-xs text-slate-100">
                                                {formatRp(item.subtotal)}
                                            </div>

                                            <button
                                                onClick={() => removeFromCart(item.product.id)}
                                                className="text-slate-500 hover:text-rose-400 transition"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Cart Summary & Action Buttons */}
                        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Subtotal</span>
                                    <span>{formatRp(subtotal)}</span>
                                </div>
                                {totalDiscount > 0 && (
                                    <div className="flex justify-between text-amber-400 font-medium">
                                        <span>Diskon Grosir / Tier</span>
                                        <span>-{formatRp(totalDiscount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                                    <span className="text-sm font-bold text-slate-200">TOTAL TAGIHAN</span>
                                    <span className="text-2xl font-black text-emerald-400 tracking-tight">
                                        {formatRp(grandTotal)}
                                    </span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    onClick={handleHoldCart}
                                    disabled={cart.length === 0}
                                    className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-amber-400 font-bold text-xs border border-amber-500/20 transition flex items-center justify-center gap-2"
                                >
                                    <PauseCircle className="h-4 w-4" />
                                    Hold Order (F8)
                                </button>

                                <button
                                    onClick={openCheckout}
                                    disabled={cart.length === 0 || !currentShift}
                                    className="py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-2"
                                >
                                    <CreditCard className="h-4 w-4" />
                                    BAYAR [F4]
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================= MODALS ================= */}

            {/* 1. CHECKOUT MODAL (F4) */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-emerald-400" />
                                    Penyelesaian Pembayaran
                                </h3>
                                <p className="text-xs text-slate-400">Pilih metode bayar dan masukkan nominal</p>
                            </div>
                            <button
                                onClick={() => setIsCheckoutOpen(false)}
                                className="h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCheckoutSubmit} className="p-5 space-y-4">
                            {checkoutError && (
                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>{checkoutError}</span>
                                </div>
                            )}

                            {/* Grand Total Display */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Tagihan</div>
                                <div className="text-3xl font-black text-emerald-400 mt-1">{formatRp(grandTotal)}</div>
                                <div className="text-xs text-slate-500 mt-1">{totalItems} Item Produk</div>
                            </div>

                            {/* Payment Method Tabs */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-2">Metode Pembayaran</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: 'cash', label: 'Tunai', icon: DollarSign },
                                        { id: 'qris', label: 'QRIS', icon: QrCode },
                                        { id: 'transfer', label: 'Transfer', icon: CreditCard },
                                        { id: 'debit', label: 'Debit', icon: CreditCard },
                                    ].map((m) => {
                                        const Icon = m.icon;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => {
                                                    setPaymentType(m.id as any);
                                                    if (m.id !== 'cash') {
                                                        setPaidAmount(grandTotal.toString());
                                                    }
                                                }}
                                                className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition border ${
                                                    paymentType === m.id
                                                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                                                }`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {m.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cash Specific Controls */}
                            {paymentType === 'cash' && (
                                <div className="space-y-3">
                                    {/* Quick Cash Buttons */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'Uang Pas', val: grandTotal },
                                            { label: '+10.000', val: Math.ceil(grandTotal / 10000) * 10000 || 10000 },
                                            { label: '50.000', val: 50000 },
                                            { label: '100.000', val: 100000 },
                                        ].map((btn, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setPaidAmount(btn.val.toString())}
                                                className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                                            >
                                                {btn.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Nominal Input & Kembalian */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">Nominal Diterima (Rp)</label>
                                        <input
                                            ref={paidInputRef}
                                            type="number"
                                            value={paidAmount}
                                            onChange={(e) => setPaidAmount(e.target.value)}
                                            className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-lg font-bold text-white focus:outline-none"
                                        />
                                    </div>

                                    {/* Kembalian Banner */}
                                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-400">Kembalian</span>
                                        <span className={`text-xl font-bold ${changeAmount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                                            {formatRp(changeAmount)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCheckoutOpen(false)}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                                >
                                    Batal (ESC)
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessingCheckout}
                                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-900/40"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    {isProcessingCheckout ? 'Memproses...' : 'SELESAIKAN TRANSAKSI (ENTER)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. THERMAL RECEIPT MODAL */}
            {isReceiptOpen && lastSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                <Printer className="h-4 w-4 text-emerald-400" />
                                Struk Transaksi Selesai
                            </h3>
                            <button
                                onClick={() => setIsReceiptOpen(false)}
                                className="h-7 w-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Thermal Monospace Preview Paper */}
                        <div className="p-4 bg-white text-slate-950 font-mono text-[11px] leading-tight select-all">
                            <div className="text-center font-bold text-xs uppercase mb-1">QUICKRETAIL MINIMARKET</div>
                            <div className="text-center text-[10px] text-slate-600">Jl. Retail POS No. 88, Surabaya</div>
                            <div className="text-center text-[10px] text-slate-600">Telp: 0812-3456-7890</div>
                            <div className="border-b border-dashed border-slate-400 my-2"></div>

                            <div className="flex justify-between">
                                <span>No: {lastSale.invoice_no}</span>
                                <span>{new Date(lastSale.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div>Kasir: {lastSale.cashier?.name || 'Kasir'}</div>
                            <div>Pelanggan: {lastSale.customer_name}</div>
                            <div className="border-b border-dashed border-slate-400 my-2"></div>

                            {/* Items */}
                            <div className="space-y-1">
                                {lastSale.items?.map((item, idx) => (
                                    <div key={idx}>
                                        <div className="font-semibold">{item.product?.name}</div>
                                        <div className="flex justify-between text-slate-700 pl-2">
                                            <span>{item.qty} x {Number(item.sell_price).toLocaleString('id-ID')}</span>
                                            <span>{Number(item.subtotal).toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-b border-dashed border-slate-400 my-2"></div>

                            <div className="space-y-0.5">
                                <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span>{Number(lastSale.subtotal).toLocaleString('id-ID')}</span>
                                </div>
                                {Number(lastSale.discount_amount) > 0 && (
                                    <div className="flex justify-between">
                                        <span>Diskon</span>
                                        <span>-{Number(lastSale.discount_amount).toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-xs pt-1">
                                    <span>TOTAL</span>
                                    <span>Rp {Number(lastSale.grand_total).toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span>Bayar ({lastSale.payment_details?.[0]?.payment_type?.toUpperCase()})</span>
                                    <span>Rp {Number(lastSale.paid_amount).toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span>Kembali</span>
                                    <span>Rp {Number(lastSale.change_amount).toLocaleString('id-ID')}</span>
                                </div>
                            </div>

                            <div className="border-b border-dashed border-slate-400 my-2"></div>
                            <div className="text-center text-[10px] text-slate-600">
                                Terima kasih atas kunjungan Anda!<br />
                                Barang yang dibeli tidak dapat ditukar.
                            </div>
                        </div>

                        {/* Print / Close Buttons */}
                        <div className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                            <button
                                onClick={() => window.print()}
                                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                                <Printer className="h-4 w-4" />
                                Cetak Struk (Thermal)
                            </button>
                            <button
                                onClick={() => setIsReceiptOpen(false)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. HELD ORDERS MODAL (F9) */}
            {isHeldModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                <PauseCircle className="h-4 w-4 text-amber-400" />
                                Daftar Transaksi yang Diparkir ({heldOrders.length})
                            </h3>
                            <button
                                onClick={() => setIsHeldModalOpen(false)}
                                className="h-7 w-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-4 max-h-80 overflow-y-auto space-y-2.5">
                            {heldOrders.length === 0 ? (
                                <p className="text-center text-xs text-slate-500 py-6">Tidak ada transaksi yang sedang diparkir.</p>
                            ) : (
                                heldOrders.map((held) => (
                                    <div
                                        key={held.id}
                                        className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3"
                                    >
                                        <div>
                                            <div className="text-xs font-bold text-slate-200">{held.customer_name}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                {held.total_items} item | {new Date(held.held_at).toLocaleTimeString('id-ID')}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleResumeHeldOrder(held)}
                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
                                        >
                                            <PlayCircle className="h-3.5 w-3.5" />
                                            Lanjutkan
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. OPEN SHIFT MODAL */}
            {isOpenShiftModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-800">
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <Unlock className="h-5 w-5 text-emerald-400" />
                                Buka Shift Kasir Baru
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">Masukkan modal kas awal untuk memulai transaksi</p>
                        </div>

                        <form onSubmit={handleOpenShift} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Modal Kas Awal (Uang Kembalian)</label>
                                <input
                                    type="number"
                                    value={startingCashInput}
                                    onChange={(e) => setStartingCashInput(e.target.value)}
                                    placeholder="200000"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-base font-bold text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan Shift (Opsional)</label>
                                <input
                                    type="text"
                                    value={shiftNotes}
                                    onChange={(e) => setShiftNotes(e.target.value)}
                                    placeholder="Shift Pagi / Kasir 1"
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-900/30"
                            >
                                Buka Laci & Mulai Transaksi
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 5. CLOSE SHIFT & RECONCILIATION MODAL */}
            {isCloseShiftModalOpen && currentShift && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-rose-400" />
                                    Tutup Shift & Rekonsiliasi Kas
                                </h3>
                                <p className="text-xs text-slate-400">Hitung total uang fisik dalam laci kasir</p>
                            </div>
                            <button
                                onClick={() => setIsCloseShiftModalOpen(false)}
                                className="h-7 w-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCloseShift} className="p-5 space-y-4">
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Modal Awal:</span>
                                    <span>{formatRp(currentShift.starting_cash)}</span>
                                </div>
                                <div className="flex justify-between text-slate-300 font-semibold border-t border-slate-800 pt-2">
                                    <span>Ekspektasi Kas Sistem:</span>
                                    <span className="text-emerald-400">{formatRp(currentShift.expected_cash)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Total Uang Fisik Terhitung di Laci (Rp)</label>
                                <input
                                    type="number"
                                    value={actualCashInput}
                                    onChange={(e) => setActualCashInput(e.target.value)}
                                    required
                                    className="w-full bg-slate-950 border-2 border-slate-700 focus:border-rose-500 rounded-xl px-4 py-2.5 text-base font-bold text-white focus:outline-none"
                                />
                            </div>

                            {/* Discrepancy Preview */}
                            {actualCashInput !== '' && (
                                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                                    <span className="text-slate-400">Selisih Kas:</span>
                                    {(() => {
                                        const diff = (parseFloat(actualCashInput) || 0) - Number(currentShift.expected_cash);
                                        return (
                                            <span className={`font-bold ${diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                                {diff === 0 ? 'SEIMBANG (Rp 0)' : `${diff > 0 ? '+ LEBIH' : '- DEFISIT'} ${formatRp(Math.abs(diff))}`}
                                            </span>
                                        );
                                    })()}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan Penutupan Shift</label>
                                <input
                                    type="text"
                                    value={shiftNotes}
                                    onChange={(e) => setShiftNotes(e.target.value)}
                                    placeholder="Selesai shift sore aman"
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCloseShiftModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-900/30"
                                >
                                    Konfirmasi Tutup Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 6. PETTY CASH IN/OUT MODAL */}
            {isMutationModalOpen && currentShift && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <Coins className="h-5 w-5 text-amber-400" />
                                Mutasi Kas Laci (Petty Cash)
                            </h3>
                            <button
                                onClick={() => setIsMutationModalOpen(false)}
                                className="h-7 w-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleAddMutation} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMutationType('out')}
                                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                                        mutationType === 'out'
                                            ? 'bg-rose-600 text-white border-rose-500'
                                            : 'bg-slate-950 text-slate-400 border-slate-800'
                                    }`}
                                >
                                    <ArrowDownRight className="h-4 w-4" />
                                    Kas Keluar (Biaya)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMutationType('in')}
                                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                                        mutationType === 'in'
                                            ? 'bg-emerald-600 text-white border-emerald-500'
                                            : 'bg-slate-950 text-slate-400 border-slate-800'
                                    }`}
                                >
                                    <ArrowUpRight className="h-4 w-4" />
                                    Kas Masuk (Tambah Modal)
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Nominal (Rp)</label>
                                <input
                                    type="number"
                                    value={mutationAmount}
                                    onChange={(e) => setMutationAmount(e.target.value)}
                                    placeholder="25000"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-base font-bold text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Keterangan / Keperluan</label>
                                <input
                                    type="text"
                                    value={mutationReason}
                                    onChange={(e) => setMutationReason(e.target.value)}
                                    placeholder="Beli kantong plastik kresek / Beli galon air"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-900/30"
                            >
                                Simpan Catatan Kas Laci
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
