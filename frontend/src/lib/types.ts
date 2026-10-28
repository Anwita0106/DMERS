// Shapes returned by the DMERS API (columns of the DMERS schema plus derived fields).
export type Role = 'CITIZEN' | 'COORDINATOR' | 'UNIT_LEAD' | 'ADMINISTRATOR';
export type Severity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'REPORTED' | 'VERIFIED' | 'RESPONDING' | 'RESOLVED' | 'CLOSED' | 'REJECTED';
export type DispatchStatus = 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE' | 'COMPLETED' | 'CANCELLED';
export type Availability = 'AVAILABLE' | 'DEPLOYED' | 'OFF_DUTY';
export type StockStatus = 'ADEQUATE' | 'LOW' | 'OUT_OF_STOCK';

export interface User { id: number; full_name: string; email: string; account_type: Role; created_at: string }

export interface Incident {
  id: number; title: string; description: string | null; incident_type: string; severity: Severity;
  status: IncidentStatus; location: string; zone_id: number | null; zone_name: string | null; district: string | null;
  zone_risk: string | null; reported_by: number; reporter_name?: string; created_at: string; updated_at: string;
  latitude: number | null; longitude: number | null; response_minutes: number | null; active_units: number;
  relief_items: number; photo_count: number;
}
export interface TimelineEntry {
  update_no: number; previous_status: IncidentStatus | null; new_status: IncidentStatus; note: string | null;
  logged_at: string; logged_by: number | null; logged_by_name: string | null; logged_by_role: Role | null;
}
export interface IncidentDetail extends Incident {
  timeline: TimelineEntry[]; dispatches: Dispatch[]; allocations: Allocation[];
  attachments: { id: number; file_name: string; content_type: string; size_bytes: number; uploaded_at: string }[];
  actions: Record<'can_edit' | 'can_verify' | 'can_reject' | 'can_resolve' | 'can_close' | 'can_dispatch' | 'can_allocate' | 'can_delete', boolean>;
}
export interface Paged<T> { items: T[]; total: number; page: number; page_size: number }

export interface Unit {
  id: number; unit_name: string; unit_type: string; contact_phone: string; personnel_count: number;
  availability_status: Availability; zone_id: number; zone_name: string; lead_user_id: number | null; lead_name: string | null;
  current_incident_id: number | null; current_incident_title: string | null; current_dispatch_status: DispatchStatus | null;
  current_dispatched_at: string | null; total_dispatches: number; completed_dispatches: number;
}
export interface Dispatch {
  incident_id: number; incident_title?: string; incident_severity?: Severity; incident_status?: IncidentStatus;
  zone_name?: string | null; unit_id: number; unit_name: string; unit_type: string; contact_phone: string;
  dispatch_status: DispatchStatus; dispatched_by: number; dispatched_by_name: string; dispatched_at: string;
  arrived_at: string | null; cleared_at: string | null; travel_minutes?: number | null; lead_user_id?: number | null;
}
export interface Resource {
  id: number; resource_name: string; category: string; unit_of_measure: string; quantity_available: number;
  reorder_level: number; stock_status: StockStatus; quantity_allocated: number; incidents_supplied: number;
}
export interface Allocation {
  incident_id: number; incident_title?: string; incident_status?: IncidentStatus; zone_name?: string | null;
  resource_id: number; resource_name: string; category: string; unit_of_measure: string; quantity: number;
  allocated_at: string; stock_left?: number; stock_status?: StockStatus;
}
export interface Zone {
  id: number; zone_name: string; district: string; state: string; risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  latitude: number | null; longitude: number | null; radius_km: number | null; active_incidents: number;
  units_available: number; units_total: number; incidents_total: number; shelters_open: number;
}
export interface Shelter {
  id: number; shelter_name: string; shelter_type: 'SHELTER' | 'SAFE_ZONE' | 'RELIEF_CAMP'; facility_type: string;
  zone_id: number; zone_name: string; district: string; risk_level: string; address: string; capacity: number;
  current_occupancy: number; available: number; status: 'OPEN' | 'FULL' | 'CLOSED'; open_24x7: boolean;
  contact_phone: string | null; amenities: string | null; latitude: number; longitude: number; updated_at: string;
}
export interface PublicAlert {
  id: number; title: string; incident_type: string; severity: Severity; status: IncidentStatus; location: string;
  zone_id: number; zone_name: string; district: string; created_at: string; updated_at: string;
  latitude: number | null; longitude: number | null; units_responding: number;
}
