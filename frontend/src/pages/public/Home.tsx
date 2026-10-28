import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Building2, Flame, Home as HomeIcon, Megaphone, PackageCheck, Radio, ShieldAlert, Siren, Users } from 'lucide-react';
import { useApi, LIVE_MS } from '../../contexts/AppContext';
import { HeroArt, DisasterArt } from '../../components/Art';
import MapView, { type MapPoint } from '../../components/MapView';
import { SEV_HEX, SeverityBadge, StatusBadge } from '../../components/ui';
import { GUIDES, guideForType } from '../../lib/guides';
import { PHOTOS } from '../../lib/photos';
import { num, timeAgo, titleCase } from '../../lib/format';
import type { PublicAlert, Shelter } from '../../lib/types';

interface Summary {
  active_incidents: number; critical_alerts: number; units_available: number; units_total: number;
  shelters_open: number; shelter_beds_free: number; alerts: PublicAlert[];
}

function HeroStat({ icon, value, label, sub, tone, state }: {
  icon: JSX.Element; value: string; label: string; sub?: string; tone: string; state: 'loading' | 'error' | 'ok';
}) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#07110c]/75 p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,.8)] ring-1 ring-inset ring-white/5 backdrop-blur-xl transition hover:border-brand/40">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-white/10 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        {state === 'loading' ? <div className="h-8 w-16 animate-pulse rounded-md bg-white/15" />
          : state === 'error' ? <div className="font-display text-lg font-semibold text-red-300">Offline</div>
          : <div className="font-display text-3xl font-bold leading-none text-white">{value}</div>}
        <div className="mt-1.5 truncate text-[13px] font-medium text-white/80">{label}</div>
        {sub && state === 'ok' && <div className="truncate text-[11px] text-white/50">{sub}</div>}
      </div>
    </div>
  );
}

