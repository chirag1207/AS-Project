"""
services/wb.py
Weight & Balance computation.

Uses OpenAP aircraft data (MAC, fuselage length, OEW) to compute
CG positions for each loading state and check against the generic
transport-category envelope defined in config.py.
"""
from openap_wrapper import get_aircraft, kg_to_lb, lb_to_kg
from config import (
    PAX_WEIGHT_KG, CREW_WEIGHT_KG,
    CG_FWD_LIMIT_MAC, CG_AFT_LIMIT_MAC,
    FUEL_CG_MAC, OEW_CG_MAC, LEMAC_FRACTION,
)


def _moment(mass_kg: float, station_m: float) -> float:
    """kg·m moment about the datum."""
    return mass_kg * station_m


def _cg_pct_mac(cg_m: float, lemac_m: float, mac_m: float) -> float:
    """Convert CG position (m from datum) to %MAC."""
    return (cg_m - lemac_m) / mac_m * 100


def _cg_status(cg_pct: float) -> str:
    if cg_pct < CG_FWD_LIMIT_MAC:
        return "FORWARD OF LIMIT"
    if cg_pct > CG_AFT_LIMIT_MAC:
        return "AFT OF LIMIT"
    return "NORMAL"


def compute_wb(
    aircraft_type: str,
    crew: int,
    pax: int,
    cargo_lb: float,
    fuel_lb: float,
    crew_station_mac: float,
    pax_station_mac: float,
    cargo_station_mac: float,
) -> dict:
    """
    Compute full W&B solution for an aircraft loading.

    Station inputs are fractions of MAC (0.0 = LEMAC, 1.0 = TEMAC).
    CG is computed for four states: OEW → ZFW → TOW → LW.

    Returns weights (kg + lb), CG (%MAC) for each state,
    envelope status, and envelope_points for charting.
    """
    ac = get_aircraft(aircraft_type)

    # ── Aircraft geometry ─────────────────────────────────────────────────────
    oew_kg       = ac.get("oew", 40_000)
    mtow_kg      = ac.get("mtow", oew_kg * 1.8)
    mlw_kg       = ac.get("mlw",  oew_kg * 1.55)
    mac_m        = ac["wing"]["mac"]
    fuse_len     = ac.get("fuselage", {}).get("length", 40.0)
    lemac_m      = fuse_len * LEMAC_FRACTION      # LEMAC assumed at 30% fuselage length

    # ── Convert all payload to kg ─────────────────────────────────────────────
    crew_kg   = crew * CREW_WEIGHT_KG
    pax_kg    = pax  * PAX_WEIGHT_KG
    cargo_kg  = lb_to_kg(cargo_lb)
    fuel_kg   = lb_to_kg(fuel_lb)

    # ── Stations in metres from datum ─────────────────────────────────────────
    sta_oew   = lemac_m + OEW_CG_MAC     * mac_m
    sta_crew  = lemac_m + crew_station_mac  * mac_m
    sta_pax   = lemac_m + pax_station_mac   * mac_m
    sta_cargo = lemac_m + cargo_station_mac * mac_m
    sta_fuel  = lemac_m + FUEL_CG_MAC    * mac_m   # wing tank CG

    # ── Accumulated moments ───────────────────────────────────────────────────
    mom_zfw = (
        _moment(oew_kg,   sta_oew)  +
        _moment(crew_kg,  sta_crew) +
        _moment(pax_kg,   sta_pax)  +
        _moment(cargo_kg, sta_cargo)
    )
    mom_tow = mom_zfw + _moment(fuel_kg, sta_fuel)

    # Trip fuel ≈ 75% of total fuel (rough estimate for LW)
    trip_fuel_kg = fuel_kg * 0.75
    mom_lw       = mom_tow - _moment(trip_fuel_kg, sta_fuel)

    # ── Weights ───────────────────────────────────────────────────────────────
    zfw_kg = oew_kg + crew_kg + pax_kg + cargo_kg
    tow_kg = zfw_kg + fuel_kg
    lw_kg  = tow_kg - trip_fuel_kg

    # ── CG positions ─────────────────────────────────────────────────────────
    def safe_cg(moment, mass):
        return moment / mass if mass > 0 else lemac_m

    cg_zfw = _cg_pct_mac(safe_cg(mom_zfw, zfw_kg), lemac_m, mac_m)
    cg_tow = _cg_pct_mac(safe_cg(mom_tow, tow_kg), lemac_m, mac_m)
    cg_lw  = _cg_pct_mac(safe_cg(mom_lw,  lw_kg),  lemac_m, mac_m)

    return {
        "aircraft_type": aircraft_type.upper(),
        "aircraft_name": ac["aircraft"],
        "mac_m":         round(mac_m, 3),
        "lemac_m":       round(lemac_m, 3),
        "weights": {
            "oew_kg":    round(oew_kg),    "oew_lb":    kg_to_lb(oew_kg),
            "crew_kg":   round(crew_kg),   "crew_lb":   kg_to_lb(crew_kg),
            "pax_kg":    round(pax_kg),    "pax_lb":    kg_to_lb(pax_kg),
            "cargo_kg":  round(cargo_kg),  "cargo_lb":  round(cargo_lb),
            "fuel_kg":   round(fuel_kg),   "fuel_lb":   round(fuel_lb),
            "zfw_kg":    round(zfw_kg),    "zfw_lb":    kg_to_lb(zfw_kg),
            "tow_kg":    round(tow_kg),    "tow_lb":    kg_to_lb(tow_kg),
            "lw_kg":     round(lw_kg),     "lw_lb":     kg_to_lb(lw_kg),
            "mtow_kg":   round(mtow_kg),   "mtow_lb":   kg_to_lb(mtow_kg),
            "mlw_kg":    round(mlw_kg),    "mlw_lb":    kg_to_lb(mlw_kg),
        },
        "cg": {
            "zfw_pct_mac":   round(cg_zfw, 2),
            "tow_pct_mac":   round(cg_tow, 2),
            "lw_pct_mac":    round(cg_lw,  2),
            "fwd_limit_mac": CG_FWD_LIMIT_MAC,
            "aft_limit_mac": CG_AFT_LIMIT_MAC,
            "zfw_status":    _cg_status(cg_zfw),
            "tow_status":    _cg_status(cg_tow),
            "lw_status":     _cg_status(cg_lw),
        },
        "limits": {
            "tow_vs_mtow_pct": round(tow_kg / mtow_kg * 100, 1) if mtow_kg else None,
            "lw_vs_mlw_pct":   round(lw_kg  / mlw_kg  * 100, 1) if mlw_kg  else None,
            "tow_within_mtow": tow_kg <= mtow_kg,
            "lw_within_mlw":   lw_kg  <= mlw_kg,
        },
        "envelope_points": [
            {"label": "OEW", "weight_lb": kg_to_lb(oew_kg), "cg_mac": round(cg_zfw, 2)},
            {"label": "ZFW", "weight_lb": kg_to_lb(zfw_kg), "cg_mac": round(cg_zfw, 2)},
            {"label": "TOW", "weight_lb": kg_to_lb(tow_kg), "cg_mac": round(cg_tow, 2)},
            {"label": "LW",  "weight_lb": kg_to_lb(lw_kg),  "cg_mac": round(cg_lw,  2)},
        ],
    }
