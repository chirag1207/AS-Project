"""
config.py
All app-wide constants, secrets, and settings.
Change values here — no need to touch any other file.
"""
import hashlib

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET      = "as-demo-secret-2024"
TOKEN_TTL_SEC   = 86400          # 24 hours

# ── Demo users (replace with a real DB for production) ───────────────────────
USERS: dict = {
    "pilot@aircraftsolutions.com": {
        "password_hash": hashlib.sha256("demo1234".encode()).hexdigest(),
        "name": "Capt. James Walker",
        "role": "Pilot",
        "cert": "ATP-12345",
    }
}

# ── Weather API ───────────────────────────────────────────────────────────────
AWC_BASE_URL    = "https://aviationweather.gov/api/data"
WEATHER_TIMEOUT = 5              # seconds

# ── Unit conversion constants ─────────────────────────────────────────────────
KG_TO_LB        = 2.20462
NM_TO_KM        = 1.852
FT_TO_M         = 0.3048

# ── Aerodynamics constants ────────────────────────────────────────────────────
STD_QNH_INHG    = 29.92
ISA_SL_TEMP_C   = 15.0
ISA_LAPSE_RATE  = 1.98           # °C per 1000 ft
DA_FACTOR       = 6.87559e-6     # density altitude sigma coefficient
CL_MAX_FLAPS    = 2.0            # typical CL max with flaps extended
STD_AIR_DENSITY = 1.225          # kg/m³ at sea level ISA
GRAVITY         = 9.81           # m/s²

# ── W&B envelope defaults (generic transport category) ───────────────────────
CG_FWD_LIMIT_MAC = 16.0          # % MAC
CG_AFT_LIMIT_MAC = 38.0          # % MAC
FUEL_CG_MAC      = 0.28          # fuel CG as fraction of MAC (wing tank typical)
OEW_CG_MAC       = 0.26          # OEW CG as fraction of MAC
LEMAC_FRACTION   = 0.30          # LEMAC position as fraction of fuselage length

# ── Fuel reserve policy ───────────────────────────────────────────────────────
RESERVE_ALTERNATE_MIN = 45       # minutes at cruise FF
CONTINGENCY_PCT       = 0.05     # 5% of trip fuel

# ── Passenger standard weights ────────────────────────────────────────────────
PAX_WEIGHT_KG   = 95             # kg per pax (incl. carry-on, IATA standard)
CREW_WEIGHT_KG  = 95             # kg per crew member
