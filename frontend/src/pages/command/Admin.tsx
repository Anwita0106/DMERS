import { useState } from 'react';
import { Database, KeyRound, Plus, Search, Loader2, Moon, Sun } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { useApi, useAuth, useTheme, useToast } from '../../contexts/AppContext';
import { ErrorBox, Field, Modal, PageHeader, Spinner, cx } from '../../components/ui';
import { ROLE_LABEL, dateShort } from '../../lib/format';
import type { Role } from '../../lib/types';

const ROLES: Role[] = ['CITIZEN', 'COORDINATOR', 'UNIT_LEAD', 'ADMINISTRATOR'];
const ROLE_TONE: Record<Role, string> = { CITIZEN: 'bg-raised text-muted', COORDINATOR: 'bg-brand/15 text-brand', UNIT_LEAD: 'bg-info/15 text-info', ADMINISTRATOR: 'bg-sev-high/15 text-sev-high' };
const ROLE_HELP: Record<Role, string> = {
  CITIZEN: 'Reports incidents and follows their own reports.',
  COORDINATOR: 'Verifies reports, dispatches units, allocates relief, closes incidents.',
  UNIT_LEAD: 'Leads one response unit and updates its dispatch progress.',
  ADMINISTRATOR: 'Manages users, units, zones and resource stock.',
};

interface Row { id: number; full_name: string; email: string; account_type: Role; created_at: string; unit_name: string | null; incidents_reported: number; dispatches_authorised: number }

export function UsersPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ full_name: '', email: '', password: '', account_type: 'COORDINATOR' as Role });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { data, error, reload } = useApi<{ items: Row[]; role_counts: Record<string, number> }>(`/users?${new URLSearchParams({ ...(q && { q }), ...(role && { role }) })}`);

  const change = async (u: Row, account_type: Role) => {
    try { await api.patch(`/users/${u.id}`, { account_type }); toast('ok', `${u.full_name} is now ${ROLE_LABEL[account_type]}`); reload(); }
    catch (e) { toast('error', errorMessage(e)); reload(); }
  };
  const create = async () => {
    setBusy(true); setErr('');
    try { await api.post('/users', f); toast('ok', 'Account created'); setCreating(false); setF({ full_name: '', email: '', password: '', account_type: 'COORDINATOR' }); reload(); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Users & Roles" subtitle="Accounts and their account_type" actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New account</button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(role === r ? '' : r)} className={cx('card p-4 text-left transition', role === r ? 'border-brand shadow-glow' : 'hover:border-brand/50')}>
            <div className="font-display text-2xl font-bold">{data?.role_counts[r] ?? 0}</div>
            <div className="text-sm font-semibold">{ROLE_LABEL[r]}s</div>
            <div className="mt-1 text-[11px] text-muted">{ROLE_HELP[r]}</div>
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line p-3"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" /><input className="input pl-9" placeholder="Search name or e-mail..." value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        {error ? <div className="p-4"><ErrorBox text={errorMessage(error)} /></div> : !data ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-line bg-raised/50"><tr>{['Name', 'E-mail', 'Role', 'Activity', 'Since'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>{data.items.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="table-cell"><div className="font-medium">{u.full_name}</div>{u.unit_name && <div className="text-[11px] text-muted">Leads {u.unit_name}</div>}</td>
                  <td className="table-cell text-muted">{u.email}</td>
                  <td className="table-cell">
                    <select value={u.account_type} disabled={u.id === me?.id} onChange={(e) => change(u, e.target.value as Role)}
                      className={cx('rounded-lg border-0 px-2 py-1 text-xs font-semibold', ROLE_TONE[u.account_type])} aria-label={`Role of ${u.full_name}`}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td className="table-cell text-xs text-muted">{u.incidents_reported} reported · {u.dispatches_authorised} dispatches</td>
                  <td className="table-cell text-muted">{dateShort(u.created_at)}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && (
        <Modal title="New account" onClose={() => setCreating(false)} footer={<><button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={create}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create</button></>}>
          <div className="space-y-4">
            <Field label="Full name"><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
            <Field label="E-mail"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Temporary password" hint="At least 8 characters; ask the person to change it in Settings."><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            <Field label="Role"><select className="input" value={f.account_type} onChange={(e) => setF({ ...f, account_type: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            {err && <ErrorBox text={err} />}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const { data: health } = useApi<{ status: string; api: string; migrations: string }>('/health');
  const [cur, setCur] = useState(''); const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await api.post('/auth/password', { current_password: cur, new_password: next }); toast('ok', 'Password changed'); setCur(''); setNext(''); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted">Name</dt><dd className="font-medium">{user?.full_name}</dd></div>
            <div><dt className="text-xs text-muted">E-mail</dt><dd className="font-medium">{user?.email}</dd></div>
            <div><dt className="text-xs text-muted">Role</dt><dd className="font-medium">{user && ROLE_LABEL[user.account_type]}</dd></div>
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><KeyRound className="h-4 w-4 text-brand" />Change password</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Current password"><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters"><input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
          </div>
          {err && <div className="mt-3"><ErrorBox text={err} /></div>}
          <button className="btn-primary mt-4" disabled={busy || !cur || next.length < 8} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Update password</button>
        </section>
        <section className="card flex items-center justify-between p-5">
          <div><h2 className="font-display text-lg font-semibold">Appearance</h2><p className="text-sm text-muted">Currently {theme} mode.</p></div>
          <button className="btn-outline" onClick={toggle}>{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}Switch to {theme === 'dark' ? 'light' : 'dark'}</button>
        </section>
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Database className="h-4 w-4 text-brand" />System</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted">API</dt><dd className="font-medium">{health ? `v${health.api} · ${health.status}` : '...'}</dd></div>
            <div><dt className="text-xs text-muted">Database design</dt><dd className="font-medium">DMERS (PostgreSQL)</dd></div>
            <div><dt className="text-xs text-muted">Migrations applied</dt><dd className="font-medium">{health?.migrations ?? '...'}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
