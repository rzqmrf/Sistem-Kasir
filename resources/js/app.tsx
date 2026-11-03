import '../css/app.css';
import './bootstrap';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'QuickRetail POS';

const syncZiggyTenant = (tenant?: { slug?: string } | null) => {
    if (typeof Ziggy !== 'undefined' && Ziggy) {
        Ziggy.defaults = tenant?.slug ? { ...Ziggy.defaults, tenant: tenant.slug } : {};
    }
};

router.on('success', (event) => {
    const tenant = (event.detail.page.props as { tenant?: { slug?: string } | null }).tenant;
    syncZiggyTenant(tenant);
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        syncZiggyTenant((props.initialPage.props as { tenant?: { slug?: string } | null }).tenant);

        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#10B981',
    },
});
