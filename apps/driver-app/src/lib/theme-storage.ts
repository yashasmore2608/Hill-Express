import type { ThemeStorage } from '@hillexpress/ui';
import { secureGet, secureSet } from './secure-storage';

/**
 * Theme preference persistence, injected into <ThemeProvider>. Reuses the
 * app's existing platform storage shim (localStorage on web, keystore on
 * native) so packages/ui needs no storage dependency of its own.
 */
export const themeStorage: ThemeStorage = {
  get: secureGet,
  set: secureSet,
};
