import axios, { AxiosError } from 'axios';

// Same-origin '/api' by default (Vite proxy in development, nginx in Docker).
// Set VITE_API_BASE_URL only when the API is on another host.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'dmers_token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};

const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event('dmers:signed-out'));
    }
    return Promise.reject(err);
  },
);

/** Human message from an API error (FastAPI `detail`, a list of validation errors, or a network error). */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as AxiosError<{ detail?: unknown }>;
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d: { loc?: unknown[]; msg?: string }) => {
      const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
      return `${field ? String(field).replace(/_/g, ' ') + ': ' : ''}${d.msg ?? ''}`;
    }).join('; ');
  }
  if (e?.code === 'ECONNABORTED') return 'The server took too long to answer';
  if (e?.request && !e?.response) return 'Cannot reach the DMERS server';
  return fallback;
}

export default api;
