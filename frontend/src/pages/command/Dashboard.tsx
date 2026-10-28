import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowRight, CheckCircle2, Clock, Flame, PackageX, ShieldAlert, Siren, Truck } from 'lucide-react';
import { useApi, LIVE_MS } from '../../contexts/AppContext';
import MapView, { type MapPoint } from '../../components/MapView';
import { ErrorBox, LiveBadge, PageHeader, SEV_HEX, SeverityBadge, Spinner, StatCard, StatusBadge } from '../../components/ui';
import { guideForType } from '../../lib/guides';
import { errorMessage } from '../../lib/api';
import { minutes, num, timeAgo, titleCase } from '../../lib/format';

interface Stats {
  kpis: Record<string, number | null>;
  units: { total: number; available: number; deployed: number; off_duty: number; personnel: number; active_dispatches: number };
  shelters: { open: number; total: number; capacity: number; occupancy: number };
  low_stock: { id: number; resource_name: string; unit_of_measure: string; quantity_available: number; reorder_level: number; stock_status: string }[];
  recent: { id: number; title: string; incident_type: string; severity: string; status: string; zone_name: string | null; updated_at: string; created_at: string }[];
  activity: { incident_id: number; title: string; update_no: number; new_status: string; note: string | null; logged_at: string; logged_by_name: string | null }[];
  zones: { id: number; zone_name: string; risk_level: string; active_incidents: number; units_available: number }[];
  map: {
    incidents: { id: number; title: string; severity: string; status: string; zone_name: string; latitude: number; longitude: number }[];
    units: { id: number; unit_name: string; unit_type: string; availability_status: string; zone_name: string; latitude: number; longitude: number }[];
    shelters: { id: number; shelter_name: string; status: string; capacity: number; current_occupancy: number; latitude: number; longitude: number }[];
  };
}

