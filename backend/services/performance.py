"""
services/performance.py
Aerodynamic and performance computations using OpenAP models.

Two public functions:
    compute_fuel_burn()   → fuel breakdown for a flight segment
    compute_runway_perf() → takeoff/landing performance at an airport
"""
import math
from typing import Optional
from openap_wrapper import (
    Thrust, Drag, FuelFlow, Emission,
    get_aircraft, get_oa_type,
    kg_to_lb, ft_to_m, mach_to_tas_kt,
)
from config import (
    STD_QNH_INHG, ISA_SL_TEMP_C, ISA_LAPSE_RATE,
    DA_FACTOR, CL_MAX_FLAPS, STD_AIR_DENSITY, GRAVITY,
    RESERVE_ALTERNATE_MIN, CONTINGENCY_PCT,
)


# ── Atmosphere helpers ────────────────────────────────────────────────────────

def density_altitude(elev_ft: float, temp_c: float, qnh_inhg: float) -> float:
    """
    Compute density altitude (ft).
    DA = PA + 118.8 × (OAT − ISA_temp)
    """
    pressure_alt = elev_ft + (STD_QNH_INHG - qnh_inhg) * 1000
    isa_temp     = ISA_SL_TEMP_C - (ISA_LAPSE_RATE * elev_ft / 1000)
    return pressure_alt + 118.8 * (temp_c - isa_temp)


def density_ratio(da_ft: float) -> float:
    """σ — air density relative to ISA sea-level standard."""
    return max(0.5, 1 - da_ft * DA_FACTOR)


# ── Wind components ───────────────────────────────────────────────────────────

def headwind_component(wind_kt: float, wind_dir: float, rwy_hdg: float) -> float:
    """Positive = headwind, negative = tailwind."""
    angle = math.radians(wind_dir - rwy_hdg)
    return round(wind_kt * math.cos(angle), 1)


def crosswind_component(wind_kt: float, wind_dir: float, rwy_hdg: float) -> float:
    """Always positive magnitude."""
    angle = math.radians(wind_dir - rwy_hdg)
    return round(abs(wind_kt * math.sin(angle)), 1)


# ── Fuel burn ─────────────────────────────────────────────────────────────────

def compute_fuel_burn(
    ac_type: str,
    dist_nm: float,
    cruise_alt_ft: float,
    cruise_mach: float,
    tow_kg: float,
) -> dict:
    """
    Estimate fuel burn for a flight using OpenAP FuelFlow model.
    Breaks flight into three segments: climb / cruise / descent.
    Adds reserve fuel (RESERVE_ALTERNATE_MIN + CONTINGENCY_PCT).

    Returns a dict with kg and lb values for each fuel category.
    """
    oa_type  = get_oa_type(ac_type)
    fuel_obj = FuelFlow(oa_type)
    emis_obj = Emission(oa_type)
    tas_kt   = mach_to_tas_kt(cruise_mach, cruise_alt_ft)

    # Segment time estimates
    climb_min  = cruise_alt_ft / 2000          # ~2000 ft/min average climb
    cruise_nm  = max(0.0, dist_nm - 80)        # subtract ~40 nm climb + 40 nm descent
    cruise_min = (cruise_nm / tas_kt) * 60 if tas_kt > 0 else 0
    desc_min   = cruise_alt_ft / 3000          # ~3000 ft/min average descent

    # Representative mass for each segment
    climb_mass  = tow_kg
    cruise_mass = tow_kg * 0.95
    desc_mass   = tow_kg * 0.90

    # Fuel flows (kg/min) from OpenAP
    ff_climb  = fuel_obj.enroute(mass=climb_mass,  tas=250,    alt=cruise_alt_ft * 0.4, vs=1800)
    ff_cruise = fuel_obj.enroute(mass=cruise_mass, tas=tas_kt, alt=cruise_alt_ft,       vs=0)
    ff_desc   = fuel_obj.enroute(mass=desc_mass,   tas=280,    alt=cruise_alt_ft * 0.4, vs=-1500)

    # Segment fuel burns (kg)
    fuel_climb_kg  = ff_climb  * climb_min
    fuel_cruise_kg = ff_cruise * cruise_min
    fuel_desc_kg   = ff_desc   * desc_min
    fuel_trip_kg   = fuel_climb_kg + fuel_cruise_kg + fuel_desc_kg

    # Reserves
    fuel_reserve_kg = ff_cruise * RESERVE_ALTERNATE_MIN + fuel_trip_kg * CONTINGENCY_PCT
    fuel_total_kg   = fuel_trip_kg + fuel_reserve_kg

    # Emissions (cruise segment only)
    co2_kg = emis_obj.co2(ff_cruise) / 1000 * cruise_min   # g→kg
    nox_g  = emis_obj.nox(ff_cruise, tas=tas_kt, alt=cruise_alt_ft) * cruise_min

    return {
        "trip_fuel_kg":      round(fuel_trip_kg),
        "trip_fuel_lb":      kg_to_lb(fuel_trip_kg),
        "reserve_fuel_kg":   round(fuel_reserve_kg),
        "reserve_fuel_lb":   kg_to_lb(fuel_reserve_kg),
        "total_fuel_kg":     round(fuel_total_kg),
        "total_fuel_lb":     kg_to_lb(fuel_total_kg),
        "cruise_ff_kg_min":  round(ff_cruise, 3),
        "cruise_ff_lb_hr":   round(ff_cruise * 132.28),
        "flight_time_min":   round(climb_min + cruise_min + desc_min),
        "tas_kt":            round(tas_kt),
        "co2_cruise_kg":     round(co2_kg, 1),
        "nox_cruise_g":      round(nox_g, 1),
        "climb_min":         round(climb_min),
        "cruise_min":        round(cruise_min),
        "desc_min":          round(desc_min),
    }


