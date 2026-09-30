export interface PriceTier {
    id: number;
    product_id: number;
    min_qty: number;
    tier_price: number | string;
}

export interface Category {
    id: number;
    name: string;
    slug: string;
}

export interface Product {
    id: number;
    category_id: number | null;
    barcode: string;
    sku: string | null;
    name: string;
    buy_price: number | string;
    sell_price: number | string;
    stock: number;
    min_stock_alert: number;
    unit: string;
    is_active: boolean;
    category?: Category;
    price_tiers?: PriceTier[];
}

export interface CartItem {
    product: Product;
    qty: number;
    original_price: number;
    applied_price: number;
    is_tier_applied: boolean;
    subtotal: number;
    discount_amount: number;
}

export interface CashMutation {
    id: number;
    shift_id: number;
    type: 'in' | 'out';
    amount: number | string;
    reason: string;
    created_at: string;
}

export interface Shift {
    id: number;
    user_id: number;
    opened_at: string;
    closed_at: string | null;
    starting_cash: number | string;
    expected_cash: number | string;
    actual_cash: number | string | null;
    difference: number | string | null;
    status: 'open' | 'closed';
    notes: string | null;
    cash_mutations?: CashMutation[];
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

export interface HeldOrder {
    id: string;
    customer_name: string;
    items: {
        product_id: number;
        qty: number;
        product_name?: string;
        subtotal?: number;
    }[];
    held_at: string;
    total_items: number;
}

export interface SaleItem {
    id: number;
    sale_id: number;
    product_id: number;
    qty: number;
    buy_price: number | string;
    sell_price: number | string;
    discount_amount: number | string;
    subtotal: number | string;
    product?: Product;
}

export interface PaymentDetail {
    id: number;
    sale_id: number;
    payment_type: 'cash' | 'qris' | 'transfer' | 'debit';
    amount: number | string;
    reference_no: string | null;
}

export interface Sale {
    id: number;
    invoice_no: string;
    shift_id: number;
    cashier_id: number;
    customer_name: string;
    subtotal: number | string;
    discount_amount: number | string;
    tax_amount: number | string;
    grand_total: number | string;
    total_buy_price: number | string;
    paid_amount: number | string;
    change_amount: number | string;
    status: 'completed' | 'hold' | 'void';
    notes: string | null;
    created_at: string;
    items?: SaleItem[];
    payment_details?: PaymentDetail[];
    cashier?: {
        id: number;
        name: string;
    };
}
