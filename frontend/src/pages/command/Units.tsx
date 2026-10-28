import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ambulance, Flame, HandHeart, LifeBuoy, Pencil, Phone, Plus, Search, Shield, Users, Loader2 } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useAuth, useToast, LIVE_MS } from '../../contexts/AppContext';
import { ErrorBox, Field, Modal, PageHeader, Spinner, StatusBadge, cx } from '../../components/ui';
import { isManager, timeAgo, titleCase } from '../../lib/format';
import type { Unit, Zone } from '../../lib/types';

const TYPES = ['FIRE', 'MEDICAL', 'POLICE', 'RESCUE', 'RELIEF'];
const ICON = { FIRE: Flame, MEDICAL: Ambulance, POLICE: Shield, RESCUE: LifeBuoy, RELIEF: HandHeart } as Record<string, typeof Flame>;

function UnitModal({ unit, onClose, onDone }: { unit?: Unit; onClose: () => void; onDone: () => void }) {
  const { data: zones } = useApi<Zone[]>('/zones');
  const { data: leads } = useApi<{ id: number; full_name: string; unit_id: number | null; unit_name: string | null }[]>('/users/unit-leads');
  const [f, setF] = useState({ unit_name: unit?.unit_name ?? '', unit_type: unit?.unit_type ?? 'FIRE', contact_phone: unit?.contact_phone ?? '', personnel_count: unit?.personnel_count ?? 4, zone_id: unit?.zone_id ? String(unit.zone_id) : '', lead_user_id: unit?.lead_user_id ? String(unit.lead_user_id) : '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const body: Record<string, unknown> = { unit_name: f.unit_name, unit_type: f.unit_type, contact_phone: f.contact_phone, personnel_count: Number(f.personnel_count), zone_id: Number(f.zone_id) };
    try {
      if (unit) {
        if (f.lead_user_id) body.lead_user_id = Number(f.lead_user_id); else if (unit.lead_user_id) body.clear_lead = true;
        await api.patch(`/units/${unit.id}`, body);
      } else {
        if (f.lead_user_id) body.lead_user_id = Number(f.lead_user_id);
        await api.post('/units', body);
      }
      onDone();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal wide title={unit ? `Edit ${unit.unit_name}` : 'New response unit'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.unit_name || !f.zone_id} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit name"><input className="input" maxLength={60} value={f.unit_name} onChange={(e) => setF({ ...f, unit_name: e.target.value })} /></Field>
        <Field label="Type"><select className="input" value={f.unit_type} onChange={(e) => setF({ ...f, unit_type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
        <Field label="Contact phone" hint="10-digit mobile starting 6-9"><input className="input" inputMode="numeric" maxLength={10} value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Personnel"><input className="input" type="number" min={1} value={f.personnel_count} onChange={(e) => setF({ ...f, personnel_count: Math.max(1, Number(e.target.value)) })} /></Field>
        <Field label="Base zone"><select className="input" value={f.zone_id} onChange={(e) => setF({ ...f, zone_id: e.target.value })}><option value="">Select</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.zone_name}</option>)}</select></Field>
        <Field label="Unit lead" hint="UNIT_LEAD accounts; one lead per unit"><select className="input" value={f.lead_user_id} onChange={(e) => setF({ ...f, lead_user_id: e.target.value })}>
          <option value="">No lead</option>
          {(leads ?? []).map((l) => <option key={l.id} value={l.id} disabled={!!l.unit_id && l.unit_id !== unit?.id}>{l.full_name}{l.unit_id && l.unit_id !== unit?.id ? ` (leads ${l.unit_name})` : ''}</option>)}
        </select></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox text={err} /></div>}
    </Modal>
  );
}

export default function Units() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [type, setType] = useState('');
  const [avail, setAvail] = useState('');
  const [modal, setModal] = useState<{ unit?: Unit } | null>(null);
  const { data, error, reload } = useApi<Unit[]>('/units', [], LIVE_MS);
  const admin = user?.account_type === 'ADMINISTRATOR';

  const setAvailability = async (u: Unit, v: 'AVAILABLE' | 'OFF_DUTY') => {
    try { await api.patch(`/units/${u.id}`, { availability_status: v }); toast('ok', `${u.unit_name} is now ${titleCase(v)}`); reload(); }
    catch (e) { toast('error', errorMessage(e)); }
  };

  if (error) return <ErrorBox text={errorMessage(error)} onRetry={reload} />;
  if (!data) return <Spinner />;
  const list = data.filter((u) => (!type || u.unit_type === type) && (!avail || u.availability_status === avail) && (!q || `${u.unit_name} ${u.zone_name} ${u.lead_name ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const counts = (s: string) => data.filter((u) => u.availability_status === s).length;

  return (
    <div>
      <PageHeader title="Response Units" subtitle={`${counts('AVAILABLE')} available · ${counts('DEPLOYED')} deployed · ${counts('OFF_DUTY')} off duty`}
        actions={admin && <button className="btn-primary" onClick={() => setModal({})}><Plus className="h-4 w-4" />New unit</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" /><input className="input pl-9" placeholder="Search units, zones or leads..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
        <select className="input w-auto" value={avail} onChange={(e) => setAvail(e.target.value)} aria-label="Availability"><option value="">Any availability</option>{['AVAILABLE', 'DEPLOYED', 'OFF_DUTY'].map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((u) => {
          const Icon = ICON[u.unit_type] ?? Shield;
          return (
            <div key={u.id} className={cx('card p-5', u.availability_status === 'DEPLOYED' && 'border-sev-high/40')}>
              <div className="flex items-start gap-3">
                <div className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', u.availability_status === 'AVAILABLE' ? 'bg-brand/15 text-brand' : u.availability_status === 'DEPLOYED' ? 'bg-sev-high/15 text-sev-high' : 'bg-raised text-muted')}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><h3 className="font-semibold leading-tight">{u.unit_name}</h3><StatusBadge value={u.availability_status} /></div>
                  <div className="mt-0.5 text-xs text-muted">{titleCase(u.unit_type)} · based in {u.zone_name}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted"><Users className="h-3.5 w-3.5" />{u.personnel_count} personnel</div>
                <a href={`tel:${u.contact_phone}`} className="flex items-center gap-1.5 text-muted hover:text-brand"><Phone className="h-3.5 w-3.5" />{u.contact_phone}</a>
                <div className="col-span-2 text-muted">Lead: <span className="text-ink">{u.lead_name ?? 'not assigned'}</span> · {u.completed_dispatches}/{u.total_dispatches} dispatches completed</div>
              </div>
              {u.current_incident_id && (
                <Link to={`/command/incidents?open=${u.current_incident_id}`} className="mt-3 block rounded-xl bg-raised p-3 text-xs hover:ring-1 hover:ring-brand">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">At #{u.current_incident_id}</span><StatusBadge value={u.current_dispatch_status!} /></div>
                  <div className="mt-1 truncate text-muted">{u.current_incident_title} · since {timeAgo(u.current_dispatched_at)}</div>
                </Link>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {isManager(user?.account_type) && u.availability_status === 'AVAILABLE' && <button className="btn-outline btn-sm" onClick={() => setAvailability(u, 'OFF_DUTY')}>Set off duty</button>}
                {isManager(user?.account_type) && u.availability_status === 'OFF_DUTY' && <button className="btn-outline btn-sm" onClick={() => setAvailability(u, 'AVAILABLE')}>Set available</button>}
                {admin && <button className="btn-ghost btn-sm" onClick={() => setModal({ unit: u })}><Pencil className="h-3.5 w-3.5" />Edit</button>}
              </div>
            </div>
          );
        })}
      </div>
      {modal && <UnitModal unit={modal.unit} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('ok', 'Unit saved'); reload(); }} />}
    </div>
  );
}
