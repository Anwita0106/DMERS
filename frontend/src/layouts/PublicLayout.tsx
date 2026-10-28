import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Menu, Moon, Phone, Sun, X, FileText } from 'lucide-react';
import { ApiStatusBanner, Logo, cx } from '../components/ui';
import GlobalSearch from '../components/GlobalSearch';
import { useApi, useAuth, useTheme } from '../contexts/AppContext';
import { HELPLINES } from '../lib/guides';
import { isStaff } from '../lib/format';

const LINKS = [
  { to: '/', label: 'Home', end: true }, { to: '/alerts', label: 'Live Alerts' }, { to: '/shelters', label: 'Shelters' },
  { to: '/report', label: 'Report' }, { to: '/about', label: 'About' }, { to: '/contact', label: 'Contact' },
];

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="relative flex h-8 w-14 items-center rounded-full border border-line bg-raised px-1">
      <span className={cx('absolute grid h-6 w-6 place-items-center rounded-full bg-surface shadow transition-all', theme === 'dark' ? 'left-7' : 'left-1')}>
        {theme === 'dark' ? <Moon className="h-3.5 w-3.5 text-brand" /> : <Sun className="h-3.5 w-3.5 text-sev-moderate" />}
      </span>
    </button>
  );
}

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const health = useApi<{ status: string; service?: string }>('/health', [], 15000);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const staff = isStaff(user?.account_type);
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cx('relative py-1 text-sm font-medium transition hover:text-brand', isActive ? 'text-brand after:absolute after:-bottom-[19px] after:left-0 after:h-0.5 after:w-full after:bg-brand' : 'text-muted');

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <header className="sticky top-0 z-[1000] border-b border-line bg-bg/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="DMERS home"><Logo /></Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{l.label}</NavLink>)}
          </nav>
          <div className="ml-auto hidden w-56 md:block"><GlobalSearch compact placeholder="Search zones, shelters..." /></div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ThemeToggle />
            {user ? (
              <>
                {!staff && <Link to="/my-reports" className="btn-outline btn-sm hidden sm:inline-flex"><FileText className="h-3.5 w-3.5" />My reports</Link>}
                <button onClick={() => { logout(); nav('/'); }} className="btn-ghost btn-sm hidden sm:inline-flex" title={`Signed in as ${user.full_name}`}>
                  <LogOut className="h-3.5 w-3.5" />Sign out
                </button>
              </>
            ) : <Link to="/login" className="btn-outline btn-sm hidden border-brand/60 text-brand sm:inline-flex">Login</Link>}
            {(!user || staff) && (
              <Link to={staff ? '/command' : '/login?next=/command'} className="btn-primary btn-sm hidden sm:inline-flex">Command Center<ArrowRight className="h-3.5 w-3.5" /></Link>
            )}
            <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {open && (
          <div className="border-t border-line bg-surface px-4 py-3 lg:hidden" onClick={() => setOpen(false)}>
            <div className="mb-3 md:hidden" onClick={(e) => e.stopPropagation()}><GlobalSearch compact placeholder="Search zones, shelters..." /></div>
            <div className="grid gap-1">
              {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-brand/10 text-brand' : 'hover:bg-raised')}>{l.label}</NavLink>)}
              {user && !staff && <NavLink to="/my-reports" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-raised">My reports</NavLink>}
              <div className="mt-2 flex gap-2">
                {user ? <button className="btn-outline btn-sm flex-1" onClick={() => { logout(); nav('/'); }}>Sign out</button>
                  : <Link to="/login" className="btn-outline btn-sm flex-1">Login</Link>}
                {(!user || staff) && <Link to={staff ? '/command' : '/login?next=/command'} className="btn-primary btn-sm flex-1">Command Center</Link>}
              </div>
            </div>
          </div>
        )}
      </header>

      <ApiStatusBanner error={health.error || health.refreshError || (health.data && health.data.service !== 'dmers-api' ? new Error('not-dmers') : null)} onRetry={health.reload} />
      <main className="flex-1"><Outlet /></main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted">Disaster Management & Emergency Response System. Prepared communities. Safer tomorrows.</p>
          </div>
          <div>
            <div className="eyebrow mb-3 flex items-center gap-2"><Phone className="h-3.5 w-3.5" />Emergency helplines (India)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {HELPLINES.map((h) => (
                <a key={h.label} href={`tel:${h.number.split(' ')[0]}`} className="rounded-xl border border-line px-3 py-2 hover:border-brand">
                  <div className="font-display text-lg font-bold text-brand">{h.number}</div>
                  <div className="text-[11px] text-muted">{h.label}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-line py-4 text-center text-xs text-faint">DMERS · {new Date().getFullYear()}</div>
      </footer>
    </div>
  );
}
