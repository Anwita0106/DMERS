import type { Role } from './types';

export const titleCase = (s?: string | null) =>
  (s ?? '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function timeAgo(iso?: string | null): string {
  if (!iso) return '-';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 0) return 'just now';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h} hour${h > 1 ? 's' : ''} ago`; }
  const d = Math.floor(diff / 86400);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return dateShort(iso);
}

export const dateShort = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

export const num = (n?: number | null) => (n ?? 0).toLocaleString('en-IN');

export const minutes = (m?: number | null) => {
  if (m == null) return '-';
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
};

export const ROLE_LABEL: Record<Role, string> = {
  CITIZEN: 'Citizen', COORDINATOR: 'Coordinator', UNIT_LEAD: 'Unit Lead', ADMINISTRATOR: 'Administrator',
};

export const isStaff = (r?: Role) => r === 'COORDINATOR' || r === 'UNIT_LEAD' || r === 'ADMINISTRATOR';
export const isManager = (r?: Role) => r === 'COORDINATOR' || r === 'ADMINISTRATOR';
