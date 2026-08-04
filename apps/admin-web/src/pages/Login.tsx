import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api, tokens } from '../lib/api';
import { Button } from '../components/ui';

const setTheme = (m: 'light' | 'dark') => {
  document.documentElement.dataset.theme = m;
  localStorage.setItem('he.admin.theme', m);
};

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { name: string; role: string };
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@hillexpress.in');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<LoginResponse>('/auth/admin/login', {
        method: 'POST',
        body: { email, password },
        anonymous: true,
      });
      tokens.set(res.accessToken, res.refreshToken);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-l border border-line bg-surface p-8 dark:border-line-dark dark:bg-surface-dark"
      >
        <div className="flex flex-col gap-2">
          <div className="flex size-12 items-center justify-center rounded-m bg-spruce text-2xl">
            🏔️
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Hill Express Admin</h1>
          <p className="text-sm text-ink2 dark:text-ink2-dark">
            Dispatch, inventory and reports
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="min-h-11 rounded-m border border-line2 bg-surface px-3 text-[15px] outline-none focus:border-moss dark:border-line2-dark dark:bg-surface2-dark"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="min-h-11 rounded-m border border-line2 bg-surface px-3 text-[15px] outline-none focus:border-moss dark:border-line2-dark dark:bg-surface2-dark"
          />
        </label>

        {error ? (
          <p className="text-sm text-critical dark:text-critical-dark">{error}</p>
        ) : null}

        <Button type="submit" disabled={busy || !password} className="min-h-11">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        {/* Available before sign-in too — you shouldn't have to log in to
            escape a theme that hurts to look at. */}
        <div
          role="group"
          aria-label="Appearance"
          className="flex gap-1 self-center rounded-full bg-surface2 p-1 dark:bg-surface2-dark"
        >
          {(['light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTheme(m)}
              className="rounded-full px-3 py-1 text-xs font-semibold capitalize text-ink2 dark:text-ink2-dark"
            >
              {m === 'light' ? '☀️' : '🌙'} {m}
            </button>
          ))}
        </div>
      </form>
    </main>
  );
}