# ── Runway performance ────────────────────────────────────────────────────────

def compute_runway_perf(
    ac_type: str,
    mass_kg: float,
    alt_ft: float,
    temp_c: float,
    qnh_inhg: float,
    wind_kt: float,
    wind_dir: float,
    rwy_hdg: float,
) -> dict:
    """
    Compute takeoff performance at given conditions using OpenAP thrust model.

    Returns pressure alt, density alt, V2, thrust, estimated TOD, and MTOW/MLW limits.
    Note: TOD is a simplified energy-method estimate — not AFM-certified data.
    """
    oa_type    = get_oa_type(ac_type)
    ac         = get_aircraft(ac_type)
    thrust_obj = Thrust(oa_type)

    pa    = alt_ft + (STD_QNH_INHG - qnh_inhg) * 1000
    da    = density_altitude(alt_ft, temp_c, qnh_inhg)
    sigma = density_ratio(da)
    hw    = headwind_component(wind_kt, wind_dir, rwy_hdg)
    xw    = crosswind_component(wind_kt, wind_dir, rwy_hdg)

    # V2 = 1.2 × Vs  (simplified, no flap schedule)
    rho      = STD_AIR_DENSITY * sigma
    wing_s   = ac["wing"]["area"]
    vs_ms    = math.sqrt(2 * mass_kg * GRAVITY / (rho * wing_s * CL_MAX_FLAPS))
    v2_kt    = vs_ms * 1.944 * 1.2

    # Takeoff thrust corrected for density
    t_to_n   = thrust_obj.takeoff(tas=0, alt=alt_ft) * sigma
    v2_ms    = v2_kt / 1.944

    # Simplified TOD: d = m·v² / (2·F_net)
    f_net    = max(t_to_n - mass_kg * GRAVITY * 0.05, 1.0)
    tod_ft   = (mass_kg * v2_ms ** 2) / (2 * f_net) * 3.281

    # Structural limits
    mtow_kg  = ac.get("mtow", mass_kg)
    mlw_kg   = ac.get("mlw",  mass_kg * 0.85)

    # ISA temperature deviation
    isa_temp = ISA_SL_TEMP_C - ISA_LAPSE_RATE * alt_ft / 1000
    isa_dev  = round(temp_c - isa_temp, 1)

    return {
        "pressure_alt_ft":      round(pa),
        "density_alt_ft":       round(da),
        "density_ratio":        round(sigma, 4),
        "headwind_kt":          hw,
        "crosswind_kt":         xw,
        "v2_kt":                round(v2_kt, 1),
        "takeoff_thrust_N":     round(t_to_n),
        "takeoff_thrust_lb":    round(t_to_n * 0.2248),
        "tod_estimated_ft":     round(tod_ft),
        "mtow_kg":              mtow_kg,
        "mtow_lb":              kg_to_lb(mtow_kg),
        "mlw_kg":               mlw_kg,
        "mlw_lb":               kg_to_lb(mlw_kg),
        "weight_vs_mtow_pct":   round(mass_kg / mtow_kg * 100, 1),
        "temp_deviation_isa":   isa_dev,
    }
