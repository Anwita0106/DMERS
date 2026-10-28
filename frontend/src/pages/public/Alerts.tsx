import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, LayoutGrid, List, Search, ShieldAlert, Phone } from 'lucide-react';
import { useApi, LIVE_MS } from '../../contexts/AppContext';
import { DisasterArt } from '../../components/Art';
import { Modal, SeverityBadge, StatusBadge, cx, SEV_HEX } from '../../components/ui';
import { GUIDES, HELPLINES, type Guide } from '../../lib/guides';
import { timeAgo, titleCase } from '../../lib/format';
import type { PublicAlert } from '../../lib/types';

function GuideModal({ guide, onClose }: { guide: Guide; onClose: () => void }) {
  const Icon = guide.icon;
  const block = (title: string, items: string[], tone: string) => (
    <div>
      <div className={`mb-2 text-xs font-bold uppercase tracking-wider ${tone}`}>{title}</div>
      <ul className="space-y-2">{items.map((t) => <li key={t} className="flex gap-2 text-sm"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current ${tone}`} /><span>{t}</span></li>)}</ul>
    </div>
  );
  return (
    <Modal title={`${guide.title} safety guide`} onClose={onClose} wide>
      <div className="-mx-5 -mt-4 mb-5">
        <DisasterArt guide={guide} className="h-36" />
      </div>
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand"><Icon className="h-5 w-5" /></div>
        <p className="text-sm text-muted">{guide.summary}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {block('Before', guide.before, 'text-info')}
        {block('During', guide.during, 'text-sev-high')}
        {block('After', guide.after, 'text-brand')}
      </div>
      <div className="mt-6 flex flex-wrap gap-2 rounded-xl bg-raised p-3 text-xs">
        <Phone className="h-4 w-4 text-brand" />
        {HELPLINES.slice(0, 5).map((h) => <span key={h.label}><b>{h.number}</b> {h.label}</span>).reduce<JSX.Element[]>((a, el, i) => (i ? [...a, <span key={`d${i}`} className="text-faint">·</span>, el] : [el]), [])}
      </div>
    </Modal>
  );
}

export default function Alerts() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { data: alerts, error: alertsError } = useApi<PublicAlert[]>('/public/alerts', [], LIVE_MS);
  const open = GUIDES.find((g) => g.key === params.get('guide'));

  const guides = useMemo(() => GUIDES.filter((g) => (tab === 'all' || g.key === tab)
    && (!q || `${g.title} ${g.summary}`.toLowerCase().includes(q.toLowerCase()))), [tab, q]);
  const live = useMemo(() => (alerts ?? []).filter((a) => {
    const g = GUIDES.find((x) => x.key === tab);
    return (tab === 'all' || g?.incidentTypes.includes(a.incident_type))
      && (!q || `${a.title} ${a.zone_name} ${a.incident_type}`.toLowerCase().includes(q.toLowerCase()));
  }), [alerts, tab, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Live Alerts & Awareness</h1>
      <p className="mt-2 text-muted">Stay informed and be prepared. Learn safety measures for different natural disasters.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          {[{ key: 'all', title: 'All' }, ...GUIDES].map((g) => (
            <button key={g.key} onClick={() => setTab(g.key)}
              className={cx('rounded-full px-4 py-1.5 text-sm font-medium transition', tab === g.key ? 'bg-brand text-brand-ink' : 'text-muted hover:bg-raised hover:text-ink')}>
              {g.title}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input className="input rounded-full pl-9" placeholder="Search disaster type..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-xl border border-line p-1">
          <button aria-label="Grid view" onClick={() => setView('grid')} className={cx('rounded-lg p-1.5', view === 'grid' ? 'bg-brand text-brand-ink' : 'text-muted')}><LayoutGrid className="h-4 w-4" /></button>
          <button aria-label="List view" onClick={() => setView('list')} className={cx('rounded-lg p-1.5', view === 'list' ? 'bg-brand text-brand-ink' : 'text-muted')}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {/* live incidents */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sev-critical opacity-70" /><span className="relative h-2.5 w-2.5 rounded-full bg-sev-critical" /></span>
          <h2 className="text-lg font-semibold">Active alerts {tab !== 'all' && <span className="text-muted">· {GUIDES.find((g) => g.key === tab)?.title}</span>}</h2>
        </div>
        {live.length === 0 ? (
          <div className="card p-5 text-sm text-muted">{alerts ? 'No active alerts of this type right now.' : alertsError ? 'Live alerts could not be loaded from the server.' : 'Loading alerts...'}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {live.map((a) => (
              <div key={a.id} className="card flex gap-4 p-4" style={{ borderLeft: `3px solid ${SEV_HEX[a.severity]}` }}>
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: SEV_HEX[a.severity] }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.title}</span><SeverityBadge value={a.severity} /></div>
                  <div className="mt-1 text-xs text-muted">{a.location} · {a.zone_name}, {a.district}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusBadge value={a.status} /><span>{titleCase(a.incident_type)}</span><span>·</span>
                    <span>{a.units_responding} unit{a.units_responding === 1 ? '' : 's'} responding</span><span>·</span><span>updated {timeAgo(a.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* guides */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Safety guides</h2>
        <div className={view === 'grid' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4' : 'space-y-3'}>
          {guides.map((g) => {
            const Icon = g.icon;
            return view === 'grid' ? (
              <article key={g.key} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:border-brand">
                <div className="relative">
                  <DisasterArt guide={g} className="h-40" />
                  <div className="absolute -bottom-5 left-4 grid h-11 w-11 place-items-center rounded-xl bg-brand text-brand-ink shadow-glow"><Icon className="h-5 w-5" /></div>
                </div>
                <div className="p-4 pt-7">
                  <h3 className="font-display text-lg font-semibold">{g.title}</h3>
                  <p className="mt-1 min-h-[40px] text-sm text-muted">{g.summary}</p>
                  <button onClick={() => setParams({ guide: g.key })} className="btn-outline btn-sm mt-4 border-brand/40 text-brand">Read Safety Guide<ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
              </article>
            ) : (
              <article key={g.key} className="card flex items-center gap-4 overflow-hidden">
                <DisasterArt guide={g} className="h-20 w-28 shrink-0" />
                <div className="min-w-0 flex-1 py-3"><h3 className="font-semibold">{g.title}</h3><p className="truncate text-sm text-muted">{g.summary}</p></div>
                <button onClick={() => setParams({ guide: g.key })} className="btn-outline btn-sm mr-4">Read guide</button>
              </article>
            );
          })}
        </div>
        {guides.length === 0 && <div className="card p-6 text-center text-sm text-muted">No guides match "{q}".</div>}
      </section>
      {open && <GuideModal guide={open} onClose={() => { params.delete('guide'); setParams(params); }} />}
    </div>
  );
}
