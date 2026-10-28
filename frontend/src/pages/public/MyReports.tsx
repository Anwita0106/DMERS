import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { useApi, useAuth, LIVE_MS } from '../../contexts/AppContext';
import { EmptyState, ErrorBox, SeverityBadge, Spinner, StatusBadge } from '../../components/ui';
import Timeline from '../../components/Timeline';
import { errorMessage } from '../../lib/api';
import { timeAgo, titleCase } from '../../lib/format';
import type { Incident, IncidentDetail } from '../../lib/types';

function Detail({ id }: { id: number }) {
  const { data } = useApi<IncidentDetail>(`/incidents/${id}`, [], LIVE_MS);
  if (!data) return <Spinner />;
  return (
    <div className="grid grid-cols-1 gap-6 border-t border-line p-4 md:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">Progress</div>
        <Timeline items={data.timeline} />
      </div>
      <div className="space-y-3 text-sm">
        {data.description && <p className="text-muted">{data.description}</p>}
        <div><span className="text-muted">Units sent:</span> {data.dispatches.length ? data.dispatches.map((d) => `${d.unit_name} (${titleCase(d.dispatch_status)})`).join(', ') : 'none yet'}</div>
        <div><span className="text-muted">Relief:</span> {data.allocations.length ? data.allocations.map((a) => `${a.quantity} ${a.unit_of_measure} ${a.resource_name}`).join(', ') : 'none yet'}</div>
        <div><span className="text-muted">Photos attached:</span> {data.attachments.length}</div>
      </div>
    </div>
  );
}

export default function MyReports() {
  const { user, ready } = useAuth();
  const [params] = useSearchParams();
  const { data, loading, error, reload } = useApi<Incident[]>(user ? '/incidents/mine' : null, [], LIVE_MS);
  const [open, setOpen] = useState<number | null>(null);
  if (ready && !user) return <Navigate to="/login?next=/my-reports" replace />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {params.get('denied') && <div className="mb-6 rounded-xl border border-sev-moderate/40 bg-sev-moderate/10 p-3 text-sm">The Command Center is for coordinators, unit leads and administrators. Your citizen account can report incidents and follow them here.</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">My reports</h1><p className="mt-1 text-muted">Incidents you reported and what the control room has done.</p></div>
        <Link to="/report" className="btn-primary"><Plus className="h-4 w-4" />Report an incident</Link>
      </div>
      <div className="mt-6 space-y-3">
        {loading && <Spinner />}
        {error ? <ErrorBox text={errorMessage(error)} onRetry={reload} /> : null}
        {data && data.length === 0 && <div className="card"><EmptyState title="No reports yet" hint="When you report an incident, you can follow its progress here." /></div>}
        {data?.map((i) => (
          <div key={i.id} className="card overflow-hidden">
            <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(open === i.id ? null : i.id)}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-faint">#{i.id}</span><span className="font-semibold">{i.title}</span></div>
                <div className="mt-1 text-xs text-muted">{titleCase(i.incident_type)} · {i.location} · reported {timeAgo(i.created_at)}</div>
              </div>
              <div className="flex items-center gap-2"><SeverityBadge value={i.severity} /><StatusBadge value={i.status} /><ChevronDown className={`h-4 w-4 transition ${open === i.id ? 'rotate-180' : ''}`} /></div>
            </button>
            {open === i.id && <Detail id={i.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
