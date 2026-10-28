import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import api, { tokenStore } from '../lib/api';
import type { User } from '../lib/types';

/* ---------------------------------------------------------------- theme */
type Theme = 'light' | 'dark';
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('dmers_theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ---------------------------------------------------------------- toasts */
type Toast = { id: number; kind: 'ok' | 'error'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 6500 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[2000] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex animate-fadeUp items-start gap-3 rounded-xl border bg-surface p-3.5 text-sm shadow-card ${t.kind === 'ok' ? 'border-brand/40' : 'border-sev-critical/50'}`}>
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sev-critical" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))} className="text-faint hover:text-ink" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------------------------------------------------------- auth */
interface AuthState {
  user: User | null; ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (full_name: string, email: string, password: string) => Promise<User>;
  logout: () => void; refresh: () => Promise<void>;
}
const AuthCtx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); setReady(true); return; }
    try { setUser((await api.get<User>('/auth/me')).data); } catch { setUser(null); } finally { setReady(true); }
  }, []);

  useEffect(() => {
    refresh();
    const out = () => setUser(null);
    window.addEventListener('dmers:signed-out', out);
    return () => window.removeEventListener('dmers:signed-out', out);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password });
    const { data } = await api.post('/auth/login', form);
    tokenStore.set(data.access_token); setUser(data.user); return data.user as User;
  }, []);
  const register = useCallback(async (full_name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { full_name, email, password });
    tokenStore.set(data.access_token); setUser(data.user); return data.user as User;
  }, []);
  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout, refresh }), [user, ready, login, register, logout, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ---------------------------------------------------------------- data hook */
/** Live-refresh interval used across the app (new rows in the database appear on screen within this time). */
export const LIVE_MS = 5000;

/**
 * GET `url` and keep the result. With `liveMs`, the data is re-fetched in the background every
 * `liveMs` milliseconds while the tab is visible, so rows inserted from anywhere (the app, pgAdmin,
 * psql) show up without a page reload. Background refreshes never show a loading spinner.
 */
export function useApi<T>(url: string | null, deps: unknown[] = [], liveMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!!url);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const silent = useRef(false);
  useEffect(() => {
    if (!url) { setLoading(false); return; }
    let alive = true;
    if (!silent.current) setLoading(true);
    api.get<T>(url).then((r) => { if (alive) { setData(r.data); setError(null); setRefreshError(null); setUpdatedAt(new Date()); } })
      .catch((e) => { if (!alive) return; if (silent.current) setRefreshError(e); else setError(e); })
      .finally(() => { if (alive) { setLoading(false); silent.current = false; } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps]);
  useEffect(() => {
    if (!url || !liveMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') { silent.current = true; setTick((x) => x + 1); }
    }, liveMs);
    return () => clearInterval(t);
  }, [url, liveMs]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData, updatedAt, refreshError };
}
