import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, PackagePlus, Pencil, Plus, Search, TriangleAlert, PackageX, Loader2 } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useAuth, useToast, LIVE_MS } from '../../contexts/AppContext';
import { ErrorBox, Field, Modal, PageHeader, Spinner, StatCard, StatusBadge } from '../../components/ui';
import { num, titleCase } from '../../lib/format';
import type { Resource } from '../../lib/types';

const CATS = ['FOOD', 'WATER', 'MEDICAL', 'SHELTER', 'EQUIPMENT'];

function ResourceModal({ item, mode, onClose, onDone }: { item?: Resource; mode: 'new' | 'edit' | 'restock'; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ resource_name: item?.resource_name ?? '', category: item?.category ?? 'FOOD', unit_of_measure: item?.unit_of_measure ?? '', quantity_available: item?.quantity_available ?? 0, reorder_level: item?.reorder_level ?? 0 });
  const [add, setAdd] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (mode === 'new') await api.post('/resources', f);
      else if (mode === 'restock') await api.patch(`/resources/${item!.id}`, { restock: add });
      else await api.patch(`/resources/${item!.id}`, { resource_name: f.resource_name, category: f.category, unit_of_measure: f.unit_of_measure, reorder_level: f.reorder_level, quantity_available: f.quantity_available });
      onDone();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  const title = mode === 'new' ? 'New resource' : mode === 'restock' ? `Restock ${item!.resource_name}` : `Edit ${item!.resource_name}`;
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></>}>
      {mode === 'restock' ? (
        <Field label={`Quantity to add (${item!.unit_of_measure})`} hint={`New stock: ${num(item!.quantity_available + add)}`}>
          <input className="input" type="number" min={1} value={add} onChange={(e) => setAdd(Math.max(1, Number(e.target.value)))} />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Name"><input className="input" maxLength={60} value={f.resource_name} onChange={(e) => setF({ ...f, resource_name: e.target.value })} /></Field></div>
          <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
          <Field label="Unit of measure"><input className="input" maxLength={20} placeholder="kits, bags, litres..." value={f.unit_of_measure} onChange={(e) => setF({ ...f, unit_of_measure: e.target.value })} /></Field>
          <Field label="Quantity in stock"><input className="input" type="number" min={0} value={f.quantity_available} onChange={(e) => setF({ ...f, quantity_available: Math.max(0, Number(e.target.value)) })} /></Field>
          <Field label="Reorder level" hint="LOW when stock falls to this level"><input className="input" type="number" min={0} value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: Math.max(0, Number(e.target.value)) })} /></Field>
        </div>
      )}
      {err && <div className="mt-3"><ErrorBox text={err} /></div>}
    </Modal>
  );
}

export default function Resources() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState('');
  const [stock, setStock] = useState('');
  const [modal, setModal] = useState<{ mode: 'new' | 'edit' | 'restock'; item?: Resource } | null>(null);
  const { data, error, reload } = useApi<Resource[]>('/resources', [], LIVE_MS);
  const admin = user?.account_type === 'ADMINISTRATOR';

  if (error) return <ErrorBox text={errorMessage(error)} onRetry={reload} />;
  if (!data) return <Spinner />;
  const list = data.filter((r) => (!cat || r.category === cat) && (!stock || r.stock_status === stock) && (!q || r.resource_name.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="Resources" subtitle="Relief stock. Allocations take stock automatically; status follows fn_stock_status."
        actions={admin && <button className="btn-primary" onClick={() => setModal({ mode: 'new' })}><Plus className="h-4 w-4" />New resource</button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Boxes className="h-6 w-6" />} value={data.length} label="Resource items" />
        <StatCard tone="moderate" icon={<TriangleAlert className="h-6 w-6" />} value={data.filter((r) => r.stock_status === 'LOW').length} label="At or below reorder level" />
        <StatCard tone="critical" icon={<PackageX className="h-6 w-6" />} value={data.filter((r) => r.stock_status === 'OUT_OF_STOCK').length} label="Out of stock" />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" /><input className="input pl-9" placeholder="Search resources..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select>
          <select className="input w-auto" value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stock"><option value="">Any stock level</option><option value="ADEQUATE">Adequate</option><option value="LOW">Low</option><option value="OUT_OF_STOCK">Out of stock</option></select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-line bg-raised/50"><tr>{['Resource', 'Category', 'In stock', 'Reorder at', 'Allocated (all time)', 'Status', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((r) => {
                const max = Math.max(r.quantity_available, r.reorder_level * 3, 1);
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="table-cell font-medium">{r.resource_name}</td>
                    <td className="table-cell">{titleCase(r.category)}</td>
                    <td className="table-cell">
                      <div className="font-semibold">{num(r.quantity_available)} <span className="text-xs font-normal text-muted">{r.unit_of_measure}</span></div>
                      <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.quantity_available / max) * 100)}%`, background: r.stock_status === 'ADEQUATE' ? '#22c55e' : r.stock_status === 'LOW' ? '#eab308' : '#ef4444' }} /></div>
                    </td>
                    <td className="table-cell text-muted">{num(r.reorder_level)}</td>
                    <td className="table-cell text-muted">{num(r.quantity_allocated)} · {r.incidents_supplied} incident(s)</td>
                    <td className="table-cell"><StatusBadge value={r.stock_status} kind="stock" /></td>
                    <td className="table-cell text-right">
                      {admin && <div className="flex justify-end gap-1">
                        <button className="btn-outline btn-sm" onClick={() => setModal({ mode: 'restock', item: r })}><PackagePlus className="h-3.5 w-3.5" />Restock</button>
                        <button className="btn-ghost btn-sm" onClick={() => setModal({ mode: 'edit', item: r })} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      </div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!admin && <p className="border-t border-line px-4 py-3 text-xs text-muted">Only administrators can add or restock resources (FR-09).</p>}
      </div>
      {modal && <ResourceModal {...modal} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('ok', 'Resource saved'); reload(); }} />}
    </div>
  );
}
