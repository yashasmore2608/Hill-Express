import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from './api';
import { secureDelete, secureGet, secureSet } from './secure-storage';
import { APP_AUDIENCE } from '../config';

interface SessionUser {
  sub: string;
  aud: string;
  phone: string;
  storeId?: string;
  driverId?: string;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: SessionUser | null;
  accessToken: string | null;
  requestOtp: (phone: string) => Promise<{ devOtp?: string; expiresInSec: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const ACCESS_KEY = 'he.accessToken';
const REFRESH_KEY = 'he.refreshToken';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const persist = useCallback(async (t: TokenResponse) => {
    await secureSet(ACCESS_KEY, t.accessToken);
    await secureSet(REFRESH_KEY, t.refreshToken);
    setAccessToken(t.accessToken);
    setUser(t.user);
    setStatus('signedIn');
  }, []);

  // Restore on launch: rotate the refresh token so blocks/suspensions applied
  // since last open take effect immediately.
  useEffect(() => {
    (async () => {
      try {
        const refreshToken = await secureGet(REFRESH_KEY);
        if (!refreshToken) {
          setStatus('signedOut');
          return;
        }
        const t = await apiFetch<TokenResponse>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
        });
        await persist(t);
      } catch {
        await secureDelete(ACCESS_KEY).catch(() => {});
        await secureDelete(REFRESH_KEY).catch(() => {});
        setStatus('signedOut');
      }
    })();
  }, [persist]);

  const requestOtp = useCallback(
    (phone: string) =>
      apiFetch<{ devOtp?: string; expiresInSec: number }>('/auth/otp/request', {
        method: 'POST',
        body: { phone, audience: APP_AUDIENCE },
      }),
    [],
  );

  const verifyOtp = useCallback(
    async (phone: string, otp: string) => {
      const t = await apiFetch<TokenResponse>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, otp, audience: APP_AUDIENCE },
      });
      await persist(t);
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    await secureDelete(ACCESS_KEY).catch(() => {});
    await secureDelete(REFRESH_KEY).catch(() => {});
    setAccessToken(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(
    () => ({ status, user, accessToken, requestOtp, verifyOtp, signOut }),
    [status, user, accessToken, requestOtp, verifyOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
