import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Loader2 } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useAuth, useToast, LIVE_MS } from '../../contexts/AppContext';
import MapView, { type MapPoint } from '../../components/MapView';
import { ErrorBox, Field, Modal, PageHeader, RiskBadge, SEV_HEX, Segmented, Spinner, StatusBadge, cx } from '../../components/ui';
import { isManager, num, titleCase } from '../../lib/format';
import type { Shelter, Zone } from '../../lib/types';

function ZoneModal({ zone, onClose, onDone }: { zone?: Zone; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ zone_name: zone?.zone_name ?? '', district: zone?.district ?? '', state: zone?.state ?? 'Tamil Nadu', risk_level: zone?.risk_level ?? 'MEDIUM',
    latitude: zone?.latitude ?? '', longitude: zone?.longitude ?? '', radius_km: zone?.radius_km ?? 3 });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const body: Record<string, unknown> = { zone_name: f.zone_name, district: f.district, state: f.state, risk_level: f.risk_level, radius_km: Number(f.radius_km) || undefined };
    if (f.latitude !== '' && f.longitude !== '') { body.latitude = Number(f.latitude); body.longitude = Number(f.longitude); }
    try { if (zone) await api.patch(`/zones/${zone.id}`, body); else await api.post('/zones', body); onDone(); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal wide title={zone ? `Edit ${zone.zone_name}` : 'New zone'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.zone_name || !f.district} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zone name"><input className="input" maxLength={60} value={f.zone_name} onChange={(e) => setF({ ...f, zone_name: e.target.value })} /></Field>
        <Field label="Risk level"><select className="input" value={f.risk_level} onChange={(e) => setF({ ...f, risk_level: e.target.value as Zone['risk_level'] })}>{['LOW', 'MEDIUM', 'HIGH'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></Field>
        <Field label="District"><input className="input" maxLength={60} value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} /></Field>
        <Field label="State"><input className="input" maxLength={60} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></Field>
        <Field label="Latitude" hint="Map position (stored in app_zone_geo)"><input className="input" type="number" step="0.000001" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} /></Field>
        <Field label="Longitude"><input className="input" type="number" step="0.000001" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} /></Field>
        <Field label="Radius (km)"><input className="input" type="number" min={0.1} step="0.1" value={f.radius_km} onChange={(e) => setF({ ...f, radius_km: Number(e.target.value) })} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox text={err} /></div>}
    </Modal>
  );
}

