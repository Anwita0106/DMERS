import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Clock, Flame, ShieldAlert } from 'lucide-react';
import { useApi } from '../../contexts/AppContext';
import { EmptyState, ErrorBox, PageHeader, SEV_HEX, Spinner, StatCard } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { minutes, num, titleCase } from '../../lib/format';

type LV = { label: string; value: number };
interface Data {
  days: number; range_start: string | null;
  totals: { total: number; active: number; critical: number; resolved: number; avg_response_minutes: number | null };
  daily: { day: string; reported: number; resolved: number }[];
  by_type: LV[]; by_severity: LV[]; by_status: LV[];
  by_zone: (LV & { risk_level: string; active: number })[];
  response_by_type: (LV & { incidents: number })[];
  resources: { label: string; available: number; allocated: number }[];
  units: { label: string; units: number; available: number; deployed: number; dispatches: number; avg_travel_minutes: number | null }[];
}

const PALETTE = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#ec4899', '#64748b'];
const axis = { stroke: 'rgb(var(--faint))', fontSize: 11, tickLine: false, axisLine: false };
const tip = { contentStyle: { background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 12, color: 'rgb(var(--ink))' }, cursor: { fill: 'rgb(var(--raised))' } };

function Panel({ title, sub, children, className = '' }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="font-display text-base font-semibold">{title}{sub && <span className="ml-2 text-xs font-normal text-faint">{sub}</span>}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, error, reload } = useApi<Data>(`/analytics?days=${days}`, [], 15000);
  const range = days ? `Last ${days} days` : 'All time';

  return (
    <div>
      <PageHeader title="Analytics & Reports" subtitle="Insights and data to support better decision-making"
        actions={<select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option><option value={0}>All time</option>
        </select>} />
      {error ? <ErrorBox text={errorMessage(error)} onRetry={reload} /> : !data ? <Spinner /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<ShieldAlert className="h-6 w-6" />} value={num(data.totals.total)} label={`Incidents · ${range}`} />
            <StatCard tone="high" icon={<Flame className="h-6 w-6" />} value={num(data.totals.active)} label="Still active (verified / responding)" />
            <StatCard tone="critical" icon={<ShieldAlert className="h-6 w-6" />} value={num(data.totals.critical)} label="Critical severity" />
            <StatCard tone="info" icon={<Clock className="h-6 w-6" />} value={minutes(data.totals.avg_response_minutes)} label="Average report-to-arrival (fn_response_minutes)" />
          </div>
          {data.totals.total === 0 && (
            <div className="card"><EmptyState title={`No incidents in ${range.toLowerCase()}`} hint="Choose a longer period, for example All time." /></div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel title="Incident trends" sub={range}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.daily} margin={{ left: -20, right: 8 }}>
                  <defs>
                    <linearGradient id="gRep" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#22c55e" stopOpacity={0.45} /><stop offset="1" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gRes" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="1" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                  <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} minTickGap={24} />
                  <YAxis {...axis} allowDecimals={false} />
                  <Tooltip {...tip} labelFormatter={(d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotoneX" dataKey="reported" name="Reported" stroke="#22c55e" strokeWidth={2} fill="url(#gRep)" />
                  <Area type="monotoneX" dataKey="resolved" name="Resolved / closed" stroke="#3b82f6" strokeWidth={2} fill="url(#gRes)" />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Incidents by type" sub={range}>
              {data.by_type.length === 0 ? <EmptyState title="No data" /> : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative h-[200px] w-[200px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={data.by_type} dataKey="value" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                        {data.by_type.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie>
                        <Tooltip {...tip} formatter={(v: number, n: string) => [v, titleCase(n)]} /></PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="font-display text-2xl font-bold">{data.totals.total}</div><div className="text-[11px] text-muted">Total</div></div></div>
                  </div>
                  <ul className="w-full space-y-1.5 text-sm">
                    {data.by_type.map((t, i) => (
                      <li key={t.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="flex-1 truncate">{titleCase(t.label)}</span><span className="text-muted">{Math.round((t.value / Math.max(1, data.totals.total)) * 100)}%</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Zone-wise incidents" sub={range}>
              <ResponsiveContainer width="100%" height={Math.max(220, data.by_zone.length * 26)}>
                <BarChart data={data.by_zone} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid stroke="rgb(var(--line))" horizontal={false} />
                  <XAxis type="number" {...axis} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" {...axis} width={100} />
                  <Tooltip {...tip} />
                  <Bar dataKey="value" name="Incidents" radius={[0, 6, 6, 0]} barSize={12}>
                    {data.by_zone.map((z) => <Cell key={z.label} fill={SEV_HEX[z.risk_level]} />)}
                  </Bar>
                  <Bar dataKey="active" name="Active now" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={6} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-[11px] text-faint">Bar colour shows the zone's risk level.</p>
            </Panel>
            <Panel title="Resource utilization" sub={`stock now vs allocated · ${range}`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.resources} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                  <XAxis dataKey="label" {...axis} tickFormatter={titleCase} />
                  <YAxis {...axis} />
                  <Tooltip {...tip} labelFormatter={titleCase} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="available" name="In stock" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="allocated" name="Allocated" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title="By severity">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.by_severity} margin={{ left: -20 }}>
                  <XAxis dataKey="label" {...axis} tickFormatter={titleCase} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} labelFormatter={titleCase} />
                  <Bar dataKey="value" name="Incidents" radius={[6, 6, 0, 0]}>{data.by_severity.map((s) => <Cell key={s.label} fill={SEV_HEX[s.label]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="By status">
              <ul className="space-y-2.5">
                {data.by_status.map((s) => (
                  <li key={s.label}><div className="mb-1 flex justify-between text-xs"><span>{titleCase(s.label)}</span><span className="text-muted">{s.value}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-brand" style={{ width: `${(s.value / Math.max(1, data.totals.total)) * 100}%` }} /></div></li>
                ))}
              </ul>
            </Panel>
            <Panel title="Average response by type" sub="minutes">
              {data.response_by_type.length === 0 ? <EmptyState title="No arrivals recorded" /> : (
                <ul className="space-y-2.5">{data.response_by_type.map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{titleCase(r.label)}</span>
                    <span className="flex items-center gap-2"><span className="text-[11px] text-faint">{r.incidents} inc.</span><b>{minutes(r.value)}</b></span></li>
                ))}</ul>
              )}
            </Panel>
          </div>

          <Panel title="Response units" sub={`dispatches in ${range.toLowerCase()}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-line"><tr>{['Type', 'Units', 'Available', 'Deployed', 'Dispatches', 'Avg travel'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
                <tbody>{data.units.map((u) => (
                  <tr key={u.label} className="border-b border-line last:border-0">
                    <td className="table-cell font-medium">{titleCase(u.label)}</td><td className="table-cell">{u.units}</td>
                    <td className="table-cell text-brand">{u.available}</td><td className="table-cell text-sev-high">{u.deployed}</td>
                    <td className="table-cell">{u.dispatches}</td><td className="table-cell">{minutes(u.avg_travel_minutes)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Panel>
          <p className="flex items-center gap-1.5 text-xs text-faint"><CheckCircle2 className="h-3.5 w-3.5" />Figures are computed live from the database{data.range_start ? ` from ${data.range_start}` : ''}.</p>
        </div>
      )}
    </div>
  );
}
