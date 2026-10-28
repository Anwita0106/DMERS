import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { titleCase } from '../lib/format';

export const cx = clsx;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <path d="M16 3 30 28H2Z" fill="rgb(var(--brand))" />
        <path d="M16 12 23 25H9Z" fill="rgb(var(--bg))" />
      </svg>
      {!compact && <span className="font-display text-xl font-extrabold tracking-wide">DMERS</span>}
    </span>
  );
}

/* ---------------------------------------------------------------- badges */
const SEV: Record<string, string> = {
  CRITICAL: 'bg-sev-critical/15 text-sev-critical ring-sev-critical/30',
  HIGH: 'bg-sev-high/15 text-sev-high ring-sev-high/30',
  MODERATE: 'bg-sev-moderate/15 text-sev-moderate ring-sev-moderate/30',
  MEDIUM: 'bg-sev-moderate/15 text-sev-moderate ring-sev-moderate/30',
  LOW: 'bg-sev-low/15 text-sev-low ring-sev-low/30',
};
export const SEV_HEX: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#eab308', MEDIUM: '#eab308', LOW: '#22c55e' };

export function SeverityBadge({ value }: { value: string }) {
  return <span className={cx('chip ring-1', SEV[value] ?? SEV.LOW)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{titleCase(value)}</span>;
}
export const RiskBadge = SeverityBadge;

const STATUS: Record<string, string> = {
  REPORTED: 'bg-info/15 text-info', VERIFIED: 'bg-sev-moderate/15 text-sev-moderate',
  RESPONDING: 'bg-sev-high/15 text-sev-high', RESOLVED: 'bg-brand/15 text-brand',
  CLOSED: 'bg-faint/20 text-muted', REJECTED: 'bg-sev-critical/10 text-sev-critical',
  ASSIGNED: 'bg-info/15 text-info', EN_ROUTE: 'bg-sev-moderate/15 text-sev-moderate', ON_SCENE: 'bg-sev-high/15 text-sev-high',
  COMPLETED: 'bg-brand/15 text-brand', CANCELLED: 'bg-faint/20 text-muted',
  AVAILABLE: 'bg-brand/15 text-brand', DEPLOYED: 'bg-sev-high/15 text-sev-high', OFF_DUTY: 'bg-faint/20 text-muted',
  ADEQUATE: 'bg-brand/15 text-brand', LOW_STOCK: 'bg-sev-moderate/15 text-sev-moderate', OUT_OF_STOCK: 'bg-sev-critical/15 text-sev-critical',
  OPEN: 'bg-brand/15 text-brand', FULL: 'bg-sev-high/15 text-sev-high',
};
export function StatusBadge({ value, kind }: { value: string; kind?: 'stock' }) {
  const key = kind === 'stock' && value === 'LOW' ? 'LOW_STOCK' : value;
  return <span className={cx('chip', STATUS[key] ?? 'bg-raised text-muted')}>{titleCase(value)}</span>;
}

/* ---------------------------------------------------------------- layout bits */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, tone = 'brand', foot }: {
  icon: ReactNode; label: string; value: ReactNode; tone?: 'brand' | 'critical' | 'high' | 'moderate' | 'info'; foot?: ReactNode;
}) {
  const tones = {
    brand: 'bg-brand/15 text-brand ring-brand/30', critical: 'bg-sev-critical/15 text-sev-critical ring-sev-critical/30',
    high: 'bg-sev-high/15 text-sev-high ring-sev-high/30', moderate: 'bg-sev-moderate/15 text-sev-moderate ring-sev-moderate/30',
    info: 'bg-info/15 text-info ring-info/30',
  };
  const edge = { brand: 'before:bg-brand', critical: 'before:bg-sev-critical', high: 'before:bg-sev-high', moderate: 'before:bg-sev-moderate', info: 'before:bg-info' };
  return (
    <div className={cx('card relative overflow-hidden p-4 sm:p-5 before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:opacity-70', edge[tone])}>
      <div className="flex items-center gap-4">
        <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1', tones[tone])}>{icon}</div>
        <div className="min-w-0">
          <div className="font-display text-2xl font-bold leading-none sm:text-[28px]">{value}</div>
          <div className="mt-1.5 truncate text-xs font-medium text-muted">{label}</div>
        </div>
      </div>
      {foot && <div className="mt-3 border-t border-line pt-2.5 text-[11px] text-muted">{foot}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />{label}...</div>;
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-raised text-faint">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <div className="font-semibold">{title}</div>
      {hint && <div className="max-w-sm text-sm text-muted">{hint}</div>}
    </div>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sev-critical/40 bg-sev-critical/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sev-critical" />
      <div className="flex-1">{text}</div>
      {onRetry && <button className="font-semibold text-sev-critical hover:underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const list: (number | '...')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list[list.length - 1] !== '...') list.push('...');
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted">
      <span>Showing {total ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, total)} of {total}</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        {list.map((p, i) => p === '...' ? <span key={`e${i}`} className="px-1">...</span> : (
          <button key={p} onClick={() => onPage(p)} className={cx('h-7 min-w-7 rounded-lg px-2 text-xs font-semibold', p === page ? 'bg-brand text-brand-ink' : 'hover:bg-raised')}>{p}</button>
        ))}
        <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- overlays */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = prev; };
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cx('card flex max-h-[92vh] w-full animate-fadeUp flex-col rounded-b-none sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-[1100] flex justify-end bg-black/50 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside onMouseDown={(e) => e.stopPropagation()} className="flex h-full w-full max-w-2xl animate-fadeUp flex-col border-l border-line bg-bg">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0 flex-1">{title}</div>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', value === o.value ? 'bg-brand text-brand-ink' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "Live" indicator: pulsing dot + seconds since the last refresh. */
export function LiveBadge({ at }: { at: Date | null }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const secs = at ? Math.max(0, Math.round((Date.now() - at.getTime()) / 1000)) : null;
  return (
    <span className="chip border border-brand/40 bg-brand/10 text-brand" title="Data refreshes automatically from the database">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand" /></span>
      LIVE{secs !== null && <span className="font-normal text-muted">· {secs < 2 ? 'just now' : `${secs}s ago`}</span>}
    </span>
  );
}

/** Red banner shown when the API (and so PostgreSQL) cannot be reached, with the real reason. */
export function ApiStatusBanner({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (!error) return null;
  const e = error as { response?: { status?: number; data?: { detail?: string } }; message?: string };
  const status = e.response?.status;
  const detail = e.response?.data?.detail;
  let reason: string;
  if (e.message === 'not-dmers') {
    reason = 'Another program is answering on the DMERS API port, not the DMERS backend. Run windows\\STOP_DMERS.bat, then windows\\2_START.bat.';
  } else if (!e.response) {
    reason = 'No answer from the server. Start DMERS with windows\\2_START.bat and keep the "DMERS API" window open.';
  } else if (status === 404) {
    reason = '404 Not Found: the website reached a server on the API port, but it is not the DMERS backend (or an old copy). Run windows\\STOP_DMERS.bat, then windows\\2_START.bat.';
  } else if (status === 502 || status === 503 || status === 504 || (status === 500 && !detail)) {
    reason = `The DMERS backend is not running on port 8765 (${status}). Check the "DMERS API" window for the error, or run windows\\DIAGNOSE.bat.`;
  } else if (status === 500) {
    reason = `The backend hit an error: ${detail}. Check the "DMERS API" window.`;
  } else {
    reason = `The API answered ${status}${detail ? `: ${detail}` : ''}. If this mentions the database, check PostgreSQL and backend\\.env (run windows\\DIAGNOSE.bat).`;
  }
  return (
    <div className="border-b border-sev-critical/40 bg-sev-critical/10 px-4 py-2.5 text-sm">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sev-critical" />
        <div className="flex-1"><b className="text-sev-critical">Live data unavailable.</b> {reason}</div>
        <button className="font-semibold text-sev-critical hover:underline" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}
