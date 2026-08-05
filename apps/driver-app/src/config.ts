import type { Audience, ThemeMode } from '@hillexpress/shared';

/** The ONLY file that differs between customer/driver/pos apps. */
export const APP_AUDIENCE: Audience = 'DRIVER';

/**
 * Not pinned — the driver can toggle like everyone else.
 * It still OPENS dark (see defaultMode in _layout): a white screen at 9pm on a
 * mountain road wrecks night vision, so dark is the sensible starting point.
 */
export const APP_THEME_FORCE: ThemeMode | undefined = undefined;

/** Where this app starts before the user has ever chosen. */
export const APP_DEFAULT_THEME: ThemeMode = 'dark';
