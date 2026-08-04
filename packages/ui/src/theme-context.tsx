import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { colorsFor, type ColorRamp, type ThemeMode } from '@hillexpress/shared';

/** Injected by each app so packages/ui stays free of platform storage deps. */
export interface ThemeStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

interface ThemeValue {
  mode: ThemeMode;
  colors: ColorRamp;
  /** False when the app pins a mode (driver is dark-only) — hide the toggle. */
  canToggle: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = 'he.theme';
const ThemeContext = createContext<ThemeValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Pin a mode and disable the toggle (driver app: dark for night riding). */
  force?: ThemeMode;
  /** Default when the user has never chosen. LIGHT — a bright grocery store,
   *  regardless of what the phone's system theme happens to be. */
  defaultMode?: ThemeMode;
  storage?: ThemeStorage;
}

export function ThemeProvider({
  children,
  force,
  defaultMode = 'light',
  storage,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(force ?? defaultMode);

  // Restore the user's choice. Deliberately NOT reading the OS theme: the
  // default is light and only an explicit toggle changes it.
  useEffect(() => {
    if (force || !storage) return;
    let alive = true;
    void storage.get(STORAGE_KEY).then((saved) => {
      if (alive && (saved === 'light' || saved === 'dark')) setModeState(saved);
    });
    return () => {
      alive = false;
    };
  }, [force, storage]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (force) return;
      setModeState(next);
      void storage?.set(STORAGE_KEY, next);
    },
    [force, storage],
  );

  const toggleMode = useCallback(
    () => setMode(mode === 'dark' ? 'light' : 'dark'),
    [mode, setMode],
  );

  const value = useMemo(
    () => ({
      mode,
      colors: colorsFor(mode),
      canToggle: !force,
      setMode,
      toggleMode,
    }),
    [mode, force, setMode, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
