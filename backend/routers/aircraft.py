"""
routers/aircraft.py
Aircraft data and performance curve endpoints.
All data comes from the OpenAP library — no external API calls.
"""
from fastapi import APIRouter, HTTPException, Depends

from dependencies import get_current_user
from openap_wrapper import (
    AIRCRAFT_MAP, get_oa_type, get_aircraft,
    Thrust, Drag, FuelFlow, Emission,
    kg_to_lb, ft_to_m, mach_to_tas_kt,
)

router = APIRouter(prefix="/api", tags=["Aircraft"])


@router.get("/aircraft")
def list_aircraft(_=Depends(get_current_user)):
    """
    List all supported aircraft types with key weight and performance limits.
    Sourced entirely from OpenAP — no external call needed.
    """
    result = []
    for code in AIRCRAFT_MAP:
        try:
            ac = get_aircraft(code)
            result.append({
                "code":         code,
                "name":         ac["aircraft"],
                "mtow_kg":      ac.get("mtow"),
                "mtow_lb":      kg_to_lb(ac.get("mtow", 0)),
                "mlw_kg":       ac.get("mlw"),
                "mlw_lb":       kg_to_lb(ac.get("mlw", 0)),
                "oew_kg":       ac.get("oew"),
                "oew_lb":       kg_to_lb(ac.get("oew", 0)),
                "mfc_kg":       ac.get("mfc"),
                "mfc_lb":       kg_to_lb(ac.get("mfc", 0)),
                "pax_max":      ac.get("pax", {}).get("max"),
                "cruise_mach":  ac.get("cruise", {}).get("mach"),
                "ceiling_ft":   round(ac.get("ceiling", 0) * 3.281),
                "range_nm":     ac.get("cruise", {}).get("range"),
                "engine":       ac.get("engine", {}).get("default"),
            })
        except Exception:
            pass   # skip aircraft that fail to load

    return sorted(result, key=lambda x: x["name"])


@router.get("/aircraft/{ac_type}")
def get_aircraft_detail(ac_type: str, _=Depends(get_current_user)):
    """Return full aerodynamic and performance detail for one aircraft type."""
    try:
        oa_type = get_oa_type(ac_type)
        ac      = get_aircraft(ac_type)
        return {
            "code": ac_type.upper(),
            "name": ac["aircraft"],
            "weights": {
                "mtow_kg": ac.get("mtow"), "mtow_lb": kg_to_lb(ac.get("mtow", 0)),
                "mlw_kg":  ac.get("mlw"),  "mlw_lb":  kg_to_lb(ac.get("mlw",  0)),
                "oew_kg":  ac.get("oew"),  "oew_lb":  kg_to_lb(ac.get("oew",  0)),
                "mfc_kg":  ac.get("mfc"),  "mfc_lb":  kg_to_lb(ac.get("mfc",  0)),
            },
            "performance": {
                "cruise_mach":   ac.get("cruise", {}).get("mach"),
                "cruise_alt_ft": round(ac.get("cruise", {}).get("height", 0) * 3.281),
                "range_nm":      ac.get("cruise", {}).get("range"),
                "vmo_kt":        ac.get("vmo"),
                "mmo":           ac.get("mmo"),
                "ceiling_ft":    round(ac.get("ceiling", 0) * 3.281),
            },
            "aerodynamics": {
                "cd0":          ac.get("drag", {}).get("cd0"),
                "wing_area_m2": ac.get("wing", {}).get("area"),
                "wing_span_m":  ac.get("wing", {}).get("span"),
                "mac_m":        ac.get("wing", {}).get("mac"),
            },
            "engines": ac.get("engine", {}),
            "pax":     ac.get("pax", {}),
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Aircraft not found: {e}")


@router.get("/performance/thrust/{ac_type}")
def get_thrust_curve(ac_type: str, alt_ft: int = 0, _=Depends(get_current_user)):
    """
    Thrust vs TAS curve for takeoff and cruise at a given altitude.
    Used for performance charts in the frontend.
    """
    try:
        oa_type    = get_oa_type(ac_type)
        thrust_obj = Thrust(oa_type)
        points     = []
        for tas in range(0, 500, 20):
            try:
                points.append({
                    "tas_kt":    tas,
                    "takeoff_N": round(thrust_obj.takeoff(tas=tas, alt=alt_ft)),
                    "cruise_N":  round(thrust_obj.cruise(tas=tas,  alt=alt_ft)),
                })
            except Exception:
                pass
        return {"aircraft": ac_type.upper(), "alt_ft": alt_ft, "thrust_curve": points}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/performance/fuel/{ac_type}")
def get_fuel_curve(
    ac_type: str,
    cruise_alt_ft: int   = 35000,
    cruise_mach:   float = 0.78,
    _=Depends(get_current_user),
):
    """
    Fuel flow and CO₂ vs distance for a given cruise profile.
    Used to populate the fuel flow chart in the Flight Planning tab.
    """
    try:
        oa_type  = get_oa_type(ac_type)
        ac       = get_aircraft(ac_type)
        fuel_obj = FuelFlow(oa_type)
        emis_obj = Emission(oa_type)
        tas_kt   = mach_to_tas_kt(cruise_mach, cruise_alt_ft)

        mtow     = ac.get("mtow", 70_000)
        oew      = ac.get("oew",  40_000)
        max_rng  = ac.get("cruise", {}).get("range", 3000)
        points   = []

        for dist in range(100, int(max_rng) + 100, 100):
            mass = max(oew + 5_000, mtow - dist * 3)
            try:
                ff  = fuel_obj.enroute(mass=mass, tas=tas_kt, alt=cruise_alt_ft, vs=0)
                co2 = emis_obj.co2(ff)
                points.append({
                    "dist_nm":   dist,
                    "mass_kg":   round(mass),
                    "ff_kg_min": round(ff, 3),
                    "ff_lb_hr":  round(ff * 132.28),
                    "co2_g_min": round(co2, 1),
                })
            except Exception:
                pass

        return {
            "aircraft":      ac_type.upper(),
            "cruise_alt_ft": cruise_alt_ft,
            "cruise_mach":   cruise_mach,
            "tas_kt":        round(tas_kt),
            "fuel_curve":    points,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
