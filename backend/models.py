"""
models.py
All Pydantic request bodies and shared typed dicts used across routers.
Keeping schemas here means routers stay thin and schemas are reusable.
"""
from pydantic import BaseModel, Field
from typing import Optional

# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email:    str
    password: str

class UserOut(BaseModel):
    email: str
    name:  str
    role:  str
    cert:  str

class LoginResponse(BaseModel):
    token: str
    user:  UserOut

# ── Flight Plan ───────────────────────────────────────────────────────────────

class FlightPlanRequest(BaseModel):
    aircraft_type: str   = Field(..., example="A320")
    departure:     str   = Field(..., min_length=3, max_length=4, example="KDFW")
    destination:   str   = Field(..., min_length=3, max_length=4, example="KLAX")
    flight_number: Optional[str]   = None
    cruise_alt_ft: int             = Field(35000, ge=1000,  le=51000)
    cruise_mach:   float           = Field(0.78,  ge=0.3,   le=0.99)
    flight_rules:  str             = Field("IFR", pattern="^(IFR|VFR)$")
    flight_type:   str             = Field("G")
    pax:           int             = Field(0,     ge=0,  le=800)
    crew:          int             = Field(2,     ge=1,  le=20)
    cargo_lb:      float           = Field(0.0,   ge=0)
    fuel_lb:       Optional[float] = None   # if None → auto-computed

# ── Weight & Balance ──────────────────────────────────────────────────────────

class WBRequest(BaseModel):
    aircraft_type:     str   = Field(..., example="A320")
    crew:              int   = Field(2,    ge=1, le=20)
    pax:               int   = Field(0,    ge=0, le=800)
    cargo_lb:          float = Field(0.0,  ge=0)
    fuel_lb:           float = Field(...,  gt=0)
    # CG stations as fraction of MAC (0.0 = LEMAC, 1.0 = TEMAC)
    crew_station_mac:  float = Field(0.25, ge=0, le=1)
    pax_station_mac:   float = Field(0.30, ge=0, le=1)
    cargo_station_mac: float = Field(0.45, ge=0, le=1)
