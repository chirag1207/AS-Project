"""
routers/flights.py
Flight plan CRUD — create, list, retrieve.
Flights are stored in memory (FLIGHTS dict) for this demo.
Replace with SQLAlchemy + SQLite/Postgres for persistence.
"""
import math
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from dependencies import get_current_user
from models import FlightPlanRequest
from openap_wrapper import get_aircraft, get_oa_type, kg_to_lb, lb_to_kg
from data.airports import get_coords
from services.weather import fetch_metar, fetch_station, metar_summary
from services.performance import compute_fuel_burn

router = APIRouter(prefix="/api/flights", tags=["Flights"])

# In-memory store — replace with DB for production
FLIGHTS: dict = {}


def _great_circle_nm(lat1, lon1, lat2, lon2) -> int:
    """Haversine great-circle distance in nautical miles."""
    r = 6371  # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return round(math.atan2(math.sqrt(a), math.sqrt(1 - a)) * 2 * r / 1.852)


@router.post("")
def create_flight(req: FlightPlanRequest, user: dict = Depends(get_current_user)):
    """
    Compute a full flight plan:
    1. Fetch live METARs at departure and destination
    2. Look up airport coordinates (embedded DB → AWC station fallback)
    3. Compute great-circle distance
    4. Run OpenAP fuel burn computation
    5. Build weight stack (OEW + payload + fuel → ZFW/TOW/LW)
    """
    try:
        oa_type = get_oa_type(req.aircraft_type)
        ac      = get_aircraft(req.aircraft_type)

        # ── Weather (parallel-ish via sequential calls — fast enough for demo) ──
        dep_metar = fetch_metar(req.departure)
        arr_metar = fetch_metar(req.destination)

        # ── Coordinates ──────────────────────────────────────────────────────
        dep_coords = get_coords(req.departure)
        arr_coords = get_coords(req.destination)

        # Fallback to AWC station info if airport not in embedded DB
        if not dep_coords:
            sta = fetch_station(req.departure)
            if sta:
                dep_coords = (sta["lat"], sta["lon"], sta.get("site", req.departure), sta.get("elev", 0))

        if not arr_coords:
            sta = fetch_station(req.destination)
            if sta:
                arr_coords = (sta["lat"], sta["lon"], sta.get("site", req.destination), sta.get("elev", 0))

        # ── Distance ─────────────────────────────────────────────────────────
        if dep_coords and arr_coords:
            dist_nm = _great_circle_nm(dep_coords[0], dep_coords[1],
                                        arr_coords[0], arr_coords[1])
        else:
            dist_nm = 200   # fallback when coords unavailable

        # ── Weights ───────────────────────────────────────────────────────────
        oew_kg   = ac.get("oew", 40_000)
        pax_kg   = req.pax  * 95 + req.crew * 95
        cargo_kg = lb_to_kg(req.cargo_lb)

        # Initial fuel estimate for TOW seed
        seed_tow = oew_kg + pax_kg + cargo_kg + 15_000

        fuel_data     = compute_fuel_burn(oa_type, dist_nm, req.cruise_alt_ft, req.cruise_mach, seed_tow)
        trip_fuel_kg  = fuel_data["trip_fuel_kg"]
        total_fuel_kg = fuel_data["total_fuel_kg"]

        # Override with pilot-specified fuel if provided
        if req.fuel_lb:
            total_fuel_kg = lb_to_kg(req.fuel_lb)

        zfw_kg = oew_kg + pax_kg + cargo_kg
        tow_kg = zfw_kg + total_fuel_kg
        lw_kg  = tow_kg - trip_fuel_kg

        # ── Flight ID ─────────────────────────────────────────────────────────
        flight_id = hashlib.md5(
            f"{user['email']}{req.departure}{req.destination}{time.time()}".encode()
        ).hexdigest()[:8].upper()

        flight = {
            "id":            flight_id,
            "flight_number": req.flight_number or f"AS{flight_id[:4]}",
            "pilot":         user["email"],
            "aircraft_type": req.aircraft_type.upper(),
            "aircraft_name": ac["aircraft"],
            "departure":     req.departure.upper(),
            "destination":   req.destination.upper(),
            "cruise_alt_ft": req.cruise_alt_ft,
            "cruise_mach":   req.cruise_mach,
            "flight_rules":  req.flight_rules,
            "flight_type":   req.flight_type,
            "crew":          req.crew,
            "pax":           req.pax,
            "created_at":    datetime.now(timezone.utc).isoformat(),
            "status":        "planned",
            "weights": {
                "oew_kg":        oew_kg,           "oew_lb":        kg_to_lb(oew_kg),
                "payload_kg":    round(pax_kg + cargo_kg),
                "payload_lb":    kg_to_lb(pax_kg + cargo_kg),
                "zfw_kg":        round(zfw_kg),    "zfw_lb":        kg_to_lb(zfw_kg),
                "tow_kg":        round(tow_kg),    "tow_lb":        kg_to_lb(tow_kg),
                "lw_kg":         round(lw_kg),     "lw_lb":         kg_to_lb(lw_kg),
                "fuel_total_kg": round(total_fuel_kg), "fuel_total_lb": kg_to_lb(total_fuel_kg),
                "fuel_trip_kg":  trip_fuel_kg,     "fuel_trip_lb":  kg_to_lb(trip_fuel_kg),
            },
            "route": {
                "dist_nm":      dist_nm,
                "eet_min":      fuel_data.get("flight_time_min", 0),
                "route_string": f"{req.departure.upper()} DCT {req.destination.upper()}",
            },
            "fuel":        fuel_data,
            "dep_weather": metar_summary(dep_metar),
            "arr_weather": metar_summary(arr_metar),
            "dep_coords":  {"lat": dep_coords[0], "lon": dep_coords[1], "name": dep_coords[2]} if dep_coords else None,
            "arr_coords":  {"lat": arr_coords[0], "lon": arr_coords[1], "name": arr_coords[2]} if arr_coords else None,
        }

        FLIGHTS[flight_id] = flight
        return flight

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
def list_flights(user: dict = Depends(get_current_user)):
    """Return all flights belonging to the current pilot."""
    return [f for f in FLIGHTS.values() if f["pilot"] == user["email"]]


@router.get("/{flight_id}")
def get_flight(flight_id: str, user: dict = Depends(get_current_user)):
    """Return a single flight by ID."""
    flight = FLIGHTS.get(flight_id.upper())
    if not flight or flight["pilot"] != user["email"]:
        raise HTTPException(status_code=404, detail="Flight not found")
    return flight
