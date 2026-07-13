"""
routers/airports.py
Airport lookup and search endpoints.
All data served from the embedded airport database — no external calls.
"""
from fastapi import APIRouter, HTTPException, Depends

from dependencies import get_current_user
from data.airports import AIRPORTS, get_coords, search

router = APIRouter(prefix="/api/airports", tags=["Airports"])


@router.get("")
def search_airports(q: str = "", _=Depends(get_current_user)):
    """
    Search airports by ICAO prefix or name substring.
    Returns up to 20 matches sorted by ICAO code.
    """
    if len(q) < 2:
        return []
    return search(q)


@router.get("/{icao}")
def get_airport(icao: str, _=Depends(get_current_user)):
    """
    Return coordinates and elevation for a specific airport.
    Used by the map component to plot markers.
    """
    coords = get_coords(icao)
    if not coords:
        raise HTTPException(
            status_code=404,
            detail=f"{icao.upper()} is not in the embedded airport database. "
                   "Add it to data/airports.py to enable map support."
        )
    lat, lon, name, elev = coords
    return {
        "icao":         icao.upper(),
        "lat":          lat,
        "lon":          lon,
        "name":         name,
        "elevation_ft": elev,
    }
