import { useEffect, useState } from 'react';
import { BadgeCheck, Ban, CheckCircle2, Image as ImageIcon, Lock, Package, Pencil, Send, Trash2, Undo2, Loader2 } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useAuth, useToast, LIVE_MS } from '../../contexts/AppContext';
import { Drawer, ErrorBox, Field, Modal, SeverityBadge, Spinner, StatusBadge } from '../../components/ui';
import Timeline from '../../components/Timeline';
import MapView from '../../components/MapView';
import { dateTime, minutes, num, titleCase } from '../../lib/format';
import type { IncidentDetail, Resource, Unit, Zone } from '../../lib/types';

type Action = 'verify' | 'reject' | 'resolve' | 'close' | 'dispatch' | 'allocate' | 'edit' | 'delete' | null;

function Photo({ id, name }: { id: number; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url = '';
    api.get(`/attachments/${id}`, { responseType: 'blob' }).then((r) => { url = URL.createObjectURL(r.data); setSrc(url); }).catch(() => setSrc(''));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  if (src === null) return <div className="aspect-square animate-pulse rounded-lg bg-raised" />;
  if (!src) return <div className="grid aspect-square place-items-center rounded-lg bg-raised text-faint"><ImageIcon className="h-5 w-5" /></div>;
  return <a href={src} target="_blank" rel="noreferrer" title={name}><img src={src} alt={name} className="aspect-square w-full rounded-lg object-cover" /></a>;
}

export default function IncidentDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: inc, error, reload } = useApi<IncidentDetail>(`/incidents/${id}`, [], LIVE_MS);
  const [action, setAction] = useState<Action>(null);

  const done = (_next: IncidentDetail | null, msg: string) => {
    toast('ok', msg); setAction(null); onChanged(); reload();
  };

  if (error) return <Drawer title="Incident" onClose={onClose}><ErrorBox text={errorMessage(error)} /></Drawer>;
  return (
    <Drawer onClose={onClose} title={inc ? (
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><span>#{inc.id}</span><span>·</span><span>{titleCase(inc.incident_type)}</span><span>·</span><span>Reported {dateTime(inc.created_at)}</span></div>
        <h2 className="mt-1 truncate text-xl font-bold">{inc.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2"><SeverityBadge value={inc.severity} /><StatusBadge value={inc.status} /></div>
      </div>
    ) : 'Incident'}>
      {!inc ? <Spinner /> : (
        <div className="space-y-6">
          {/* actions */}
          <div className="flex flex-wrap gap-2">
            {inc.actions.can_verify && <button className="btn-primary btn-sm" onClick={() => setAction('verify')}><BadgeCheck className="h-3.5 w-3.5" />Verify</button>}
            {inc.actions.can_dispatch && <button className="btn-primary btn-sm" onClick={() => setAction('dispatch')}><Send className="h-3.5 w-3.5" />Dispatch unit</button>}
            {inc.actions.can_allocate && <button className="btn-outline btn-sm" onClick={() => setAction('allocate')}><Package className="h-3.5 w-3.5" />Allocate relief</button>}
            {inc.actions.can_resolve && <button className="btn-outline btn-sm" onClick={() => setAction('resolve')}><CheckCircle2 className="h-3.5 w-3.5" />Mark resolved</button>}
            {inc.actions.can_close && <button className="btn-outline btn-sm" onClick={() => setAction('close')}><Lock className="h-3.5 w-3.5" />Close incident</button>}
            {inc.actions.can_edit && <button className="btn-ghost btn-sm" onClick={() => setAction('edit')}><Pencil className="h-3.5 w-3.5" />Edit</button>}
            {inc.actions.can_reject && <button className="btn-ghost btn-sm text-sev-critical" onClick={() => setAction('reject')}><Ban className="h-3.5 w-3.5" />Reject</button>}
            {inc.actions.can_delete && <button className="btn-ghost btn-sm text-sev-critical" onClick={() => setAction('delete')}><Trash2 className="h-3.5 w-3.5" />Delete</button>}
          </div>
          {user?.account_type === 'ADMINISTRATOR' && ['VERIFIED', 'RESPONDING'].includes(inc.status) && (
            <p className="-mt-3 text-[11px] text-faint">Dispatching units is reserved for coordinators (FR-07, enforced by sp_dispatch_unit).</p>
          )}

          {/* facts */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Location', inc.location], ['Zone', inc.zone_name ? `${inc.zone_name}, ${inc.district} (${titleCase(inc.zone_risk)} risk)` : 'Not assigned yet'],
              ['Reported by', inc.reporter_name ?? '-'], ['Last update', dateTime(inc.updated_at)],
              ['Response time', minutes(inc.response_minutes)], ['Units on it', `${inc.active_units} active · ${inc.dispatches.length} total`],
            ].map(([k, v]) => <div key={k} className="rounded-xl bg-raised p-3"><div className="text-[11px] text-muted">{k}</div><div className="mt-0.5 text-sm font-medium">{v}</div></div>)}
          </div>
          {inc.description && <p className="rounded-xl border border-line p-3 text-sm">{inc.description}</p>}
          {inc.latitude && <MapView height={180} points={[{ key: 'i', lat: inc.latitude, lng: inc.longitude!, color: '#ef4444', pulse: true }]} fitKey={String(inc.id)} />}

          {inc.attachments.length > 0 && (
            <section><h3 className="mb-2 text-sm font-semibold">Photos ({inc.attachments.length})</h3>
              <div className="grid grid-cols-4 gap-2">{inc.attachments.map((a) => <Photo key={a.id} id={a.id} name={a.file_name} />)}</div></section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">Dispatched units</h3>
            {inc.dispatches.length === 0 ? <p className="text-sm text-muted">No units dispatched yet.</p> : (
              <div className="overflow-hidden rounded-xl border border-line">
                {inc.dispatches.map((d) => (
                  <div key={d.unit_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3 last:border-0">
                    <div><div className="text-sm font-medium">{d.unit_name}</div><div className="text-[11px] text-muted">{titleCase(d.unit_type)} · sent {dateTime(d.dispatched_at)} by {d.dispatched_by_name}{d.arrived_at ? ` · arrived ${dateTime(d.arrived_at)}` : ''}</div></div>
                    <StatusBadge value={d.dispatch_status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Relief allocated</h3>
            {inc.allocations.length === 0 ? <p className="text-sm text-muted">No relief allocated yet.</p> : (
              <div className="flex flex-wrap gap-2">{inc.allocations.map((a) => (
                <span key={a.resource_id} className="chip bg-raised text-ink">{num(a.quantity)} {a.unit_of_measure} · {a.resource_name}</span>
              ))}</div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Timeline <span className="font-normal text-faint">(written by the database, append-only)</span></h3>
            <Timeline items={inc.timeline} />
          </section>
        </div>
      )}

      {inc && action === 'verify' && <VerifyModal inc={inc} onClose={() => setAction(null)} onDone={(n) => done(n, `Incident #${inc.id} verified`)} />}
      {inc && (action === 'reject' || action === 'resolve' || action === 'close') && (
        <NoteModal inc={inc} kind={action} onClose={() => setAction(null)} onDone={(n, m) => done(n, m)} />
      )}
      {inc && action === 'dispatch' && <DispatchModal inc={inc} onClose={() => setAction(null)} onDone={(m) => done(null, m)} />}
      {inc && action === 'allocate' && <AllocateModal inc={inc} onClose={() => setAction(null)} onDone={(m) => done(null, m)} />}
      {inc && action === 'edit' && <EditModal inc={inc} onClose={() => setAction(null)} onDone={(n) => done(n, 'Incident updated')} />}
      {inc && action === 'delete' && (
        <Modal title="Delete rejected report?" onClose={() => setAction(null)} footer={<>
          <button className="btn-ghost" onClick={() => setAction(null)}>Cancel</button>
          <button className="btn-danger" onClick={async () => {
            try { await api.delete(`/incidents/${inc.id}`); toast('ok', `Incident #${inc.id} deleted`); onChanged(); onClose(); }
            catch (e) { toast('error', errorMessage(e)); }
          }}>Delete</button></>}>
          <p className="text-sm text-muted">The report and its timeline are removed permanently.</p>
        </Modal>
      )}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ modals */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return { busy, err, run };
}
const Busy = ({ on }: { on: boolean }) => (on ? <Loader2 className="h-4 w-4 animate-spin" /> : null);

function VerifyModal({ inc, onClose, onDone }: { inc: IncidentDetail; onClose: () => void; onDone: (n: IncidentDetail) => void }) {
  const { data: zones } = useApi<Zone[]>('/zones');
  const [zone, setZone] = useState(inc.zone_id ? String(inc.zone_id) : '');
  const [sev, setSev] = useState(inc.severity);
  const [note, setNote] = useState('');
  const s = useSubmit();
  return (
    <Modal title={`Verify incident #${inc.id}`} onClose={onClose} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={!zone || s.busy} onClick={() => s.run(async () => {
        const { data } = await api.post(`/incidents/${inc.id}/verify`, { zone_id: Number(zone), severity: sev, note: note || null }); onDone(data);
      })}><Busy on={s.busy} />Verify</button></>}>
      <div className="space-y-4">
        <p className="text-sm text-muted">A zone must be set before an incident is verified (FR-05).</p>
        <Field label="Zone *"><select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">Select zone</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.zone_name} · {z.district} ({titleCase(z.risk_level)} risk)</option>)}
        </select></Field>
        <Field label="Confirmed severity"><select className="input" value={sev} onChange={(e) => setSev(e.target.value as typeof sev)}>
          {['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Field>
        <Field label="Note for the timeline (optional)"><input className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Confirmed by field call" /></Field>
        {s.err && <ErrorBox text={s.err} />}
      </div>
    </Modal>
  );
}

function NoteModal({ inc, kind, onClose, onDone }: { inc: IncidentDetail; kind: 'reject' | 'resolve' | 'close'; onClose: () => void; onDone: (n: IncidentDetail, msg: string) => void }) {
  const [note, setNote] = useState('');
  const s = useSubmit();
  const cfg = {
    reject: { t: 'Reject report', b: 'Reject', d: 'Use for duplicates or reports that could not be confirmed.', url: `/incidents/${inc.id}/status`, body: { status: 'REJECTED' }, m: 'rejected' },
    resolve: { t: 'Mark as resolved', b: 'Mark resolved', d: 'The situation is under control and no units are still assigned.', url: `/incidents/${inc.id}/status`, body: { status: 'RESOLVED' }, m: 'resolved' },
    close: { t: 'Close incident', b: 'Close incident', d: `Runs sp_close_incident: every unit still assigned (${inc.active_units}) is released and the incident is closed.`, url: `/incidents/${inc.id}/close`, body: {}, m: 'closed' },
  }[kind];
  return (
    <Modal title={`${cfg.t} #${inc.id}`} onClose={onClose} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className={kind === 'reject' ? 'btn-danger' : 'btn-primary'} disabled={s.busy} onClick={() => s.run(async () => {
        const { data } = await api.post(cfg.url, { ...cfg.body, note: note || null }); onDone(data, `Incident #${inc.id} ${cfg.m}`);
      })}><Busy on={s.busy} />{cfg.b}</button></>}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{cfg.d}</p>
        <Field label="Note for the timeline (optional)"><input className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {s.err && <ErrorBox text={s.err} />}
      </div>
    </Modal>
  );
}

function DispatchModal({ inc, onClose, onDone }: { inc: IncidentDetail; onClose: () => void; onDone: (m: string) => void }) {
  const { data: units } = useApi<Unit[]>('/units?availability=AVAILABLE');
  const [pick, setPick] = useState<number | null>(null);
  const s = useSubmit();
  const sorted = (units ?? []).slice().sort((a, b) => Number(b.zone_id === inc.zone_id) - Number(a.zone_id === inc.zone_id));
  return (
    <Modal wide title={`Dispatch a unit to #${inc.id}`} onClose={onClose} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={!pick || s.busy} onClick={() => s.run(async () => {
        const { data } = await api.post('/dispatches', { incident_id: inc.id, unit_id: pick }); onDone(`${data.unit_name} dispatched`);
      })}><Busy on={s.busy} /><Send className="h-4 w-4" />Dispatch</button></>}>
      <p className="mb-3 text-sm text-muted">Only AVAILABLE units are listed; a unit can hold one active dispatch at a time (BR-05). Units based in {inc.zone_name ?? 'the incident zone'} are shown first.</p>
      {!units ? <Spinner /> : sorted.length === 0 ? <p className="text-sm">No units are available right now.</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((u) => (
            <button key={u.id} onClick={() => setPick(u.id)} className={`rounded-xl border p-3 text-left transition ${pick === u.id ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/60'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{u.unit_name}</span><span className="chip bg-raised text-muted">{titleCase(u.unit_type)}</span></div>
              <div className="mt-1 text-[11px] text-muted">{u.zone_name}{u.zone_id === inc.zone_id ? ' · same zone' : ''} · {u.personnel_count} personnel · {u.contact_phone}</div>
            </button>
          ))}
        </div>
      )}
      {s.err && <div className="mt-3"><ErrorBox text={s.err} /></div>}
    </Modal>
  );
}

function AllocateModal({ inc, onClose, onDone }: { inc: IncidentDetail; onClose: () => void; onDone: (m: string) => void }) {
  const { data: res } = useApi<Resource[]>('/resources');
  const [rid, setRid] = useState('');
  const [qty, setQty] = useState(1);
  const s = useSubmit();
  const r = res?.find((x) => String(x.id) === rid);
  return (
    <Modal title={`Allocate relief to #${inc.id}`} onClose={onClose} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={!rid || qty < 1 || s.busy} onClick={() => s.run(async () => {
        await api.post('/allocations', { incident_id: inc.id, resource_id: Number(rid), quantity: qty }); onDone(`${qty} ${r?.unit_of_measure ?? ''} ${r?.resource_name ?? ''} allocated`);
      })}><Busy on={s.busy} />Allocate</button></>}>
      <div className="space-y-4">
        <Field label="Resource"><select className="input" value={rid} onChange={(e) => setRid(e.target.value)}>
          <option value="">Select resource</option>
          {(res ?? []).map((x) => <option key={x.id} value={x.id} disabled={x.quantity_available === 0}>{x.resource_name} · {num(x.quantity_available)} {x.unit_of_measure} in stock{x.stock_status !== 'ADEQUATE' ? ` (${titleCase(x.stock_status)})` : ''}</option>)}
        </select></Field>
        <Field label="Quantity" hint={r ? `Stock after: ${num(r.quantity_available - qty)} ${r.unit_of_measure}. Stock moves automatically (trigger T4).` : undefined}>
          <input className="input" type="number" min={1} max={r?.quantity_available} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
        </Field>
        {inc.allocations.length > 0 && <p className="flex items-center gap-1 text-[11px] text-muted"><Undo2 className="h-3 w-3" />Allocating an item already given adds to its total.</p>}
        {s.err && <ErrorBox text={s.err} />}
      </div>
    </Modal>
  );
}

function EditModal({ inc, onClose, onDone }: { inc: IncidentDetail; onClose: () => void; onDone: (n: IncidentDetail) => void }) {
  const { data: zones } = useApi<Zone[]>('/zones');
  const { data: types } = useApi<string[]>('/incidents/types');
  const [f, setF] = useState({ title: inc.title, description: inc.description ?? '', incident_type: inc.incident_type, location: inc.location, severity: inc.severity, zone_id: inc.zone_id ? String(inc.zone_id) : '' });
  const s = useSubmit();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal wide title={`Edit incident #${inc.id}`} onClose={onClose} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={s.busy} onClick={() => s.run(async () => {
        const body: Record<string, unknown> = { title: f.title, description: f.description || null, incident_type: f.incident_type, location: f.location, severity: f.severity };
        if (f.zone_id) body.zone_id = Number(f.zone_id);
        const { data } = await api.patch(`/incidents/${inc.id}`, body); onDone(data);
      })}><Busy on={s.busy} />Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title"><input className="input" value={f.title} onChange={set('title')} maxLength={120} /></Field></div>
        <Field label="Type"><select className="input" value={f.incident_type} onChange={set('incident_type')}>{(types ?? [inc.incident_type]).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
        <Field label="Severity"><select className="input" value={f.severity} onChange={set('severity')}>{['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Field>
        <Field label="Location"><input className="input" value={f.location} onChange={set('location')} maxLength={150} /></Field>
        <Field label="Zone"><select className="input" value={f.zone_id} onChange={set('zone_id')}><option value="">Not set</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.zone_name}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea className="input min-h-[100px]" value={f.description} onChange={set('description')} /></Field></div>
      </div>
      {s.err && <div className="mt-3"><ErrorBox text={s.err} /></div>}
    </Modal>
  );
}
