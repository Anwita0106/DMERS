import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, Bell, Boxes, LayoutDashboard, LogOut, Map, Menu, PackageCheck, Send, Settings,
  ShieldAlert, Truck, Users, Globe,
} from 'lucide-react';
import { ApiStatusBanner, Logo, Spinner, cx, StatusBadge } from '../components/ui';
import GlobalSearch from '../components/GlobalSearch';
import { ThemeToggle } from './PublicLayout';
import { LIVE_MS, useApi, useAuth } from '../contexts/AppContext';
import { ROLE_LABEL, isStaff, timeAgo } from '../lib/format';
import type { Role } from '../lib/types';

const NAV: { to: string; label: string; icon: typeof Activity; roles?: Role[] }[] = [
  { to: '/command', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/command/incidents', label: 'Incidents', icon: ShieldAlert },
  { to: '/command/resources', label: 'Resources', icon: Boxes },
  { to: '/command/units', label: 'Response Units', icon: Truck },
  { to: '/command/zones', label: 'Zones & Shelters', icon: Map },
  { to: '/command/dispatches', label: 'Dispatches', icon: Send },
  { to: '/command/allocations', label: 'Allocations', icon: PackageCheck },
  { to: '/command/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/command/users', label: 'Users & Roles', icon: Users, roles: ['ADMINISTRATOR'] },
];

type ActivityItem = { incident_id: number; title: string; update_no: number; new_status: string; note: string | null; logged_at: string; logged_by_name: string | null };

function Bellmenu() {
  const [open, setOpen] = useState(false);
  const { data } = useApi<{ activity: ActivityItem[] }>(open ? '/dashboard/stats' : null, [], LIVE_MS);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative grid h-10 w-10 place-items-center rounded-full border border-line hover:border-brand" aria-label="Recent activity">
        <Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-[1300] w-[min(92vw,360px)] rounded-2xl border border-line bg-surface p-2 shadow-card">
          <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-faint">Recent timeline activity</div>
          {!data ? <Spinner /> : data.activity.map((a) => (
            <button key={`${a.incident_id}-${a.update_no}`} onClick={() => { setOpen(false); nav(`/command/incidents?open=${a.incident_id}`); }}
              className="block w-full rounded-lg px-2 py-2 text-left hover:bg-raised">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">#{a.incident_id} {a.title}</span>
                <StatusBadge value={a.new_status} />
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted">{a.note ?? ''} · {a.logged_by_name ?? 'System'} · {timeAgo(a.logged_at)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommandLayout() {
  const { user, ready, logout } = useAuth();
  const health = useApi<{ status: string; service?: string }>('/health', [], 15000);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setMobile(false), [loc.pathname]);

  if (!ready) return <div className="grid min-h-screen place-items-center"><Spinner label="Checking sign-in" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!isStaff(user.account_type)) return <Navigate to="/my-reports?denied=1" replace />;

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.account_type));
  const side = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5"><Link to="/command"><Logo compact={collapsed} /></Link></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/command'} title={label}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-brand text-brand-ink shadow-glow' : 'text-muted hover:bg-raised hover:text-ink')}>
            <Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-line px-3 py-3">
        <NavLink to="/command/settings" className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-brand text-brand-ink' : 'text-muted hover:bg-raised hover:text-ink')}>
          <Settings className="h-[18px] w-[18px]" />{!collapsed && 'Settings'}
        </NavLink>
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-raised hover:text-ink">
          <Globe className="h-[18px] w-[18px]" />{!collapsed && 'Public site'}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className={cx('sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-all lg:block', collapsed ? 'w-[76px]' : 'w-64')}>{side}</aside>
      {mobile && (
        <div className="fixed inset-0 z-[1100] bg-black/50 lg:hidden" onClick={() => setMobile(false)}>
          <aside className="h-full w-64 border-r border-line bg-surface" onClick={(e) => e.stopPropagation()}>{side}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[900] flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-lg sm:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <button className="btn-ghost btn-sm hidden lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse menu"><Menu className="h-5 w-5" /></button>
          <div className="ml-auto hidden w-72 sm:block"><GlobalSearch compact /></div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <ThemeToggle />
            <Bellmenu />
            <div className="ml-1 hidden items-center gap-2.5 border-l border-line pl-3 sm:flex">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand/15 font-display text-sm font-bold text-brand">
                {user.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </div>
              <div className="leading-tight">
                <div className="max-w-[140px] truncate text-sm font-semibold">{user.full_name}</div>
                <div className="text-[11px] text-muted">{ROLE_LABEL[user.account_type]}</div>
              </div>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => { logout(); nav('/login'); }} aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <ApiStatusBanner error={health.error || health.refreshError || (health.data && health.data.service !== 'dmers-api' ? new Error('not-dmers') : null)} onRetry={health.reload} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
