"""SQLAlchemy models that mirror database/original/01_schema.sql exactly.

The eight DMERS tables are owned by the SQL scripts, not by the application:
the API never calls metadata.create_all() and never alters them. These classes exist so the
API can read them with the same names, types, keys and nullability, and so that
schema_check.py can compare them with the live database at start-up.

Tables prefixed app_ come from database/migrations/M001_app_extensions.sql.
"""
from sqlalchemy import (
    TIMESTAMP, Boolean, ForeignKey, Identity, Integer, Numeric,
    PrimaryKeyConstraint, SmallInteger, String, Text, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

TZ = TIMESTAMP(timezone=True)

# Value sets of the CHECK constraints in 01_schema.sql (single source for API validation)
ACCOUNT_TYPES = ("CITIZEN", "COORDINATOR", "UNIT_LEAD", "ADMINISTRATOR")
RISK_LEVELS = ("LOW", "MEDIUM", "HIGH")
SEVERITIES = ("LOW", "MODERATE", "HIGH", "CRITICAL")
INCIDENT_STATUSES = ("REPORTED", "VERIFIED", "RESPONDING", "RESOLVED", "CLOSED", "REJECTED")
UNIT_TYPES = ("FIRE", "MEDICAL", "POLICE", "RESCUE", "RELIEF")
AVAILABILITY = ("AVAILABLE", "DEPLOYED", "OFF_DUTY")
RESOURCE_CATEGORIES = ("FOOD", "WATER", "MEDICAL", "SHELTER", "EQUIPMENT")
DISPATCH_STATUSES = ("ASSIGNED", "EN_ROUTE", "ON_SCENE", "COMPLETED", "CANCELLED")
ACTIVE_DISPATCH = ("ASSIGNED", "EN_ROUTE", "ON_SCENE")
# Free-text column in the schema; these are the values used by the seed data plus common ones
INCIDENT_TYPES = ("FLOOD", "FIRE", "CYCLONE", "EARTHQUAKE", "LANDSLIDE", "TSUNAMI", "HEATWAVE",
                  "SEVERE_STORM", "BUILDING_COLLAPSE", "GAS_LEAK", "ROAD_ACCIDENT", "TREE_FALL",
                  "WATER_RESCUE", "MEDICAL", "OTHER")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[str] = mapped_column(String(15), nullable=False, server_default=text("'CITIZEN'"))
    email: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at = mapped_column(TZ, nullable=False, server_default=text("now()"))


class Zone(Base):
    __tablename__ = "zones"
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    zone_name: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    district: Mapped[str] = mapped_column(String(60), nullable=False)
    state: Mapped[str] = mapped_column(String(60), nullable=False, server_default=text("'Tamil Nadu'"))
    risk_level: Mapped[str] = mapped_column(String(6), nullable=False)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description = mapped_column(Text, nullable=True)
    incident_type: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(8), nullable=False, server_default=text("'MODERATE'"))
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default=text("'REPORTED'"))
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    zone_id = mapped_column(Integer, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=True)
    reported_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = mapped_column(TZ, nullable=False, server_default=text("now()"))
    updated_at = mapped_column(TZ, nullable=False, server_default=text("now()"))


class ResponseUnit(Base):
    __tablename__ = "response_units"
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    unit_name: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    unit_type: Mapped[str] = mapped_column(String(10), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(10), nullable=False)
    personnel_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    availability_status: Mapped[str] = mapped_column(String(10), nullable=False, server_default=text("'AVAILABLE'"))
    zone_id: Mapped[int] = mapped_column(Integer, ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    lead_user_id = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True)


class Resource(Base):
    __tablename__ = "resources"
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    resource_name: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(10), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    reorder_level: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class IncidentUpdate(Base):
    """Weak entity INCIDENT_UPDATE; written only by trigger T1/T4, append-only (T5)."""
    __tablename__ = "incident_updates"
    __table_args__ = (PrimaryKeyConstraint("incident_id", "update_no", name="pk_incident_updates"),)
    incident_id: Mapped[int] = mapped_column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    update_no: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_status = mapped_column(String(10), nullable=True)
    new_status: Mapped[str] = mapped_column(String(10), nullable=False)
    note = mapped_column(String(200), nullable=True)
    logged_by = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    logged_at = mapped_column(TZ, nullable=False, server_default=text("now()"))


class Dispatch(Base):
    """Ternary DISPATCHED_TO; created only through sp_dispatch_unit (FR-07)."""
    __tablename__ = "dispatches"
    __table_args__ = (PrimaryKeyConstraint("incident_id", "unit_id", name="pk_dispatches"),)
    incident_id: Mapped[int] = mapped_column(Integer, ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False)
    unit_id: Mapped[int] = mapped_column(Integer, ForeignKey("response_units.id", ondelete="RESTRICT"), nullable=False)
    dispatched_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    dispatch_status: Mapped[str] = mapped_column(String(10), nullable=False, server_default=text("'ASSIGNED'"))
    dispatched_at = mapped_column(TZ, nullable=False, server_default=text("now()"))
    arrived_at = mapped_column(TZ, nullable=True)
    cleared_at = mapped_column(TZ, nullable=True)


class ResourceAllocation(Base):
    """M:N ALLOCATED; stock moves through trigger T4."""
    __tablename__ = "resource_allocations"
    __table_args__ = (PrimaryKeyConstraint("incident_id", "resource_id", name="pk_resource_allocations"),)
    incident_id: Mapped[int] = mapped_column(Integer, ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False)
    resource_id: Mapped[int] = mapped_column(Integer, ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated_at = mapped_column(TZ, nullable=False, server_default=text("now()"))


# ---------------------------------------------------------------- app (additive) tables
class AppZoneGeo(Base):
    __tablename__ = "app_zone_geo"
    zone_id: Mapped[int] = mapped_column(Integer, ForeignKey("zones.id", ondelete="CASCADE"), primary_key=True)
    latitude = mapped_column(Numeric(9, 6), nullable=False)
    longitude = mapped_column(Numeric(9, 6), nullable=False)
    radius_km = mapped_column(Numeric(5, 2), nullable=False, server_default=text("3"))


class AppShelter(Base):
    __tablename__ = "app_shelters"
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    shelter_name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    shelter_type: Mapped[str] = mapped_column(String(15), nullable=False)
    facility_type: Mapped[str] = mapped_column(String(15), nullable=False)
    zone_id: Mapped[int] = mapped_column(Integer, ForeignKey("zones.id", ondelete="CASCADE"), nullable=False)
    address: Mapped[str] = mapped_column(String(150), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    current_occupancy: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(8), nullable=False)
    open_24x7: Mapped[bool] = mapped_column(Boolean, nullable=False)
    contact_phone = mapped_column(String(10), nullable=True)
    amenities = mapped_column(String(200), nullable=True)
    latitude = mapped_column(Numeric(9, 6), nullable=False)
    longitude = mapped_column(Numeric(9, 6), nullable=False)
    updated_at = mapped_column(TZ, nullable=False, server_default=text("now()"))


class AppIncidentAttachment(Base):
    __tablename__ = "app_incident_attachments"
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    incident_id: Mapped[int] = mapped_column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(120), nullable=False)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    uploaded_by = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = mapped_column(TZ, nullable=False, server_default=text("now()"))


CORE_TABLES = ("users", "zones", "incidents", "response_units", "resources",
               "incident_updates", "dispatches", "resource_allocations")
APP_TABLES = ("app_schema_migrations", "app_zone_geo", "app_shelters", "app_incident_attachments")