function ShelterModal({ shelter, zones, onClose, onDone }: { shelter?: Shelter; zones: Zone[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    shelter_name: shelter?.shelter_name ?? '', shelter_type: shelter?.shelter_type ?? 'SHELTER', facility_type: shelter?.facility_type ?? 'COMMUNITY',
    zone_id: shelter?.zone_id ? String(shelter.zone_id) : '', address: shelter?.address ?? '', capacity: shelter?.capacity ?? 100, current_occupancy: shelter?.current_occupancy ?? 0,
    status: shelter?.status ?? 'OPEN', open_24x7: shelter?.open_24x7 ?? true, contact_phone: shelter?.contact_phone ?? '', amenities: shelter?.amenities ?? '',
    latitude: shelter?.latitude ?? '', longitude: shelter?.longitude ?? '',
  });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const pickZone = (id: string) => {
    const z = zones.find((x) => String(x.id) === id);
    setF((p) => ({ ...p, zone_id: id, latitude: p.latitude === '' && z?.latitude ? z.latitude : p.latitude, longitude: p.longitude === '' && z?.longitude ? z.longitude : p.longitude }));
  };
  const save = async () => {
    setBusy(true); setErr('');
    const body = { ...f, zone_id: Number(f.zone_id), capacity: Number(f.capacity), current_occupancy: Number(f.current_occupancy), latitude: Number(f.latitude), longitude: Number(f.longitude), contact_phone: f.contact_phone || null, amenities: f.amenities || null };
    try { if (shelter) await api.patch(`/shelters/${shelter.id}`, body); else await api.post('/shelters', body); onDone(); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal wide title={shelter ? `Edit ${shelter.shelter_name}` : 'New shelter'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.shelter_name || !f.zone_id || f.latitude === ''} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className="input" maxLength={80} value={f.shelter_name} onChange={(e) => setF({ ...f, shelter_name: e.target.value })} /></Field>
        <Field label="Zone"><select className="input" value={f.zone_id} onChange={(e) => pickZone(e.target.value)}><option value="">Select</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.zone_name}</option>)}</select></Field>
        <Field label="Kind"><select className="input" value={f.shelter_type} onChange={(e) => setF({ ...f, shelter_type: e.target.value as Shelter['shelter_type'] })}>{['SHELTER', 'SAFE_ZONE', 'RELIEF_CAMP'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Field>
        <Field label="Facility"><select className="input" value={f.facility_type} onChange={(e) => setF({ ...f, facility_type: e.target.value })}>{['SCHOOL', 'COLLEGE', 'COMMUNITY', 'GOVERNMENT', 'RELIGIOUS', 'OPEN_GROUND'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="Address"><input className="input" maxLength={150} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field></div>
        <Field label="Capacity"><input className="input" type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></Field>
        <Field label="People now"><input className="input" type="number" min={0} value={f.current_occupancy} onChange={(e) => setF({ ...f, current_occupancy: Number(e.target.value) })} /></Field>
        <Field label="Status" hint="OPEN / FULL is set from occupancy unless CLOSED"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Shelter['status'] })}>{['OPEN', 'FULL', 'CLOSED'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Field>
        <Field label="Contact phone"><input className="input" inputMode="numeric" maxLength={10} value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Latitude"><input className="input" type="number" step="0.000001" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} /></Field>
        <Field label="Longitude"><input className="input" type="number" step="0.000001" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Amenities"><input className="input" maxLength={200} value={f.amenities} onChange={(e) => setF({ ...f, amenities: e.target.value })} /></Field></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.open_24x7} onChange={(e) => setF({ ...f, open_24x7: e.target.checked })} className="accent-[rgb(var(--brand))]" />Open 24/7</label>
      </div>
      {err && <div className="mt-3"><ErrorBox text={err} /></div>}
    </Modal>
  );
}

export default function Zones() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'zones' | 'shelters'>('zones');
  const [sel, setSel] = useState<number | null>(params.get('zone') ? Number(params.get('zone')) : null);
  const [zoneModal, setZoneModal] = useState<{ zone?: Zone } | null>(null);
  const [shelterModal, setShelterModal] = useState<{ shelter?: Shelter } | null>(null);
  const { data: zones, error, reload } = useApi<Zone[]>('/zones', [], LIVE_MS);
  const { data: shelters, reload: reloadS } = useApi<Shelter[]>('/shelters', [], LIVE_MS);
  const admin = user?.account_type === 'ADMINISTRATOR';
  const mgr = isManager(user?.account_type);

  if (error) return <ErrorBox text={errorMessage(error)} onRetry={reload} />;
  if (!zones || !shelters) return <Spinner />;
  const focus = zones.find((z) => z.id === sel);

  const points: MapPoint[] = [
    ...zones.filter((z) => z.latitude).map((z) => ({ key: `z${z.id}`, lat: z.latitude!, lng: z.longitude!, radiusKm: z.radius_km ?? 2, color: SEV_HEX[z.risk_level], pulse: z.active_incidents > 0, onClick: () => setSel(z.id),
      popup: <div><b>{z.zone_name}</b><br />{titleCase(z.risk_level)} risk · {z.active_incidents} active · {z.units_available}/{z.units_total} units free</div> })),
    ...shelters.map((s) => ({ key: `s${s.id}`, lat: s.latitude, lng: s.longitude, shape: 'home' as const, color: s.status === 'OPEN' ? '#3b82f6' : s.status === 'FULL' ? '#f97316' : '#6b7280',
      popup: <div><b>{s.shelter_name}</b><br />{s.current_occupancy}/{s.capacity} · {titleCase(s.status)}</div> })),
  ];

  return (
    <div>
      <PageHeader title="Zones & Shelters" subtitle="Zone situation (fn_active_incidents) and shelter capacity"
        actions={<>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'zones', label: `Zones (${zones.length})` }, { value: 'shelters', label: `Shelters (${shelters.length})` }]} />
          {tab === 'zones' && admin && <button className="btn-primary" onClick={() => setZoneModal({})}><Plus className="h-4 w-4" />New zone</button>}
          {tab === 'shelters' && mgr && <button className="btn-primary" onClick={() => setShelterModal({})}><Plus className="h-4 w-4" />New shelter</button>}
        </>} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="xl:sticky xl:top-20 xl:self-start">
          <MapView points={points} height={520} flyTo={focus?.latitude ? [focus.latitude, focus.longitude!] : null} fitKey="zones" />
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'zones' ? (
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-line bg-raised/50"><tr>{['Zone', 'Risk', 'Active', 'Units free', 'Shelters', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
                <tbody>{zones.map((z) => (
                  <tr key={z.id} onClick={() => setSel(z.id)} className={cx('cursor-pointer border-b border-line last:border-0 hover:bg-raised/50', sel === z.id && 'bg-brand/10')}>
                    <td className="table-cell"><div className="font-medium">{z.zone_name}</div><div className="text-[11px] text-muted">{z.district}, {z.state}{!z.latitude && ' · no map position'}</div></td>
                    <td className="table-cell"><RiskBadge value={z.risk_level} /></td>
                    <td className="table-cell"><span className={cx('font-display text-lg font-bold', z.active_incidents ? 'text-sev-high' : 'text-muted')}>{z.active_incidents}</span><span className="text-[11px] text-faint"> / {z.incidents_total}</span></td>
                    <td className="table-cell">{z.units_available} / {z.units_total}</td>
                    <td className="table-cell">{z.shelters_open} open</td>
                    <td className="table-cell text-right">{admin && <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setZoneModal({ zone: z }); }} aria-label="Edit zone"><Pencil className="h-3.5 w-3.5" /></button>}</td>
                  </tr>))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-line bg-raised/50"><tr>{['Shelter', 'Zone', 'Occupancy', 'Status', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
                <tbody>{shelters.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="table-cell"><div className="font-medium">{s.shelter_name}</div><div className="text-[11px] text-muted">{titleCase(s.shelter_type)} · {titleCase(s.facility_type)} · {s.open_24x7 ? '24/7' : 'Day-time'}</div></td>
                    <td className="table-cell">{s.zone_name}</td>
                    <td className="table-cell"><div className="text-sm">{num(s.current_occupancy)} / {num(s.capacity)}</div>
                      <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (s.current_occupancy / s.capacity) * 100)}%` }} /></div></td>
                    <td className="table-cell"><StatusBadge value={s.status} /></td>
                    <td className="table-cell text-right">{mgr && <button className="btn-ghost btn-sm" onClick={() => setShelterModal({ shelter: s })} aria-label="Edit shelter"><Pencil className="h-3.5 w-3.5" /></button>}</td>
                  </tr>))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {zoneModal && <ZoneModal zone={zoneModal.zone} onClose={() => setZoneModal(null)} onDone={() => { setZoneModal(null); toast('ok', 'Zone saved'); reload(); }} />}
      {shelterModal && <ShelterModal shelter={shelterModal.shelter} zones={zones} onClose={() => setShelterModal(null)} onDone={() => { setShelterModal(null); toast('ok', 'Shelter saved'); reloadS(); reload(); }} />}
    </div>
  );
}
