"""Turns database rule violations into clear API errors.

The DMERS constraints and triggers are the final authority on business rules. When one
of them rejects a change, the API returns its message instead of a 500 error.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError

# Friendlier wording for the named constraints of 01_schema.sql and M001
CONSTRAINT_MESSAGES = {
    "uq_users_email": "An account with this e-mail already exists",
    "ck_users_email_format": "E-mail address is not valid",
    "ck_users_account_type": "Unknown account type",
    "uq_zones_name": "A zone with this name already exists",
    "ck_zones_risk_level": "Risk level must be LOW, MEDIUM or HIGH",
    "ck_incidents_severity": "Severity must be LOW, MODERATE, HIGH or CRITICAL",
    "ck_incidents_status": "Unknown incident status",
    "ck_incidents_zone_when_verified": "A zone must be assigned before an incident is verified (FR-05)",
    "ck_incidents_timestamps": "Updated time cannot be before the reported time",
    "fk_incidents_zone": "Zone does not exist",
    "fk_incidents_reporter": "This record is still referenced by incidents",
    "uq_units_name": "A response unit with this name already exists",
    "ck_units_type": "Unit type must be FIRE, MEDICAL, POLICE, RESCUE or RELIEF",
    "ck_units_phone": "Contact phone must be a 10-digit Indian mobile number starting with 6-9",
    "ck_units_personnel": "Personnel count must be greater than 0",
    "uq_units_lead": "This person already leads another unit",
    "fk_units_zone": "Zone does not exist or still has response units",
    "uq_resources_name": "A resource with this name already exists",
    "ck_resources_category": "Category must be FOOD, WATER, MEDICAL, SHELTER or EQUIPMENT",
    "ck_resources_quantity": "Quantity available cannot be negative",
    "ck_resources_reorder": "Reorder level cannot be negative",
    "ck_allocations_quantity": "Allocated quantity must be greater than 0",
    "uq_dispatches_one_active_per_unit": "This unit already has an active dispatch (BR-05)",
    "pk_dispatches": "This unit has already been dispatched to this incident",
    "ck_dispatches_arrival": "Arrival time cannot be before dispatch time (BR-06)",
    "ck_dispatches_arrived_on_scene": "A unit must arrive before it is ON_SCENE or COMPLETED",
    "ck_dispatches_cleared_when_closed": "Cleared time is required exactly when a dispatch is COMPLETED or CANCELLED",
    "fk_dispatches_incident": "This incident still has dispatch records",
    "fk_allocations_incident": "This incident still has resource allocations",
    "fk_dispatches_unit": "This unit still has dispatch records",
    "fk_allocations_resource": "This resource still has allocations",
    "uq_app_shelters_name": "A shelter with this name already exists",
    "ck_app_shelters_within_capacity": "Occupancy cannot exceed capacity",
    "ck_app_shelters_phone": "Contact phone must be a 10-digit Indian mobile number starting with 6-9",
}

STATUS_BY_SQLSTATE = {
    "23505": 409,  # unique_violation
    "23503": 409,  # foreign_key_violation
    "23514": 422,  # check_violation
    "23502": 422,  # not_null_violation
    "22001": 422,  # string too long
    "P0001": 409,  # RAISE EXCEPTION from a trigger or procedure
}


class RuleError(Exception):
    """Raised by the API for a business rule it checks itself."""

    def __init__(self, message: str, status_code: int = 409):
        self.message, self.status_code = message, status_code


async def rule_error_handler(_: Request, exc: RuleError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


async def db_error_handler(_: Request, exc: DBAPIError):
    orig = getattr(exc, "orig", None)
    code = getattr(orig, "pgcode", None)
    diag = getattr(orig, "diag", None)
    cname = getattr(diag, "constraint_name", None)
    primary = getattr(diag, "message_primary", None) or str(orig or exc).splitlines()[0]
    if code in STATUS_BY_SQLSTATE:
        message = CONSTRAINT_MESSAGES.get(cname, primary)
        return JSONResponse(status_code=STATUS_BY_SQLSTATE[code],
                            content={"detail": message, "rule": cname, "sqlstate": code})
    return JSONResponse(status_code=500, content={"detail": "Database error", "sqlstate": code})
