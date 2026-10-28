import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import AuthForm from '../../components/AuthForm';
import { useAuth } from '../../contexts/AppContext';
import { isStaff, ROLE_LABEL } from '../../lib/format';
import type { Role } from '../../lib/types';

// Accounts created by database/original/03_seed_data.sql (password Dmers@2026)
const DEMO: { email: string; role: Role; name: string }[] = [
  { email: 'meena.krishnan@dmers.example.org', role: 'ADMINISTRATOR', name: 'Meena Krishnan' },
  { email: 'priya.natarajan@dmers.example.org', role: 'COORDINATOR', name: 'Priya Natarajan' },
  { email: 'arun.prakash@dmers.example.org', role: 'UNIT_LEAD', name: 'Arun Prakash' },
  { email: 'anitha.selvam@mail.example.com', role: 'CITIZEN', name: 'Anitha Selvam' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState('');
  const next = params.get('next');
  const after = (role: Role) => nav(next && (isStaff(role) || !next.startsWith('/command')) ? next : isStaff(role) ? '/command' : '/my-reports', { replace: true });

  if (user && !busy) return <Navigate to={isStaff(user.account_type) ? (next ?? '/command') : '/my-reports'} replace />;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
      <div>
        <div className="eyebrow">Secure access</div>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Sign in to DMERS</h1>
        <p className="mt-3 text-muted">Citizens sign in to report incidents and follow them. Coordinators, unit leads and administrators sign in to the Command Center.</p>
        <ul className="mt-6 space-y-3 text-sm">
          {['Report incidents with photos and follow every status change', 'Coordinators verify reports, dispatch units and allocate relief', 'Unit leads update their team\'s progress from the field'].map((t) => (
            <li key={t} className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-brand" />{t}</li>
          ))}
        </ul>
        <details className="card mt-8 p-4 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-brand" />Demo accounts</summary>
          <p className="mt-2 text-xs text-muted">Seeded by 03_seed_data.sql. Password for all: <code className="font-mono text-ink">Dmers@2026</code></p>
          <div className="mt-3 grid gap-2">
            {DEMO.map((d) => (
              <button key={d.email} disabled={!!busy} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-left hover:border-brand"
                onClick={async () => { setBusy(d.email); try { const u = await login(d.email, 'Dmers@2026'); after(u.account_type); } catch { setBusy(''); } }}>
                <span><span className="font-medium">{d.name}</span><span className="block text-[11px] text-muted">{d.email}</span></span>
                <span className="chip bg-brand/15 text-brand">{busy === d.email ? 'Signing in...' : ROLE_LABEL[d.role]}</span>
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className="card p-6 sm:p-8">
        <AuthForm initial={params.get('mode') === 'register' ? 'register' : 'login'} onDone={(u) => { setBusy('x'); after(u.account_type); }} />
      </div>
    </div>
  );
}
