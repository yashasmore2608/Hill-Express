import type { Audience, ThemeMode } from '@hillexpress/shared';

/** The ONLY file that differs between customer/driver/pos apps. */
export const APP_AUDIENCE: Audience = 'POS';

/** Pinned to light — counters are indoors and often bright. */
export const APP_THEME_FORCE: ThemeMode | undefined = undefined;
