import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Clock, Navigation, Phone, RotateCcw, Search, Tent, Trees, Users } from 'lucide-react';
import { useApi, LIVE_MS } from '../../contexts/AppContext';
import MapView, { type MapPoint } from '../../components/MapView';
import { ErrorBox, StatusBadge, cx } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { num, titleCase } from '../../lib/format';
import type { Shelter, Zone } from '../../lib/types';

const TYPE_ICON = { SHELTER: Building2, SAFE_ZONE: Trees, RELIEF_CAMP: Tent };
const STATUS_COLOR = { OPEN: '#22c55e', FULL: '#f97316', CLOSED: '#6b7280' };

export default function Shelters() {
  const [params] = useSearchParams();
  const { data: shelters, loading, error, reload } = useApi<Shelter[]>('/shelters', [], LIVE_MS);
  const { data: zones } = useApi<Zone[]>('/zones');
  const [q, setQ] = useState('');
  const [zone, setZone] = useState(params.get('zone') ?? '');
  const [type, setType] = useState('');
  const [avail, setAvail] = useState('');
  const [focus, setFocus] = useState<number | null>(params.get('shelter') ? Number(params.get('shelter')) : null);

  const list = useMemo(() => (shelters ?? []).filter((s) =>
    (!zone || String(s.zone_id) === zone) && (!type || s.shelter_type === type)
    && (!avail || (avail === 'available' ? s.status === 'OPEN' && s.available > 0 : s.status === avail))
    && (!q || `${s.shelter_name} ${s.address} ${s.zone_name} ${s.district}`.toLowerCase().includes(q.toLowerCase()))), [shelters, zone, type, avail, q]);

  const focused = list.find((s) => s.id === focus);
  useEffect(() => { if (focus) document.getElementById(`shelter-${focus}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [focus]);

  const points: MapPoint[] = [
    ...list.map((s) => ({
      key: `s${s.id}`, lat: s.latitude, lng: s.longitude, color: s.shelter_type === 'SAFE_ZONE' ? '#eab308' : STATUS_COLOR[s.status], shape: 'home' as const,
      onClick: () => setFocus(s.id),
      popup: (<div className="min-w-[180px]"><b>{s.shelter_name}</b><br />{s.zone_name} · {titleCase(s.facility_type)}<br />
        Capacity {num(s.capacity)} · Available {num(s.available)}<br />{s.open_24x7 ? 'Open 24/7' : 'Day-time only'}</div>),
    })),
    ...(zones ?? []).filter((z) => z.latitude && (!zone || String(z.id) === zone)).map((z) => ({
      key: `z${z.id}`, lat: z.latitude!, lng: z.longitude!, radiusKm: z.radius_km ?? 2, color: z.risk_level === 'HIGH' ? '#ef4444' : z.risk_level === 'MEDIUM' ? '#eab308' : '#22c55e',
      shape: 'square' as const, popup: <div><b>{z.zone_name}</b><br />{titleCase(z.risk_level)} risk · {z.active_incidents} active incident(s)</div>,
    })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Shelters & Safe Zones</h1>
          <p className="mt-2 text-muted">Find nearby shelters and safe zones during emergencies. Capacity is updated live from the database.</p>
        </div>
        {shelters && (
          <div className="flex flex-wrap gap-2">
            {[
              ['Open now', shelters.filter((x) => x.status === 'OPEN').length, 'text-brand'],
              ['Places free', num(shelters.filter((x) => x.status === 'OPEN').reduce((a, x) => a + x.available, 0)), 'text-brand'],
              ['Full', shelters.filter((x) => x.status === 'FULL').length, 'text-sev-high'],
            ].map(([l, v, c]) => (
              <div key={String(l)} className="card px-4 py-2 text-center"><div className={`font-display text-xl font-bold ${c}`}>{v}</div><div className="text-[11px] text-muted">{l}</div></div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input className="input pl-9" placeholder="Search by location or zone..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
          <option value="">All zones</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.zone_name}</option>)}
        </select>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option><option value="SHELTER">Shelters</option><option value="SAFE_ZONE">Safe zones</option><option value="RELIEF_CAMP">Relief camps</option>
        </select>
        <select className="input w-auto" value={avail} onChange={(e) => setAvail(e.target.value)} aria-label="Availability">
          <option value="">Any availability</option><option value="available">Has free places</option><option value="FULL">Full</option><option value="CLOSED">Closed</option>
        </select>
        {(q || zone || type || avail) && (
          <button className="btn-ghost text-brand" onClick={() => { setQ(''); setZone(''); setType(''); setAvail(''); setFocus(null); }}><RotateCcw className="h-4 w-4" />Reset filters</button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <MapView points={points} height="min(560px, 70vh)" emptyText="No shelters with map coordinates for these filters" flyTo={focused ? [focused.latitude, focused.longitude] : null} fitKey={`${zone}-${type}-${avail}-${q}-${list.length}`} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#22c55e]" />Shelter open</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#f97316]" />Full</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#eab308]" />Safe zone</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-[#ef4444]" />High-risk zone area</span>
          </div>
        </div>
        <div className="space-y-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          {shelters && <div className="text-xs text-muted">Showing {list.length} of {shelters.length} shelters and safe zones</div>}
          {loading && !shelters && Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[120px] animate-pulse bg-raised" />)}
          {error && !shelters ? <ErrorBox text={`Could not load shelters from the server: ${errorMessage(error)}`} onRetry={reload} /> : null}
          {shelters && shelters.length === 0 && (
            <div className="card p-6 text-center text-sm text-muted">No shelters are recorded in the database yet. Staff can add them in Command Center → Zones & Shelters.</div>
          )}
          {shelters && shelters.length > 0 && list.length === 0 && (
            <div className="card flex flex-col items-center gap-3 p-6 text-center text-sm text-muted">No shelters match these filters.
              <button className="btn-outline btn-sm" onClick={() => { setQ(''); setZone(''); setType(''); setAvail(''); }}><RotateCcw className="h-3.5 w-3.5" />Reset filters</button>
            </div>
          )}
          {list.map((s) => {
            const Icon = TYPE_ICON[s.shelter_type];
            const pct = Math.round((s.current_occupancy / s.capacity) * 100);
            return (
              <article id={`shelter-${s.id}`} key={s.id} onClick={() => setFocus(s.id)}
                className={cx('card cursor-pointer p-4 transition hover:border-brand', focus === s.id && 'border-brand shadow-glow')}>
                <div className="flex gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold leading-tight">{s.shelter_name}</h3>
                        <div className="mt-0.5 text-xs text-muted">{s.zone_name} · {titleCase(s.facility_type)} · {titleCase(s.shelter_type)}</div>
                      </div>
                      <StatusBadge value={s.status} />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between text-[11px] text-muted"><span>{num(s.current_occupancy)} / {num(s.capacity)} occupied</span><span className="font-semibold text-ink">{num(s.available)} available</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#f97316' : '#22c55e' }} /></div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.open_24x7 ? 'Open 24/7' : 'Day-time'}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.address}</span>
                      {s.contact_phone && <a onClick={(e) => e.stopPropagation()} href={`tel:${s.contact_phone}`} className="flex items-center gap-1 hover:text-brand"><Phone className="h-3.5 w-3.5" />{s.contact_phone}</a>}
                      <a onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 font-semibold text-brand hover:underline"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`}><Navigation className="h-3.5 w-3.5" />Get directions</a>
                    </div>
                    {s.amenities && <div className="mt-2 text-[11px] text-faint">{s.amenities}</div>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
