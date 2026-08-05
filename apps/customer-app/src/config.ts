import type { Audience, ThemeMode } from '@hillexpress/shared';

/** The ONLY file that differs between customer/driver/pos apps. */
export const APP_AUDIENCE: Audience = 'CUSTOMER';

/** Driver app forces 'dark' (night riding); others follow the OS. */
export const APP_THEME_FORCE: ThemeMode | undefined = undefined;