export default function Home() {
  const { data, error, loading } = useApi<Summary>('/public/summary', [], LIVE_MS);
  const { data: shelters } = useApi<Shelter[]>('/shelters', [], LIVE_MS);
  const state: 'loading' | 'error' | 'ok' = data ? 'ok' : error ? 'error' : loading ? 'loading' : 'error';
  const v = (n?: number) => num(n);

  const points: MapPoint[] = [
    ...(data?.alerts ?? []).filter((a) => a.latitude).map((a) => ({
      key: `a${a.id}`, lat: a.latitude!, lng: a.longitude!, color: SEV_HEX[a.severity], pulse: a.severity === 'CRITICAL' || a.severity === 'HIGH',
      popup: <div><b>{a.title}</b><br />{a.zone_name} · {titleCase(a.severity)}</div>,
    })),
    ...(shelters ?? []).filter((s) => s.status !== 'CLOSED').map((s) => ({
      key: `s${s.id}`, lat: s.latitude, lng: s.longitude, color: '#3b82f6', shape: 'home' as const,
      popup: <div><b>{s.shelter_name}</b><br />{s.available} of {s.capacity} places free</div>,
    })),
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative isolate overflow-hidden">
        <HeroArt />
        <div className="relative mx-auto flex min-h-[640px] max-w-7xl flex-col justify-end px-4 pb-12 pt-20 sm:px-6 lg:min-h-[700px]">
          <div className="max-w-4xl animate-fadeUp">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-black/40 px-3 py-1 text-xs font-semibold text-brand backdrop-blur">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand" /></span>
              Live situation · Vellore, Ranipet & Tirupattur districts
            </span>
            <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.04] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,.6)] sm:text-6xl lg:text-[4.4rem]">
              <span className="sm:whitespace-nowrap">Disaster Management &amp;</span><br />
              <span className="bg-gradient-to-r from-[#4ade80] to-[#16a34a] bg-clip-text text-transparent sm:whitespace-nowrap">Emergency Response</span>
            </h1>
            <p className="mt-5 font-display text-xl font-semibold text-[#4ade80] sm:text-2xl">Prepared Communities. Safer Tomorrows.</p>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">Real-time alerts, emergency resources, shelter information and rapid response coordination for a safer and more resilient community.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/alerts" className="btn-primary px-6 py-3 text-[15px]">Explore Live Alerts<ArrowRight className="h-4 w-4" /></Link>
              <Link to="/report" className="btn border border-white/25 bg-white/10 px-6 py-3 text-[15px] text-white backdrop-blur hover:border-brand hover:bg-brand/15">Report an Incident</Link>
              <Link to="/command" className="btn px-3 py-3 text-[15px] text-white/80 hover:text-brand">Open Command Center<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat state={state} icon={<Siren className="h-6 w-6" />} tone="bg-red-500/20 text-red-300" value={v(data?.active_incidents)} label="Active Incidents" sub="Verified or responding" />
            <HeroStat state={state} icon={<Flame className="h-6 w-6" />} tone="bg-orange-500/20 text-orange-300" value={v(data?.critical_alerts)} label="High & Critical Alerts" sub="Among active incidents" />
            <HeroStat state={state} icon={<Users className="h-6 w-6" />} tone="bg-brand/20 text-[#4ade80]" value={data ? `${data.units_available}/${data.units_total}` : ''} label="Response Units Available" sub="Ready to dispatch" />
            <HeroStat state={state} icon={<HomeIcon className="h-6 w-6" />} tone="bg-brand/20 text-[#4ade80]" value={v(data?.shelters_open)} label="Shelters Open" sub={data ? `${num(data.shelter_beds_free)} places free` : ''} />
          </div>
          <div className="mt-4 text-right text-[10px] text-white/40">Photo: {PHOTOS.hero.caption} · {PHOTOS.hero.credit}</div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- live alerts */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Happening now</div>
            <h2 className="mt-1 text-3xl font-bold">Active alerts</h2>
            <p className="mt-1 text-sm text-muted">Incidents verified by the control room and still being handled.</p>
          </div>
          <Link to="/alerts" className="btn-outline btn-sm">All alerts & safety guides<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            {(data?.alerts ?? []).slice(0, 5).map((a) => {
              const g = guideForType(a.incident_type);
              const Icon = g?.icon ?? ShieldAlert;
              return (
                <div key={a.id} className="card flex items-center gap-4 p-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${SEV_HEX[a.severity]}22`, color: SEV_HEX[a.severity] }}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{a.title}</div>
                    <div className="truncate text-xs text-muted">{a.zone_name}, {a.district} · {titleCase(a.incident_type)} · updated {timeAgo(a.updated_at)}</div>
                  </div>
                  <div className="hidden flex-col items-end gap-1 sm:flex"><SeverityBadge value={a.severity} /><StatusBadge value={a.status} /></div>
                </div>
              );
            })}
            {data && data.alerts.length === 0 && <div className="card p-6 text-center text-sm text-muted">No active alerts right now.</div>}
            {!data && loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[76px] animate-pulse bg-raised" />)}
            {!data && error ? <div className="card border-sev-critical/40 p-6 text-center text-sm text-muted">Live alerts could not be loaded from the server.</div> : null}
          </div>
          <MapView points={points} height={380} fitKey={`home-${points.length}`} emptyText={data ? 'No active alerts or open shelters on the map' : 'Waiting for live data...'} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- how it works */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="eyebrow">How DMERS works</div>
          <h2 className="mt-1 text-3xl font-bold">From your report to relief on the ground</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Megaphone, t: 'You report', d: 'Anyone with an account reports what they see, with photos. It is logged as REPORTED.' },
              { icon: BadgeCheck, t: 'Control room verifies', d: 'A coordinator confirms the report, sets its zone and severity.' },
              { icon: Radio, t: 'Units are dispatched', d: 'Fire, medical, police, rescue or relief units are sent. Each unit handles one incident at a time.' },
              { icon: PackageCheck, t: 'Relief is allocated', d: 'Food, water, medical kits and shelter items are issued from tracked stock.' },
            ].map((s, i) => (
              <div key={s.t} className="card relative p-5">
                <span className="absolute right-4 top-4 font-display text-4xl font-extrabold text-line">{i + 1}</span>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand"><s.icon className="h-5 w-5" /></div>
                <div className="mt-4 font-display text-lg font-semibold">{s.t}</div>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- preparedness */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Be prepared</div>
            <h2 className="mt-1 text-3xl font-bold">Safety guides</h2>
          </div>
          <Link to="/shelters" className="btn-outline btn-sm"><Building2 className="h-3.5 w-3.5" />Find a shelter</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {GUIDES.slice(0, 4).map((g) => (
            <Link key={g.key} to={`/alerts?guide=${g.key}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:border-brand">
              <DisasterArt guide={g} className="h-28 sm:h-36" />
              <div className="p-4">
                <div className="font-display font-semibold group-hover:text-brand">{g.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted">{g.summary}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
