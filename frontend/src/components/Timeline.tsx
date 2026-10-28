import { StatusBadge } from './ui';
import { dateTime, ROLE_LABEL } from '../lib/format';
import type { TimelineEntry } from '../lib/types';

/** incident_updates rows (written by the database triggers), oldest first. */
export default function Timeline({ items }: { items: TimelineEntry[] }) {
  return (
    <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
      {items.map((t) => (
        <li key={t.update_no} className="relative">
          <span className="absolute -left-[27px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-brand bg-bg" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {t.previous_status && t.previous_status !== t.new_status ? <><StatusBadge value={t.previous_status} /><span className="text-faint">→</span></> : null}
            <StatusBadge value={t.new_status} />
            <span className="text-xs text-muted">#{t.update_no} · {dateTime(t.logged_at)}</span>
          </div>
          {t.note && <div className="mt-1 text-sm">{t.note}</div>}
          <div className="mt-0.5 text-[11px] text-faint">{t.logged_by_name ? `${t.logged_by_name}${t.logged_by_role ? ` (${ROLE_LABEL[t.logged_by_role]})` : ''}` : 'System'}</div>
        </li>
      ))}
    </ol>
  );
}
