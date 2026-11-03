import { PageProps as InertiaPageProps } from '@inertiajs/core';
import { AxiosInstance } from 'axios';
import { Config as ZiggyConfig, route as ziggyRoute } from 'ziggy-js';
import { PageProps as AppPageProps } from './';

declare global {
    interface MidtransSnapCallbacks {
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (result: unknown) => void;
        onClose?: () => void;
    }

    interface Window {
        axios: AxiosInstance;
        Ziggy?: ZiggyConfig;
        snap?: {
            pay: (token: string, callbacks?: MidtransSnapCallbacks) => void;
        };
    }

    /* eslint-disable no-var */
    var route: typeof ziggyRoute;
    var Ziggy: ZiggyConfig | undefined;
}

declare module '@inertiajs/core' {
    interface PageProps extends InertiaPageProps, AppPageProps {}
}
