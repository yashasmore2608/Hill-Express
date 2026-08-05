import { useEffect, useState } from 'react';

import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api, tokens } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Dispatch from './pages/Dispatch';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Banners from './pages/Banners';
import Reports from './pages/Reports';

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const NAV = [
  { to: '/', label: 'Overview', icon: '📊', end: true },
  { to: '/dispatch', label: 'Dispatch', icon: '🛵' },
  { to: '/orders', label: 'Orders', icon: '🧾' },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/banners', label: 'Banners', icon: '🎏' },
  { to: '/reports', label: 'Reports', icon: '📄' },
];

/** Light/dark segmented switch — same control as the three mobile apps. */
function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('he.admin.theme') as 'light' | 'dark') ?? 'light',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem('he.admin.theme', mode);
  }, [mode]);

  return (
    <div
      role="group"
      aria-label="Appearance"
      className="flex gap-1 rounded-full border border-[color:var(--hairline)] bg-surface2 p-1 dark:bg-surface2-dark"
    >
      {(['light', 'dark'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-bold capitalize transition duration-150 ${
            mode === m
              ? 'bg-surface text-ink shadow-e1 dark:bg-surface-dark dark:text-ink-dark'
              : 'text-ink3 dark:text-ink3-dark'
          }`}
        >
          <span aria-hidden>{m === 'light' ? '☀️' : '🌙'}</span>
          {m}
        </button>
      ))}
    </div>
  );
}

/** Brand lockup — gradient tile + gradient wordmark. Used in the rail only. */
function Brand() {
  return (
    <div className="mb-6 flex items-center gap-3 px-1">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[13px] text-lg shadow-e2"
        style={{ background: 'var(--brand-grad)' }}
      >
        🏔️
      </span>
      <div className="leading-tight">
        <div className="brand-text text-[15px] font-extrabold tracking-tight">Hill Express</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink3 dark:text-ink3-dark">
          Admin
        </div>
      </div>
    </div>
  );
}

/** Badge count so unassigned orders are visible from any page. */
function DispatchBadge() {
  const { data } = useQuery({
    queryKey: ['dispatch-badge'],
    queryFn: () => api<Array<{ assignmentStatus: string }>>('/admin/dispatch'),
    refetchInterval: 20_000,
  });
  const n = (data ?? []).filter((o) => o.assignmentStatus === 'UNASSIGNED').length;
  if (n === 0) return null;
  return (
    <span
      title={`${n} order${n === 1 ? '' : 's'} waiting for a driver`}
      className="ml-auto min-w-[22px] rounded-full bg-ember px-1.5 py-0.5 text-center text-[11px] font-extrabold text-white shadow-e1 dark:bg-ember-dark dark:text-[#1A0C04]"
    >
      {n}
    </span>
  );
}

function Shell() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop rail, horizontal scroll strip on narrow screens.
          Sticky and full-height so long tables scroll under a fixed nav. */}
      <aside className="glass sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1 border-r border-[color:var(--hairline)] p-4 md:flex">
        <Brand />

        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-bold transition duration-150 ${
                isActive
                  ? 'bg-moss-soft text-ok shadow-e1 dark:bg-moss-soft-dark dark:text-ok-dark'
                  : 'text-ink2 hover:translate-x-0.5 hover:bg-surface2 dark:text-ink2-dark dark:hover:bg-surface2-dark'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active marker is a shape, not just a tint — readable even
                    if the background colour is hard to distinguish. */}
                <span
                  aria-hidden
                  className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ background: 'var(--series-1)' }}
                />
                <span aria-hidden className="text-base">
                  {n.icon}
                </span>
                {n.label}
                {n.to === '/dispatch' ? <DispatchBadge /> : null}
              </>
            )}
          </NavLink>
        ))}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <ThemeToggle />
          <button
            onClick={() => {
              tokens.clear();
              navigate('/login', { replace: true });
            }}
            className="rounded-[12px] px-3 py-2 text-left text-sm font-semibold text-ink3 transition hover:bg-surface2 dark:text-ink3-dark dark:hover:bg-surface2-dark"
          >
            ↩ Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav — sticky so it survives a long scroll */}
        <nav className="glass sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-[color:var(--hairline)] p-2 md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition ${
                  isActive
                    ? 'bg-moss-soft text-ok shadow-e1 dark:bg-moss-soft-dark dark:text-ok-dark'
                    : 'text-ink2 dark:text-ink2-dark'
                }`
              }
            >
              {n.icon} {n.label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-5 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/banners" element={<Banners />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Guarded() {
  if (!tokens.access) return <Navigate to="/login" replace />;
  return <Shell />;
}

// Stamp the saved theme at module load — before React paints, so neither the
// login page nor the shell flashes the wrong theme. Defaults to light.
document.documentElement.dataset.theme =
  localStorage.getItem('he.admin.theme') === 'dark' ? 'dark' : 'light';

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Guarded />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
