import { Link } from 'react-router-dom';
import { Building2, Database, Mail, MapPin, Phone, Radio, ShieldCheck, Users } from 'lucide-react';
import { HELPLINES } from '../../lib/guides';
import { useApi } from '../../contexts/AppContext';
import type { Zone } from '../../lib/types';
import { PHOTOS, sourcePage } from '../../lib/photos';

export function About() {
  const { data: zones } = useApi<Zone[]>('/zones');
  const districts = [...new Set((zones ?? []).map((z) => z.district))];
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="eyebrow">About DMERS</div>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">One system for reporting, response and relief</h1>
      <p className="mt-4 max-w-3xl text-muted">
        DMERS (Disaster Management & Emergency Response System) connects citizens, the district control room and field teams.
        Citizens report incidents; coordinators verify them and dispatch fire, medical, police, rescue and relief units;
        relief stock is issued and tracked; and every step is written to a permanent timeline.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Users, t: 'Four roles', d: 'Citizens, coordinators, unit leads and administrators, each with clear permissions.' },
          { icon: Radio, t: 'One unit, one incident', d: 'A response unit can only be on one active dispatch at a time, enforced by the database.' },
          { icon: ShieldCheck, t: 'Permanent timeline', d: 'Status changes and relief movements are logged automatically and cannot be edited.' },
          { icon: Building2, t: 'Shelters & safe zones', d: 'Live capacity of shelters, relief camps and open safe zones.' },
          { icon: MapPin, t: `${zones?.length ?? 12} zones`, d: `Covering ${districts.length ? districts.join(', ') : 'Vellore, Ranipet and Tirupattur'} districts.` },
          { icon: Database, t: 'Built on PostgreSQL', d: 'Business rules live in constraints, triggers and stored procedures (DMERS database design).' },
        ].map((c) => (
          <div key={c.t} className="card p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand"><c.icon className="h-5 w-5" /></div>
            <div className="mt-3 font-display text-lg font-semibold">{c.t}</div>
            <p className="mt-1 text-sm text-muted">{c.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3"><Link to="/report" className="btn-primary">Report an incident</Link><Link to="/shelters" className="btn-outline">Find a shelter</Link></div>
      <div className="mt-12 border-t border-line pt-6 text-xs text-muted">
        <div className="mb-2 font-semibold text-ink">Photo credits</div>
        <p>All photographs are U.S. Government works in the public domain, via Wikimedia Commons. Map data © OpenStreetMap contributors.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {Object.values(PHOTOS).map((p) => <li key={p.key}><a className="hover:text-brand" href={sourcePage(p.key)} target="_blank" rel="noreferrer">{p.caption}</a> · {p.credit}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function Contact() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="eyebrow">Contact</div>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Get help fast</h1>
      <p className="mt-3 max-w-2xl text-muted">In an emergency, call first. Use the online report for situations that are not life-threatening or to add photos and details.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HELPLINES.map((h) => (
          <a key={h.label} href={`tel:${h.number.split(' ')[0]}`} className="card flex items-center gap-4 p-5 transition hover:border-brand">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-brand"><Phone className="h-5 w-5" /></div>
            <div><div className="font-display text-2xl font-bold">{h.number}</div><div className="text-sm text-muted">{h.label}</div></div>
          </a>
        ))}
      </div>
      <div className="card mt-8 grid gap-6 p-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">District control room</h2>
          <p className="mt-2 text-sm text-muted">The DMERS control room is staffed by coordinators who verify reports and dispatch units around the clock.</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" />Vellore District Emergency Operations Centre</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand" />control.room@dmers.example.org</div>
          </div>
        </div>
        <div className="rounded-xl bg-raised p-5">
          <div className="font-semibold">Report online</div>
          <p className="mt-1 text-sm text-muted">Create a citizen account, then send a report with the location and photos. You can follow every update in My reports.</p>
          <Link to="/report" className="btn-primary mt-4">Report an incident</Link>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="font-display text-6xl font-extrabold text-brand">404</div>
      <p className="mt-3 text-muted">This page does not exist.</p>
      <Link to="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}
