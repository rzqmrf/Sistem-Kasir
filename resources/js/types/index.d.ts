export type TenantRole = 'owner' | 'manager' | 'cashier';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired';

export interface TenantSubscriptionSummary {
    plan_name: string;
    plan_code: string;
    status: SubscriptionStatus;
    days_left: number | null;
    is_expired: boolean;
}

export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    role?: string;
    is_active?: boolean;
    is_super_admin?: boolean;
}

export interface CurrentTenant {
    id: number;
    name: string;
    slug: string;
    role: TenantRole | null;
}

export interface CurrentOutlet {
    id: number;
    name: string;
    code: string;
    is_main: boolean;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
    };
    tenant: CurrentTenant | null;
    tenants: CurrentTenant[];
    outlet: CurrentOutlet | null;
    outlets: CurrentOutlet[];
    subscription?: TenantSubscriptionSummary | null;
    flash?: {
        success?: string | null;
        error?: string | null;
        pay_invoice_id?: number | null;
    };
};
