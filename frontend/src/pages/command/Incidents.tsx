import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MoreHorizontal, Plus, RotateCcw, Search, Loader2 } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useToast, LIVE_MS } from '../../contexts/AppContext';
import { EmptyState, ErrorBox, LiveBadge, Field, Modal, PageHeader, Pagination, SeverityBadge, Spinner, StatusBadge } from '../../components/ui';
import IncidentDrawer from './IncidentDrawer';
import { timeAgo, titleCase } from '../../lib/format';
import type { Incident, Paged, Zone } from '../../lib/types';

const PAGE = 10;

function NewIncident({ onClose, onDone }: { onClose: () => void; onDone: (i: Incident) => void }) {
  const { data: zones } = useApi<Zone[]>('/zones');
  const { data: types } = useApi<string[]>('/incidents/types');
  const [f, setF] = useState({ title: '', incident_type: '', severity: 'MODERATE', location: '', zone_id: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await api.post<Incident>('/incidents', { ...f, description: f.description || null, zone_id: f.zone_id ? Number(f.zone_id) : null });
      onDone(data);
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal wide title="Report new incident" onClose={onClose} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={busy || !f.title || !f.incident_type || !f.location} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create report</button></>}>
      <p className="mb-4 text-sm text-muted">The incident starts as REPORTED with you as the reporter. Verify it next to set its zone.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title *"><input className="input" maxLength={120} value={f.title} onChange={set('title')} /></Field></div>
        <Field label="Type *"><select className="input" value={f.incident_type} onChange={set('incident_type')}><option value="">Select</option>{(types ?? []).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
        <Field label="Severity"><select className="input" value={f.severity} onChange={set('severity')}>{['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Field>
        <Field label="Location *"><input className="input" maxLength={150} value={f.location} onChange={set('location')} /></Field>
        <Field label="Zone"><select className="input" value={f.zone_id} onChange={set('zone_id')}><option value="">Not sure</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.zone_name}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea className="input min-h-[90px]" value={f.description} onChange={set('description')} /></Field></div>
      </div>
      {err && <div className="mt-3"><ErrorBox text={err} /></div>}
    </Modal>
  );
}

export default function Incidents() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ zone_id: '', incident_type: '', severity: '', status: '' });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const openId = params.get('open') ? Number(params.get('open')) : null;
  const { data: zones } = useApi<Zone[]>('/zones');
  const { data: types } = useApi<string[]>('/incidents/types');

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(1), [debounced, filters]);

  const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE), sort: 'newest' });
  if (debounced) qs.set('q', debounced);
  Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
  const { data, loading, error, reload, updatedAt } = useApi<Paged<Incident>>(`/incidents?${qs}`, [], LIVE_MS);

  const setF = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });
  const open = (id: number | null) => { if (id) params.set('open', String(id)); else params.delete('open'); setParams(params, { replace: true }); };

  return (
    <div>
      <PageHeader title="Incidents Management" subtitle="View, verify and manage all reported incidents"
        actions={<><LiveBadge at={updatedAt} /><button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Report New Incident</button></>} />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className="input pl-9" placeholder="Search incidents, places or #id..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={filters.zone_id} onChange={setF('zone_id')} aria-label="Zone"><option value="">All zones</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.zone_name}</option>)}</select>
          <select className="input w-auto" value={filters.incident_type} onChange={setF('incident_type')} aria-label="Type"><option value="">All types</option>{(types ?? []).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
          <select className="input w-auto" value={filters.severity} onChange={setF('severity')} aria-label="Severity"><option value="">All severities</option>{['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
          <select className="input w-auto" value={filters.status} onChange={setF('status')} aria-label="Status">
            <option value="">All status</option><option value="REPORTED,VERIFIED,RESPONDING">Open (any)</option>
            {['REPORTED', 'VERIFIED', 'RESPONDING', 'RESOLVED', 'CLOSED', 'REJECTED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <button className="btn-ghost text-brand" onClick={() => { setQ(''); setFilters({ zone_id: '', incident_type: '', severity: '', status: '' }); }}><RotateCcw className="h-4 w-4" />Reset</button>
        </div>

        {error ? <div className="p-4"><ErrorBox text={errorMessage(error)} onRetry={reload} /></div> : !data && loading ? <Spinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-line bg-raised/50">
                  <tr>{['#', 'Title', 'Type', 'Zone', 'Severity', 'Status', 'Reported', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
                </thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data?.items.map((i) => (
                    <tr key={i.id} onClick={() => open(i.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-raised/50">
                      <td className="table-cell text-muted">{i.id}</td>
                      <td className="table-cell max-w-[280px]"><div className="truncate font-medium">{i.title}</div><div className="truncate text-[11px] text-muted">{i.location}</div></td>
                      <td className="table-cell">{titleCase(i.incident_type)}</td>
                      <td className="table-cell">{i.zone_name ?? <span className="text-faint">Not set</span>}</td>
                      <td className="table-cell"><SeverityBadge value={i.severity} /></td>
                      <td className="table-cell"><StatusBadge value={i.status} /></td>
                      <td className="table-cell whitespace-nowrap text-muted">{timeAgo(i.created_at)}</td>
                      <td className="table-cell"><button className="btn-ghost btn-sm" aria-label={`Open incident ${i.id}`}><MoreHorizontal className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && data.items.length === 0 && <EmptyState title="No incidents found" hint="Try changing or resetting the filters." />}
            {data && <Pagination page={page} pageSize={PAGE} total={data.total} onPage={setPage} />}
          </>
        )}
      </div>

      {openId && <IncidentDrawer id={openId} onClose={() => open(null)} onChanged={reload} />}
      {creating && <NewIncident onClose={() => setCreating(false)} onDone={(i) => { setCreating(false); toast('ok', `Incident #${i.id} created`); reload(); open(i.id); }} />}
    </div>
  );
}
