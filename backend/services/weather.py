"""
services/weather.py
All calls to aviationweather.gov API.
Each function returns None on failure — routes handle the missing data gracefully.
"""
import requests
from typing import Optional
from config import AWC_BASE_URL, WEATHER_TIMEOUT


def fetch_metar(icao: str) -> Optional[dict]:
    """
    Fetch the most recent METAR for an airport.
    Returns the first observation dict or None if unavailable.
    """
    try:
        resp = requests.get(
            f"{AWC_BASE_URL}/metar",
            params={"ids": icao.upper(), "format": "json", "hours": 2},
            timeout=WEATHER_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if data else None
    except Exception:
        return None


def fetch_taf(icao: str) -> Optional[dict]:
    """
    Fetch the current TAF for an airport.
    Returns the first forecast dict or None if unavailable.
    """
    try:
        resp = requests.get(
            f"{AWC_BASE_URL}/taf",
            params={"ids": icao.upper(), "format": "json"},
            timeout=WEATHER_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if data else None
    except Exception:
        return None


def fetch_station(icao: str) -> Optional[dict]:
    """
    Fetch station info (elevation, name, lat/lon) for an airport.
    Used as a fallback when the airport is not in our embedded DB.
    """
    try:
        resp = requests.get(
            f"{AWC_BASE_URL}/stationinfo",
            params={"ids": icao.upper(), "format": "json"},
            timeout=WEATHER_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if data else None
    except Exception:
        return None


def metar_summary(metar: Optional[dict]) -> Optional[dict]:
    """
    Flatten a raw AWC METAR dict into the fields our API returns.
    Returns None if metar is None.
    """
    if not metar:
        return None
    return {
        "raw":         metar.get("rawOb"),
        "temp_c":      metar.get("temp"),
        "dewpoint_c":  metar.get("dewp"),
        "wind_dir":    metar.get("wdir"),
        "wind_kt":     metar.get("wspd"),
        "gust_kt":     metar.get("wgst"),
        "vis_sm":      metar.get("visib"),
        "altim_inhg":  metar.get("altim"),
        "clouds":      metar.get("clouds", []),
        "wx":          metar.get("wxString"),
        "flight_cat":  metar.get("flightCategory"),
        "obs_time":    metar.get("obsTime"),
    }
