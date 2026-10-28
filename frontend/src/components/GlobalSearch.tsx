import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Home, AlertTriangle, Truck, Package } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AppContext';
import { isStaff, titleCase } from '../lib/format';

type Results = {
  zones: { id: number; zone_name: string; district: string; risk_level: string }[];
  shelters: { id: number; shelter_name: string; status: string }[];
  incidents?: { id: number; title: string; status: string; severity: string }[];
  units?: { id: number; unit_name: string; unit_type: string; availability_status: string }[];
  resources?: { id: number; resource_name: string; category: string; stock_status: string }[];
};

export default function GlobalSearch({ compact = false, placeholder = 'Search anything...' }: { compact?: boolean; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { user } = useAuth();
  const box = useRef<HTMLDivElement>(null);
  const staff = isStaff(user?.account_type);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => api.get<Results>('/search', { params: { q } }).then((r) => setRes(r.data)).catch(() => setRes(null)), 220);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);

  const go = (path: string) => { setOpen(false); setQ(''); nav(path); };
  const groups: { label: string; icon: JSX.Element; items: { key: string; text: string; sub: string; path: string }[] }[] = res ? [
    { label: 'Incidents', icon: <AlertTriangle className="h-3.5 w-3.5" />, items: (res.incidents ?? []).map((i) => ({ key: `i${i.id}`, text: `#${i.id} ${i.title}`, sub: `${titleCase(i.status)} · ${titleCase(i.severity)}`, path: `/command/incidents?open=${i.id}` })) },
    { label: 'Response units', icon: <Truck className="h-3.5 w-3.5" />, items: (res.units ?? []).map((u) => ({ key: `u${u.id}`, text: u.unit_name, sub: `${titleCase(u.unit_type)} · ${titleCase(u.availability_status)}`, path: `/command/units?q=${encodeURIComponent(u.unit_name)}` })) },
    { label: 'Resources', icon: <Package className="h-3.5 w-3.5" />, items: (res.resources ?? []).map((r) => ({ key: `r${r.id}`, text: r.resource_name, sub: `${titleCase(r.category)} · ${titleCase(r.stock_status)}`, path: `/command/resources?q=${encodeURIComponent(r.resource_name)}` })) },
    { label: 'Zones', icon: <MapPin className="h-3.5 w-3.5" />, items: res.zones.map((z) => ({ key: `z${z.id}`, text: z.zone_name, sub: `${z.district} · ${titleCase(z.risk_level)} risk`, path: staff ? `/command/zones?zone=${z.id}` : `/shelters?zone=${z.id}` })) },
    { label: 'Shelters', icon: <Home className="h-3.5 w-3.5" />, items: res.shelters.map((s) => ({ key: `s${s.id}`, text: s.shelter_name, sub: titleCase(s.status), path: `/shelters?shelter=${s.id}` })) },
  ].filter((g) => g.items.length) : [];

  return (
    <div ref={box} className={`relative ${compact ? 'w-full' : 'w-full max-w-sm'}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder={placeholder} aria-label="Search" className="input h-10 rounded-full pl-9 text-[13px]" />
      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 top-12 z-[1300] max-h-[70vh] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-card">
          {!res ? <div className="p-3 text-sm text-muted">Searching...</div> : groups.length === 0 ? (
            <div className="p-3 text-sm text-muted">No matches for "{q}"</div>
          ) : groups.map((g) => (
            <div key={g.label} className="py-1">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-faint">{g.icon}{g.label}</div>
              {g.items.map((it) => (
                <button key={it.key} onClick={() => go(it.path)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-raised">
                  <div className="truncate text-sm font-medium">{it.text}</div>
                  <div className="text-[11px] text-muted">{it.sub}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
