import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AppContext';
import { errorMessage } from '../lib/api';
import { ErrorBox, Segmented } from './ui';
import type { User } from '../lib/types';

export default function AuthForm({ onDone, initial = 'login' }: { onDone: (u: User) => void; initial?: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initial);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onDone(mode === 'login' ? await login(email, password) : await register(name, email, password)); }
    catch (x) { setErr(errorMessage(x, mode === 'login' ? 'Sign-in failed' : 'Could not create the account')); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Segmented value={mode} onChange={setMode} options={[{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Create account' }]} />
      {mode === 'register' && (
        <label className="block"><span className="label">Full name</span>
          <input className="input" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      )}
      <label className="block"><span className="label">E-mail</span>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
      <label className="block"><span className="label">Password</span>
        <input className="input" type="password" required minLength={mode === 'register' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'At least 8 characters' : ''} /></label>
      {err && <ErrorBox text={err} />}
      <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === 'login' ? 'Sign in' : 'Create citizen account'}</button>
      {mode === 'register' && <p className="text-[11px] text-faint">New accounts are citizen accounts. Staff accounts are created by an administrator.</p>}
    </form>
  );
}
