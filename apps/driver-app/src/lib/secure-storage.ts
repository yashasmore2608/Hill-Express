import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Token storage. `expo-secure-store` is native-only — it throws on web, which
 * silently broke sign-in in the browser preview. Android/iOS keep the
 * hardware-backed keystore; web falls back to localStorage.
 *
 * Web is a DEV PREVIEW surface only (the product ships on Android), so
 * localStorage is acceptable there. If a customer-facing web build is ever
 * shipped, move refresh tokens to an httpOnly cookie instead.
 */
const isWeb = Platform.OS === 'web';

export const secureGet = async (key: string): Promise<string | null> => {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
};

export const secureSet = async (key: string, value: string): Promise<void> => {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private mode — session simply won't persist */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

export const secureDelete = async (key: string): Promise<void> => {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
};
