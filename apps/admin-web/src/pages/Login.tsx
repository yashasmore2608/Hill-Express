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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* Two soft brand blooms behind the card, so the page is a scene rather
          than a form floating on flat white. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: 'var(--brand-grad)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-40 size-[560px] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--series-2), transparent 70%)' }}
      />

      <form
        onSubmit={submit}
        className="rise relative flex w-full max-w-sm flex-col gap-5 rounded-[22px] border border-[color:var(--hairline)] bg-surface p-8 shadow-e3 dark:bg-surface-dark"
      >
        <div className="flex flex-col gap-2">
          <div
            className="flex size-14 items-center justify-center rounded-[17px] text-2xl shadow-e2"
            style={{ background: 'var(--brand-grad)' }}
          >
            🏔️
          </div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">
            Hill Express <span className="brand-text">Admin</span>
          </h1>
          <p className="text-sm text-ink3 dark:text-ink3-dark">
            Dispatch, inventory and reports
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink2 dark:text-ink2-dark">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="min-h-11 rounded-[12px] border border-[color:var(--hairline)] bg-surface px-3 text-[15px] outline-none transition focus:border-moss dark:bg-surface2-dark"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink2 dark:text-ink2-dark">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="min-h-11 rounded-[12px] border border-[color:var(--hairline)] bg-surface px-3 text-[15px] outline-none transition focus:border-moss dark:bg-surface2-dark"
          />
        </label>

        {error ? (
          <p className="rounded-[12px] bg-critical-soft px-3 py-2 text-sm font-semibold text-critical dark:bg-critical-soft-dark dark:text-critical-dark">{error}</p>
        ) : null}

        <Button type="submit" disabled={busy || !password} className="min-h-11">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        {/* Available before sign-in too — you shouldn't have to log in to
            escape a theme that hurts to look at. */}
        <div
          role="group"
          aria-label="Appearance"
          className="flex gap-1 self-center rounded-full border border-[color:var(--hairline)] bg-surface2 p-1 dark:bg-surface2-dark"
        >
          {(['light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTheme(m)}
              className="rounded-full px-3 py-1.5 text-xs font-bold capitalize text-ink2 transition hover:bg-surface dark:text-ink2-dark dark:hover:bg-surface-dark"
            >
              {m === 'light' ? '☀️' : '🌙'} {m}
            </button>
          ))}
        </div>
      </form>
    </main>
  );
}
