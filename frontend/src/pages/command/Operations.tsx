import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Undo2, Loader2 } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useAuth, useToast, LIVE_MS } from '../../contexts/AppContext';
import { EmptyState, ErrorBox, Field, Modal, PageHeader, Segmented, SeverityBadge, Spinner, StatusBadge } from '../../components/ui';
import { dateTime, isManager, minutes, num, titleCase } from '../../lib/format';
import type { Allocation, Dispatch, DispatchStatus } from '../../lib/types';

const NEXT: Record<string, { to: DispatchStatus; label: string }[]> = {
  ASSIGNED: [{ to: 'EN_ROUTE', label: 'En route' }, { to: 'ON_SCENE', label: 'On scene' }, { to: 'CANCELLED', label: 'Cancel' }],
  EN_ROUTE: [{ to: 'ON_SCENE', label: 'On scene' }, { to: 'CANCELLED', label: 'Cancel' }],
  ON_SCENE: [{ to: 'COMPLETED', label: 'Complete' }],
};

export function Dispatches() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'active' | 'all'>('active');
  const { data, error, reload } = useApi<Dispatch[]>(`/dispatches${tab === 'active' ? '?active_only=true' : ''}`, [], LIVE_MS);
  const [busy, setBusy] = useState('');

  const move = async (d: Dispatch, to: DispatchStatus) => {
    const k = `${d.incident_id}-${d.unit_id}`; setBusy(k);
    try { await api.patch(`/dispatches/${d.incident_id}/${d.unit_id}`, { dispatch_status: to }); toast('ok', `${d.unit_name}: ${titleCase(to)}`); reload(); }
    catch (e) { toast('error', errorMessage(e)); } finally { setBusy(''); }
  };
  const canMove = (d: Dispatch) => isManager(user?.account_type) || (user?.account_type === 'UNIT_LEAD' && d.lead_user_id === user.id);

  return (
    <div>
      <PageHeader title="Dispatches" subtitle="Units sent to incidents. New dispatches are made from an incident (coordinators only)."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All' }]} />} />
      {error ? <ErrorBox text={errorMessage(error)} onRetry={reload} /> : !data ? <Spinner /> : (
        <div className="card overflow-hidden">
          {data.length === 0 ? <EmptyState title="No dispatches" hint={tab === 'active' ? 'No unit is on an active dispatch right now.' : undefined} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-line bg-raised/50"><tr>{['Unit', 'Incident', 'Status', 'Dispatched', 'Arrived', 'Travel', 'By', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
                <tbody>{data.map((d) => {
                  const k = `${d.incident_id}-${d.unit_id}`;
                  return (
                    <tr key={k} className="border-b border-line last:border-0">
                      <td className="table-cell"><div className="font-medium">{d.unit_name}</div><div className="text-[11px] text-muted">{titleCase(d.unit_type)} · {d.contact_phone}</div></td>
                      <td className="table-cell max-w-[260px]"><Link to={`/command/incidents?open=${d.incident_id}`} className="block truncate font-medium hover:text-brand">#{d.incident_id} {d.incident_title}</Link>
                        <div className="mt-1 flex items-center gap-1.5">{d.incident_severity && <SeverityBadge value={d.incident_severity} />}<span className="text-[11px] text-muted">{d.zone_name}</span></div></td>
                      <td className="table-cell"><StatusBadge value={d.dispatch_status} /></td>
                      <td className="table-cell whitespace-nowrap text-muted">{dateTime(d.dispatched_at)}</td>
                      <td className="table-cell whitespace-nowrap text-muted">{dateTime(d.arrived_at)}</td>
                      <td className="table-cell text-muted">{minutes(d.travel_minutes)}</td>
                      <td className="table-cell text-muted">{d.dispatched_by_name}</td>
                      <td className="table-cell">
                        {canMove(d) && <div className="flex justify-end gap-1">
                          {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : (NEXT[d.dispatch_status] ?? []).map((n) => (
                            <button key={n.to} className={n.to === 'CANCELLED' ? 'btn-ghost btn-sm text-sev-critical' : 'btn-outline btn-sm'} onClick={() => move(d, n.to)}>{n.label}</button>
                          ))}
                        </div>}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
          {user?.account_type === 'UNIT_LEAD' && <p className="border-t border-line px-4 py-3 text-xs text-muted">As a unit lead you can update dispatches of the unit you lead.</p>}
        </div>
      )}
    </div>
  );
}

export function Allocations() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useApi<Allocation[]>('/allocations', [], LIVE_MS);
  const [edit, setEdit] = useState<Allocation | null>(null);
  const [withdraw, setWithdraw] = useState<Allocation | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mgr = isManager(user?.account_type);
  const editable = (a: Allocation) => mgr && (a.incident_status === 'VERIFIED' || a.incident_status === 'RESPONDING');

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true); setErr('');
    try { await fn(); toast('ok', msg); setEdit(null); setWithdraw(null); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Allocations" subtitle="Relief issued to incidents. Changing an allocation moves stock automatically (trigger T4)." />
      {error ? <ErrorBox text={errorMessage(error)} onRetry={reload} /> : !data ? <Spinner /> : (
        <div className="card overflow-hidden">
          {data.length === 0 ? <EmptyState title="No allocations yet" hint="Allocate relief from an incident's detail panel." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-line bg-raised/50"><tr>{['Incident', 'Resource', 'Quantity', 'Stock left', 'Last change', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
                <tbody>{data.map((a) => (
                  <tr key={`${a.incident_id}-${a.resource_id}`} className="border-b border-line last:border-0">
                    <td className="table-cell max-w-[280px]"><Link to={`/command/incidents?open=${a.incident_id}`} className="block truncate font-medium hover:text-brand">#{a.incident_id} {a.incident_title}</Link>
                      <div className="mt-1 flex items-center gap-1.5">{a.incident_status && <StatusBadge value={a.incident_status} />}<span className="text-[11px] text-muted">{a.zone_name}</span></div></td>
                    <td className="table-cell"><div className="font-medium">{a.resource_name}</div><div className="text-[11px] text-muted">{titleCase(a.category)}</div></td>
                    <td className="table-cell font-semibold">{num(a.quantity)} <span className="text-xs font-normal text-muted">{a.unit_of_measure}</span></td>
                    <td className="table-cell"><span className="mr-2">{num(a.stock_left)}</span>{a.stock_status && <StatusBadge value={a.stock_status} kind="stock" />}</td>
                    <td className="table-cell whitespace-nowrap text-muted">{dateTime(a.allocated_at)}</td>
                    <td className="table-cell">{editable(a) && <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => { setQty(a.quantity); setErr(''); setEdit(a); }}><Pencil className="h-3.5 w-3.5" />Adjust</button>
                      <button className="btn-ghost btn-sm text-sev-critical" onClick={() => { setErr(''); setWithdraw(a); }}><Undo2 className="h-3.5 w-3.5" />Withdraw</button>
                    </div>}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-4 py-3 text-xs text-muted">Allocations of closed or resolved incidents are kept as history and cannot be changed.</p>
        </div>
      )}
      {edit && (
        <Modal title={`Adjust ${edit.resource_name}`} onClose={() => setEdit(null)} footer={<>
          <button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
          <button className="btn-primary" disabled={busy || qty < 1} onClick={() => act(() => api.patch(`/allocations/${edit.incident_id}/${edit.resource_id}`, { quantity: qty }), 'Allocation updated')}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></>}>
          <Field label={`Total for incident #${edit.incident_id} (${edit.unit_of_measure})`} hint={`Now ${num(edit.quantity)}. Only the difference is taken from or returned to stock.`}>
            <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
          </Field>
          {err && <div className="mt-3"><ErrorBox text={err} /></div>}
        </Modal>
      )}
      {withdraw && (
        <Modal title="Withdraw allocation?" onClose={() => setWithdraw(null)} footer={<>
          <button className="btn-ghost" onClick={() => setWithdraw(null)}>Cancel</button>
          <button className="btn-danger" disabled={busy} onClick={() => act(() => api.delete(`/allocations/${withdraw.incident_id}/${withdraw.resource_id}`), 'Allocation withdrawn; stock returned')}>Withdraw</button></>}>
          <p className="text-sm text-muted">{num(withdraw.quantity)} {withdraw.unit_of_measure} of {withdraw.resource_name} go back into stock, and the incident timeline records the return.</p>
          {err && <div className="mt-3"><ErrorBox text={err} /></div>}
        </Modal>
      )}
    </div>
  );
}
