import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useAuth } from '../../contexts/AppContext';
import AuthForm from '../../components/AuthForm';
import MapView from '../../components/MapView';
import { ErrorBox, Field, SeverityBadge, cx } from '../../components/ui';
import { titleCase } from '../../lib/format';
import type { Incident, Severity, Zone } from '../../lib/types';

const STEPS = ['Basic Information', 'Location', 'Details', 'Submit'];
const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024;

export default function Report() {
  const { user } = useAuth();
  const { data: types } = useApi<string[]>('/incidents/types');
  const { data: zones } = useApi<Zone[]>('/zones');
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ incident_type: '', severity: '' as Severity | '', title: '', location: '', zone_id: '', description: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [fileErr, setFileErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ inc: Incident; photoErr?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const zone = zones?.find((z) => String(z.id) === f.zone_id);
  const valid = [
    !!f.incident_type && !!f.severity && f.title.trim().length >= 3,
    f.location.trim().length >= 3,
    true,
    true,
  ];
  const previews = useMemo(() => files.map((x) => URL.createObjectURL(x)), [files]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFileErr('');
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setFileErr(`${file.name}: only JPG, PNG or WEBP`); continue; }
      if (file.size > MAX_BYTES) { setFileErr(`${file.name}: larger than 10 MB`); continue; }
      if (next.length >= MAX_FILES) { setFileErr(`Up to ${MAX_FILES} photos`); break; }
      next.push(file);
    }
    setFiles(next);
  };

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await api.post<Incident>('/incidents', {
        title: f.title.trim(), incident_type: f.incident_type, severity: f.severity, location: f.location.trim(),
        description: f.description.trim() || null, zone_id: f.zone_id ? Number(f.zone_id) : null,
      });
      let photoErr: string | undefined;
      if (files.length) {
        const fd = new FormData(); files.forEach((x) => fd.append('files', x));
        try { await api.post(`/incidents/${data.id}/attachments`, fd); } catch (x) { photoErr = errorMessage(x, 'Photos could not be uploaded'); }
      }
      setDone({ inc: data, photoErr });
    } catch (x) { setErr(errorMessage(x, 'Could not submit the report')); } finally { setBusy(false); }
  };

  if (done) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-brand"><CheckCircle2 className="h-8 w-8" /></div>
      <h1 className="mt-5 text-3xl font-bold">Report received</h1>
      <p className="mt-2 text-muted">Reference <b className="text-ink">#{done.inc.id}</b>. The control room will verify it and send help. You can follow its status in My reports.</p>
      {done.photoErr && <div className="mt-4 text-left"><ErrorBox text={done.photoErr} /></div>}
      <div className="mt-6 rounded-xl border border-sev-critical/40 bg-sev-critical/10 p-3 text-sm">If anyone's life is in danger, call <b>112</b> now.</div>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/my-reports" className="btn-primary">My reports</Link>
        <button className="btn-outline" onClick={() => { setDone(null); setStep(0); setFiles([]); setF({ incident_type: '', severity: '', title: '', location: '', zone_id: '', description: '' }); }}>Report another</button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Report an Issue</h1>
        <p className="mt-2 text-muted">Help us respond faster. Provide accurate information about the incident.</p>
      </div>

      {/* stepper */}
      <ol className="mx-auto mt-8 grid max-w-2xl grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={cx('absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2', i <= step ? 'bg-brand' : 'bg-line')} />}
            <button disabled={i > step} onClick={() => setStep(i)}
              className={cx('relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-bold transition',
                i < step ? 'border-brand bg-brand text-brand-ink' : i === step ? 'border-brand bg-brand text-brand-ink shadow-glow' : 'border-line bg-surface text-muted')}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </button>
            <span className={cx('mt-2 text-[11px] font-medium sm:text-xs', i === step ? 'text-brand' : 'text-muted')}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="card mt-8 p-5 sm:p-7">
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Incident type *">
              <select className="input" value={f.incident_type} onChange={set('incident_type')}>
                <option value="">Select type</option>{(types ?? []).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </select>
            </Field>
            <Field label="Severity *" hint="How serious does it look? The control room confirms it.">
              <select className="input" value={f.severity} onChange={set('severity')}>
                <option value="">Select severity</option>{['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Title *">
              <input className="input" maxLength={120} placeholder="Brief title of the incident" value={f.title} onChange={set('title')} />
            </Field></div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-5">
              <Field label="Where is it? *" hint="Street, landmark, village or area">
                <input className="input" maxLength={150} placeholder="e.g. Railway underpass, Katpadi" value={f.location} onChange={set('location')} />
              </Field>
              <Field label="Zone (optional)" hint="If you are not sure, leave it; the control room will set it.">
                <select className="input" value={f.zone_id} onChange={set('zone_id')}>
                  <option value="">Not sure</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.zone_name} ({z.district})</option>)}
                </select>
              </Field>
            </div>
            <MapView height={240} fitKey={f.zone_id || 'all'} points={(zones ?? []).filter((z) => z.latitude && (!f.zone_id || String(z.id) === f.zone_id)).map((z) => ({
              key: `z${z.id}`, lat: z.latitude!, lng: z.longitude!, color: String(z.id) === f.zone_id ? '#22c55e' : '#64748b', radiusKm: String(z.id) === f.zone_id ? (z.radius_km ?? 2) : undefined,
              onClick: () => setF((p) => ({ ...p, zone_id: String(z.id) })), popup: <b>{z.zone_name}</b>,
            }))} />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Description">
              <textarea className="input min-h-[200px]" maxLength={4000} placeholder="What happened? How many people are affected? Is anyone injured or trapped?" value={f.description} onChange={set('description')} />
            </Field>
            <div>
              <span className="label">Upload photos (optional)</span>
              <div onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line p-4 text-center text-sm text-muted transition hover:border-brand">
                <UploadCloud className="mb-2 h-8 w-8 text-faint" />
                Click to upload or drag and drop<br /><span className="text-[11px] text-faint">PNG, JPG or WEBP up to 10 MB · max {MAX_FILES}</span>
                <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </div>
              {fileErr && <p className="mt-2 text-xs text-sev-critical">{fileErr}</p>}
              {files.length > 0 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {files.map((file, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
                      <img src={previews[i]} alt={file.name} className="h-full w-full object-cover" />
                      <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove photo"
                        className="absolute inset-0 grid place-items-center bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">Check your report</h3>
              <dl className="divide-y divide-line rounded-xl border border-line">
                {[
                  ['Type', titleCase(f.incident_type)], ['Severity', <SeverityBadge key="s" value={f.severity || 'MODERATE'} />], ['Title', f.title],
                  ['Location', f.location], ['Zone', zone ? `${zone.zone_name}, ${zone.district}` : 'Not sure'],
                  ['Description', f.description || '-'], ['Photos', files.length ? <span key="p" className="flex items-center gap-1"><ImagePlus className="h-3.5 w-3.5" />{files.length}</span> : 'None'],
                ].map(([k, v]) => <div key={String(k)} className="grid grid-cols-[100px_1fr] gap-3 px-3 py-2"><dt className="text-muted">{k}</dt><dd className="break-words">{v}</dd></div>)}
              </dl>
            </div>
            <div>
              {user ? (
                <div className="rounded-xl border border-line bg-raised p-4 text-sm">
                  Reporting as <b>{user.full_name}</b> ({user.email}). The control room may contact you about this report.
                </div>
              ) : (
                <div>
                  <h3 className="mb-1 font-semibold">Sign in to submit</h3>
                  <p className="mb-4 text-xs text-muted">Every report is linked to an account so the control room can follow up. Your answers above are kept.</p>
                  <AuthForm initial="register" onDone={() => { /* stays on this step */ }} />
                </div>
              )}
              {err && <div className="mt-4"><ErrorBox text={err} /></div>}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between gap-3">
          <button className="btn-outline" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft className="h-4 w-4" />Back</button>
          {step < 3 ? (
            <button className="btn-primary px-8" disabled={!valid[step]} onClick={() => setStep(step + 1)}>Next<ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button className="btn-primary px-8" disabled={!user || busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Submit report</button>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted">In immediate danger? Call <b className="text-ink">112</b> first.</p>
    </div>
  );
}