function Clock2() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="card px-4 py-2.5 text-right">
      <div className="text-xs text-muted">{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <div className="font-display text-2xl font-bold">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, error, reload, updatedAt } = useApi<Stats>('/dashboard/stats', [], LIVE_MS);
  const nav = useNavigate();
  const [layers, setLayers] = useState({ incidents: true, units: true, shelters: false });

  if (error) return <ErrorBox text={errorMessage(error)} onRetry={reload} />;
  if (!data) return <Spinner label="Loading command center" />;
  const k = data.kpis;

  const points: MapPoint[] = [
    ...(layers.incidents ? data.map.incidents.map((i) => ({
      key: `i${i.id}`, lat: i.latitude, lng: i.longitude, color: SEV_HEX[i.severity], pulse: ['CRITICAL', 'HIGH'].includes(i.severity),
      onClick: () => nav(`/command/incidents?open=${i.id}`), popup: <div><b>#{i.id} {i.title}</b><br />{i.zone_name} · {titleCase(i.status)}</div>,
    })) : []),
    ...(layers.units ? data.map.units.map((u) => ({
      key: `u${u.id}`, lat: u.latitude, lng: u.longitude, shape: 'square' as const,
      color: u.availability_status === 'AVAILABLE' ? '#22c55e' : u.availability_status === 'DEPLOYED' ? '#60a5fa' : '#6b7280',
      popup: <div><b>{u.unit_name}</b><br />{titleCase(u.unit_type)} · {titleCase(u.availability_status)}</div>,
    })) : []),
    ...(layers.shelters ? data.map.shelters.map((s) => ({
      key: `s${s.id}`, lat: s.latitude, lng: s.longitude, shape: 'home' as const, color: s.status === 'OPEN' ? '#a78bfa' : '#6b7280',
      popup: <div><b>{s.shelter_name}</b><br />{s.current_occupancy}/{s.capacity} occupied</div>,
    })) : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Command Center" subtitle="Real-time overview of emergency response operations" actions={<><LiveBadge at={updatedAt} /><Clock2 /></>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="brand" icon={<ShieldAlert className="h-6 w-6" />} value={num(k.total_incidents)} label="Total Incidents"
          foot={<>+{num(k.new_last_7_days)} reported in the last 7 days · {num(k.awaiting_verification)} awaiting verification</>} />
        <StatCard tone="high" icon={<Siren className="h-6 w-6" />} value={num(k.active_incidents)} label="Active Incidents"
          foot={<>Verified or responding · {num(data.units.active_dispatches)} active dispatches</>} />
        <StatCard tone="critical" icon={<Flame className="h-6 w-6" />} value={num(k.critical_incidents)} label="Critical Incidents"
          foot={<>{num(k.high_incidents)} more open at high severity</>} />
        <StatCard tone="brand" icon={<CheckCircle2 className="h-6 w-6" />} value={num(k.resolved_incidents)} label="Resolved"
          foot={<>+{num(k.resolved_last_7_days)} in the last 7 days · avg response {minutes(k.avg_response_minutes)}</>} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Live Incident Map</h2>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(['incidents', 'units', 'shelters'] as const).map((l) => (
                <button key={l} onClick={() => setLayers({ ...layers, [l]: !layers[l] })}
                  className={`chip border ${layers[l] ? 'border-brand bg-brand/15 text-brand' : 'border-line text-muted'}`}>{titleCase(l)}</button>
              ))}
              <Link to="/command/zones" className="chip text-brand hover:underline">View full map <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </div>
          <MapView points={points} height={380} fitKey={`dash-${data.map.incidents.length}`} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            {['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((s) => <span key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SEV_HEX[s] }} />{titleCase(s)}</span>)}
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" />Unit available</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#60a5fa]" />Unit deployed</span>
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent Incidents</h2>
            <Link to="/command/incidents" className="text-xs font-semibold text-brand hover:underline">View all <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="divide-y divide-line">
            {data.recent.map((i) => {
              const Icon = guideForType(i.incident_type)?.icon ?? AlertOctagon;
              return (
                <button key={i.id} onClick={() => nav(`/command/incidents?open=${i.id}`)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-raised/40">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${SEV_HEX[i.severity]}22`, color: SEV_HEX[i.severity] }}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{i.title}</div>
                    <div className="truncate text-xs text-muted">{i.zone_name ?? 'Zone not set'} · {titleCase(i.incident_type)} · {titleCase(i.status)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1"><SeverityBadge value={i.severity} /><span className="text-[11px] text-faint">{timeAgo(i.updated_at)}</span></div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Truck className="h-5 w-5 text-brand" />Response units</h2>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-raised">
            <div className="bg-brand" style={{ width: `${(data.units.available / data.units.total) * 100}%` }} />
            <div className="bg-[#60a5fa]" style={{ width: `${(data.units.deployed / data.units.total) * 100}%` }} />
            <div className="bg-faint" style={{ width: `${(data.units.off_duty / data.units.total) * 100}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Available', data.units.available, 'text-brand'], ['Deployed', data.units.deployed, 'text-[#60a5fa]'], ['Off duty', data.units.off_duty, 'text-muted']].map(([l, v, c]) => (
              <div key={String(l)} className="rounded-xl bg-raised p-3"><div className={`font-display text-2xl font-bold ${c}`}>{v}</div><div className="text-[11px] text-muted">{l}</div></div>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted">{num(data.units.personnel)} personnel across {data.units.total} units · Shelters: {data.shelters.open} open, {num(data.shelters.capacity - data.shelters.occupancy)} places free</div>
          <Link to="/command/units" className="btn-outline btn-sm mt-4 w-full">Manage units</Link>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><PackageX className="h-5 w-5 text-sev-moderate" />Stock alerts</h2>
          {data.low_stock.length === 0 ? <p className="text-sm text-muted">All relief stock is above its reorder level.</p> : (
            <ul className="space-y-3">
              {data.low_stock.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><div className="truncate text-sm font-medium">{r.resource_name}</div><div className="text-[11px] text-muted">{num(r.quantity_available)} {r.unit_of_measure} left · reorder at {num(r.reorder_level)}</div></div>
                  <StatusBadge value={r.stock_status} kind="stock" />
                </li>
              ))}
            </ul>
          )}
          <Link to="/command/resources" className="btn-outline btn-sm mt-4 w-full">Open inventory</Link>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Clock className="h-5 w-5 text-info" />Latest activity</h2>
          <ul className="space-y-3">
            {data.activity.slice(0, 6).map((a) => (
              <li key={`${a.incident_id}-${a.update_no}`} className="text-sm">
                <button onClick={() => nav(`/command/incidents?open=${a.incident_id}`)} className="text-left hover:text-brand">
                  <span className="font-medium">#{a.incident_id}</span> {a.note ?? titleCase(a.new_status)}
                </button>
                <div className="text-[11px] text-muted">{a.logged_by_name ?? 'System'} · {timeAgo(a.logged_at)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Zone situation</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.zones.map((z) => (
            <Link to={`/command/zones?zone=${z.id}`} key={z.id} className="rounded-xl border border-line p-3 transition hover:border-brand">
              <div className="flex items-center justify-between gap-1"><span className="truncate text-sm font-semibold">{z.zone_name}</span><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SEV_HEX[z.risk_level] }} title={`${z.risk_level} risk`} /></div>
              <div className="mt-2 flex items-end justify-between text-[11px] text-muted">
                <span><b className={`font-display text-lg ${z.active_incidents ? 'text-sev-high' : 'text-ink'}`}>{z.active_incidents}</b> active</span>
                <span>{z.units_available} units free</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
