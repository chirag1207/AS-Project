"""
routers/runway.py
Runway analysis endpoint.
Fetches live METAR, then runs OpenAP performance computation.
"""
from fastapi import APIRouter, HTTPException, Depends

from dependencies import get_current_user
from openap_wrapper import lb_to_kg
from data.airports import get_coords
from services.weather import fetch_metar, fetch_station, metar_summary
from services.performance import compute_runway_perf

router = APIRouter(prefix="/api/runway", tags=["Runway Analysis"])


@router.get("/{icao}")
def runway_analysis(
    icao:     str,
    ac_type:  str,
    mass_lb:  float,
    rwy_hdg:  float = 180,
    user: dict = Depends(get_current_user),
):
    """
    Compute takeoff performance at an airport using live METAR conditions.

    Steps:
    1. Fetch current METAR from aviationweather.gov
    2. Look up airport elevation (embedded DB or AWC station info)
    3. Run OpenAP runway performance computation
    4. Return conditions + performance output
    """
    metar = fetch_metar(icao)
    if not metar:
        raise HTTPException(
            status_code=404,
            detail=f"No METAR available for {icao.upper()}. "
                   "Check the ICAO code or try again in a few minutes."
        )

    # Elevation — prefer embedded DB, fall back to AWC station
    coords = get_coords(icao)
    if coords:
        elev_ft   = coords[3]
        sta_name  = coords[2]
    else:
        sta = fetch_station(icao)
        elev_ft  = sta.get("elev", 0) if sta else 0
        sta_name = sta.get("site", icao) if sta else icao

    # Extract met values with safe defaults
    temp_c   = metar.get("temp",   15)  or 15
    qnh      = metar.get("altim", 29.92) or 29.92
    wind_kt  = metar.get("wspd",   0)   or 0
    wind_dir = metar.get("wdir",   0)   or 0
    mass_kg  = lb_to_kg(mass_lb)

    perf = compute_runway_perf(
        ac_type, mass_kg, elev_ft,
        temp_c, qnh, wind_kt, wind_dir, rwy_hdg
    )

    return {
        "icao":           icao.upper(),
        "aircraft_type":  ac_type.upper(),
        "mass_lb":        round(mass_lb),
        "mass_kg":        round(mass_kg),
        "runway_hdg":     rwy_hdg,
        "station": {
            "elevation_ft": round(elev_ft),
            "name":         sta_name,
        },
        "weather":         metar_summary(metar),
        "performance":     perf,
        "flight_category": metar.get("flightCategory", "UNKNOWN"),
    }
