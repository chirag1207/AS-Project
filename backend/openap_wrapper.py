"""
openap_wrapper.py
Wraps all OpenAP classes with use_synonym=True so variant codes (A21N, B39M…)
always resolve to the nearest available model without raising exceptions.
Also holds the supported aircraft map and unit conversion helpers.
"""
import warnings
import math
from typing import Optional
from openap.prop import aircraft as _oa_aircraft
from openap import (
    Thrust as _Thrust,
    Drag   as _Drag,
    FuelFlow  as _FuelFlow,
    Emission  as _Emission,
)
from config import KG_TO_LB, NM_TO_KM, FT_TO_M

# ── Synonym-safe wrappers ─────────────────────────────────────────────────────

def Thrust(ac: str, **kw):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return _Thrust(ac, use_synonym=True, **kw)

def Drag(ac: str, **kw):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return _Drag(ac, use_synonym=True, **kw)

def FuelFlow(ac: str, **kw):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return _FuelFlow(ac, use_synonym=True, **kw)

def Emission(ac: str, **kw):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return _Emission(ac, use_synonym=True, **kw)

def get_aircraft(ac_type: str) -> dict:
    """Return OpenAP aircraft dict for a given type code."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return _oa_aircraft(get_oa_type(ac_type))

# ── Supported aircraft map ────────────────────────────────────────────────────
# Maps ICAO type designator → OpenAP internal code.
# Add new types here; the synonym resolver handles minor variants automatically.

AIRCRAFT_MAP: dict[str, str] = {
    # Airbus narrowbody
    "A318": "A318", "A319": "A319", "A320": "A320", "A321": "A321",
    "A19N": "A19N", "A20N": "A20N", "A21N": "A21N",
    # Airbus widebody
    "A332": "A332", "A333": "A333", "A343": "A343",
    "A359": "A359", "A388": "A388",
    # Boeing 737 classic + NG + MAX
    "B734": "B734", "B737": "B737", "B738": "B738", "B739": "B739",
    "B37M": "B37M", "B38M": "B38M", "B39M": "B39M", "B3XM": "B3XM",
    # Boeing widebody
    "B752": "B752", "B763": "B763",
    "B772": "B772", "B773": "B773", "B77W": "B77W",
    "B788": "B788", "B789": "B789",
    "B744": "B744", "B748": "B748",
    # Regional / business jets
    "C550": "C550", "CRJ9": "CRJ9",
    "E145": "E145", "E75L": "E75L",
    "E170": "E170", "E190": "E190", "E195": "E195",
    "GLF6": "GLF6",
}

def get_oa_type(ac_type: str) -> str:
    """Normalise user-supplied type code to OpenAP internal code."""
    t = ac_type.upper().strip()
    return AIRCRAFT_MAP.get(t, t)

# ── Unit conversion helpers ───────────────────────────────────────────────────

def kg_to_lb(kg: float) -> int:
    return round(kg * KG_TO_LB)

def lb_to_kg(lb: float) -> float:
    return lb / KG_TO_LB

def nm_to_km(nm: float) -> float:
    return nm * NM_TO_KM

def ft_to_m(ft: float) -> float:
    return ft * FT_TO_M

def mach_to_tas_kt(mach: float, alt_ft: float) -> float:
    """Convert Mach number to True Airspeed (kt) using ISA temperature."""
    temp_k = 288.15 - 0.0065 * ft_to_m(alt_ft)
    sos    = 340.29 * math.sqrt(temp_k / 288.15)   # m/s
    return mach * sos * 1.944                        # → kt
