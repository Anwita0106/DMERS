"""Request bodies. Value sets come from the CHECK constraints of 01_schema.sql."""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

AccountType = Literal["CITIZEN", "COORDINATOR", "UNIT_LEAD", "ADMINISTRATOR"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
Severity = Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
UnitType = Literal["FIRE", "MEDICAL", "POLICE", "RESCUE", "RELIEF"]
Category = Literal["FOOD", "WATER", "MEDICAL", "SHELTER", "EQUIPMENT"]
Phone = Field(pattern=r"^[6-9][0-9]{9}$")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---- auth / users
class RegisterIn(Strict):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserCreateIn(RegisterIn):
    account_type: AccountType = "CITIZEN"


class UserUpdateIn(Strict):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    account_type: Optional[AccountType] = None


class PasswordChangeIn(Strict):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ---- incidents
class IncidentCreateIn(Strict):
    title: str = Field(min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, max_length=4000)
    incident_type: str = Field(min_length=2, max_length=30)
    location: str = Field(min_length=3, max_length=150)
    severity: Severity = "MODERATE"
    zone_id: Optional[int] = None       # a reporter may suggest a zone; it stays REPORTED

    @field_validator("incident_type")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.strip().upper().replace(" ", "_").replace("-", "_")


class IncidentUpdateIn(Strict):
    title: Optional[str] = Field(default=None, min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, max_length=4000)
    incident_type: Optional[str] = Field(default=None, min_length=2, max_length=30)
    location: Optional[str] = Field(default=None, min_length=3, max_length=150)
    severity: Optional[Severity] = None
    zone_id: Optional[int] = None

    @field_validator("incident_type")
    @classmethod
    def upper(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper().replace(" ", "_").replace("-", "_") if v else v


class VerifyIn(Strict):
    zone_id: int
    severity: Optional[Severity] = None
    note: Optional[str] = Field(default=None, max_length=200)


class StatusIn(Strict):
    status: Literal["VERIFIED", "REJECTED", "RESOLVED"]
    note: Optional[str] = Field(default=None, max_length=200)
    zone_id: Optional[int] = None


class CloseIn(Strict):
    note: Optional[str] = Field(default=None, max_length=200)


# ---- dispatches
class DispatchIn(Strict):
    incident_id: int
    unit_id: int


class DispatchStatusIn(Strict):
    dispatch_status: Literal["EN_ROUTE", "ON_SCENE", "COMPLETED", "CANCELLED"]


# ---- units
class UnitIn(Strict):
    unit_name: str = Field(min_length=2, max_length=60)
    unit_type: UnitType
    contact_phone: str = Phone
    personnel_count: int = Field(gt=0, le=32767)
    zone_id: int
    lead_user_id: Optional[int] = None


class UnitUpdateIn(Strict):
    unit_name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    unit_type: Optional[UnitType] = None
    contact_phone: Optional[str] = Field(default=None, pattern=r"^[6-9][0-9]{9}$")
    personnel_count: Optional[int] = Field(default=None, gt=0, le=32767)
    zone_id: Optional[int] = None
    lead_user_id: Optional[int] = None
    clear_lead: bool = False
    availability_status: Optional[Literal["AVAILABLE", "OFF_DUTY"]] = None


# ---- resources / allocations
class ResourceIn(Strict):
    resource_name: str = Field(min_length=2, max_length=60)
    category: Category
    unit_of_measure: str = Field(min_length=1, max_length=20)
    quantity_available: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0, ge=0)


class ResourceUpdateIn(Strict):
    resource_name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    category: Optional[Category] = None
    unit_of_measure: Optional[str] = Field(default=None, min_length=1, max_length=20)
    reorder_level: Optional[int] = Field(default=None, ge=0)
    restock: Optional[int] = Field(default=None, gt=0, description="Quantity to add to stock")
    quantity_available: Optional[int] = Field(default=None, ge=0, description="Set an exact stock count")


class AllocationIn(Strict):
    incident_id: int
    resource_id: int
    quantity: int = Field(gt=0)


class AllocationUpdateIn(Strict):
    quantity: int = Field(gt=0)


# ---- zones / shelters
class ZoneIn(Strict):
    zone_name: str = Field(min_length=2, max_length=60)
    district: str = Field(min_length=2, max_length=60)
    state: str = Field(default="Tamil Nadu", min_length=2, max_length=60)
    risk_level: RiskLevel
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_km: Optional[float] = Field(default=None, gt=0, le=999)


class ZoneUpdateIn(Strict):
    zone_name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    district: Optional[str] = Field(default=None, min_length=2, max_length=60)
    state: Optional[str] = Field(default=None, min_length=2, max_length=60)
    risk_level: Optional[RiskLevel] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_km: Optional[float] = Field(default=None, gt=0, le=999)


class ShelterIn(Strict):
    shelter_name: str = Field(min_length=2, max_length=80)
    shelter_type: Literal["SHELTER", "SAFE_ZONE", "RELIEF_CAMP"] = "SHELTER"
    facility_type: Literal["SCHOOL", "COLLEGE", "COMMUNITY", "GOVERNMENT", "RELIGIOUS", "OPEN_GROUND"] = "COMMUNITY"
    zone_id: int
    address: str = Field(min_length=3, max_length=150)
    capacity: int = Field(gt=0)
    current_occupancy: int = Field(default=0, ge=0)
    status: Literal["OPEN", "FULL", "CLOSED"] = "OPEN"
    open_24x7: bool = True
    contact_phone: Optional[str] = Field(default=None, pattern=r"^[6-9][0-9]{9}$")
    amenities: Optional[str] = Field(default=None, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ShelterUpdateIn(Strict):
    shelter_name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    shelter_type: Optional[Literal["SHELTER", "SAFE_ZONE", "RELIEF_CAMP"]] = None
    facility_type: Optional[Literal["SCHOOL", "COLLEGE", "COMMUNITY", "GOVERNMENT", "RELIGIOUS", "OPEN_GROUND"]] = None
    zone_id: Optional[int] = None
    address: Optional[str] = Field(default=None, min_length=3, max_length=150)
    capacity: Optional[int] = Field(default=None, gt=0)
    current_occupancy: Optional[int] = Field(default=None, ge=0)
    status: Optional[Literal["OPEN", "FULL", "CLOSED"]] = None
    open_24x7: Optional[bool] = None
    contact_phone: Optional[str] = Field(default=None, pattern=r"^[6-9][0-9]{9}$")
    amenities: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
