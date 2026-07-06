# Aircraft Solutions (AS) — Flight Operations Platform
## Complete Project Documentation

---

## 1. Project Overview

**Aircraft Solutions** is a full-stack flight operations platform built to demonstrate professional-grade aviation software development. It mirrors the core workflows of tools like iPreFlight Genesis PRO, covering three pillars used by every commercial and business aviation operation:

| Feature | What it does |
|---|---|
| **Flight Planning** | Compute EET, fuel burn, TOW/ZFW/LW, live weather at both airports |
| **Runway Analysis** | Live METAR + OpenAP thrust model → density altitude, V2, TOD estimate |
| **Weight & Balance** | Full CG journey (OEW → ZFW → TOW → LW), envelope chart, %MAC output |

**Platforms:** Web (React), iOS (SwiftUI), REST API (Python/FastAPI)
**Auth:** JWT — same token works on both web and iOS (pilot logs in once)

---

## 2. Tech Stack

### Backend
| Layer | Technology | Why |
|---|---|---|
| Language | Python 3.12 | OpenAP is a Python library — natural choice |
| Framework | FastAPI | Async, auto-generates OpenAPI docs, Pydantic validation |
| Performance models | OpenAP | Open-source ICAO aircraft performance data (37 aircraft types) |
| Weather data | aviationweather.gov REST API | Free, no API key, real NOAA METAR/TAF data |
| Auth | Custom JWT (HMAC-SHA256 + base64) | Stateless, shared between web and iOS |
| Server | Uvicorn (ASGI) | Production-grade async server for FastAPI |
| Airport DB | Embedded Python dict (147 airports) | Zero latency, no external dependency |

### Web Frontend
| Layer | Technology | Why |
|---|---|---|
| Framework | React 18 | Component model, hooks, fast rendering |
| Build tool | Vite 5 | Near-instant HMR, native ESM |
| Charts | Recharts | Declarative SVG charts, Recharts ScatterChart for CG envelope |
| Maps | Leaflet + CARTO dark tiles | Free, no API key, great-circle arc rendering |
| Styling | CSS Modules | Scoped styles, no class collisions, zero runtime |
| State | React Context + useState | Auth state global, all other state local to pages |
| HTTP | fetch() with proxy | Vite dev proxy → backend; no CORS issues in dev |

### iOS App
| Layer | Technology | Why |
|---|---|---|
| Language | Swift 5.9 | Required by job description |
| UI | SwiftUI | Required by job description, declarative, modern |
| Networking | URLSession async/await | Native Swift concurrency, no third-party libs |
| State | ObservableObject + @StateObject | SwiftUI-native reactive pattern |
| Auth | UserDefaults (token storage) | Same JWT token as web frontend |
| Navigation | NavigationStack + TabView | Matches the Genesis PRO tab pattern |

---

## 3. Backend Module Structure

```
backend/
├── main.py              # Entry point — registers all routers (30 lines)
├── config.py            # All constants: JWT secret, weights, envelope limits
├── dependencies.py      # FastAPI auth dependency (get_current_user)
├── models.py            # Pydantic schemas: LoginRequest, FlightPlanRequest, WBRequest
├── openap_wrapper.py    # OpenAP wrapper with use_synonym=True, unit helpers
├── data/
│   └── airports.py      # 147 airport coords: get_coords(), search()
├── services/
│   ├── weather.py       # aviationweather.gov: fetch_metar(), fetch_taf(), metar_summary()
│   ├── performance.py   # OpenAP fuel burn + runway computations
│   └── wb.py            # Weight & Balance CG computation
└── routers/
    ├── auth.py          # POST /api/auth/login  GET /api/auth/me
    ├── aircraft.py      # GET /api/aircraft  GET /api/aircraft/{type}  GET /api/performance/*
    ├── flights.py       # GET/POST /api/flights  GET /api/flights/{id}
    ├── runway.py        # GET /api/runway/{icao}
    ├── wb.py            # POST /api/wb
    └── airports.py      # GET /api/airports  GET /api/airports/{icao}
```

---

## 4. API Endpoints — Complete Reference

Base URL: `http://localhost:8000`
Auth: All endpoints except `/api/auth/login` and `/health` require `Authorization: Bearer <token>`

---

### AUTH

#### `POST /api/auth/login`
Authenticate a pilot. Returns a JWT token valid for 24 hours.

**Request body:**
```json
{
  "email": "pilot@aircraftsolutions.com",
  "password": "demo1234"
}
```
**Response:**
```json
{
  "token": "cGlsb3RAYXMuY...",
  "user": {
    "email": "pilot@aircraftsolutions.com",
    "name": "Capt. James Walker",
    "role": "Pilot",
    "cert": "ATP-12345"
  }
}
```
**Used by:** Login page (web) → LoginView (iOS)

---

#### `GET /api/auth/me`
Verify token and return current user profile. Called on app load to restore session.

**Response:** Same `user` object as login.
**Used by:** `useAuth` hook (web) → `AppState.restore()` (iOS)

---

### AIRCRAFT

#### `GET /api/aircraft`
List all 37 supported aircraft types with key weight limits and performance data.
All data comes from the OpenAP library — no external call.

**Response (array):**
```json
[
  {
    "code": "A320",
    "name": "Airbus A320",
    "mtow_lb": 171960,
    "mlw_lb": 145505,
    "oew_lb": 93915,
    "mfc_lb": 42109,
    "pax_max": 180,
    "cruise_mach": 0.78,
    "ceiling_ft": 39000,
    "range_nm": 3300,
    "engine": "CFM56-5B4"
  }
]
```
**Used by:** Aircraft dropdowns in all three features

---

#### `GET /api/aircraft/{ac_type}`
Full aerodynamic detail for one aircraft: wing geometry, drag polar, engine data, pax config.

**Example:** `GET /api/aircraft/A320`
**Used by:** Aircraft limits card in Flight Planning analysis tab

---

#### `GET /api/performance/thrust/{ac_type}?alt_ft=0`
Thrust vs TAS curve (takeoff and cruise) at a given altitude.
Computed by `Thrust(ac_type).takeoff(tas, alt)` and `.cruise(tas, alt)`.

**Used by:** Performance analysis (available for charting)

---

#### `GET /api/performance/fuel/{ac_type}?cruise_alt_ft=35000&cruise_mach=0.78`
Fuel flow (lb/hr) and CO₂ (g/min) vs distance for a cruise profile.
Powers the fuel flow line chart in the Flight Planning Analysis tab.

**Response:**
```json
{
  "aircraft": "A320",
  "cruise_alt_ft": 35000,
  "cruise_mach": 0.78,
  "tas_kt": 450,
  "fuel_curve": [
    { "dist_nm": 100, "ff_lb_hr": 7200, "co2_g_min": 2180 },
    ...
  ]
}
```
**Used by:** Fuel flow chart in Flight Planning tab

---

### FLIGHT PLANNING

#### `POST /api/flights`
The main computation endpoint. Creates a full flight plan.

**What it does internally:**
1. Fetches live METARs at departure and destination from aviationweather.gov
2. Looks up airport coordinates (embedded DB → AWC station fallback)
3. Computes great-circle distance (Haversine formula)
4. Runs OpenAP `FuelFlow.enroute()` for climb / cruise / descent segments
5. Builds weight stack: OEW + pax + cargo + fuel → ZFW / TOW / LW
6. Computes 45-min alternate reserve + 5% contingency fuel
7. Returns everything needed for the summary, map, and analysis tabs

**Request body:**
```json
{
  "aircraft_type": "A320",
  "departure": "KDFW",
  "destination": "KLAX",
  "flight_number": "AS101",
  "cruise_alt_ft": 35000,
  "cruise_mach": 0.78,
  "flight_rules": "IFR",
  "flight_type": "G",
  "pax": 150,
  "crew": 2,
  "cargo_lb": 5000,
  "fuel_lb": null
}
```

**Response (key fields):**
```json
{
  "id": "A3F2B1C0",
  "departure": "KDFW",
  "destination": "KLAX",
  "aircraft_name": "Airbus A320",
  "weights": {
    "oew_lb": 93915,
    "payload_lb": 32450,
    "zfw_lb": 126365,
    "tow_lb": 144821,
    "lw_lb": 138209,
    "fuel_total_lb": 18456,
    "fuel_trip_lb": 6612
  },
  "route": {
    "dist_nm": 1235,
    "eet_min": 177,
    "route_string": "KDFW DCT KLAX"
  },
  "fuel": {
    "trip_fuel_lb": 6612,
    "reserve_fuel_lb": 3280,
    "cruise_ff_lb_hr": 5840,
    "tas_kt": 450,
    "co2_cruise_kg": 1842,
    "climb_min": 18,
    "cruise_min": 142,
    "desc_min": 12
  },
  "dep_weather": {
    "raw": "KDFW 271453Z 18012KT 10SM FEW250 28/16 A2991",
    "temp_c": 28,
    "wind_dir": 180,
    "wind_kt": 12,
    "altim_inhg": 29.91,
    "flight_cat": "VFR"
  },
  "arr_weather": { ... },
  "dep_coords": { "lat": 32.8968, "lon": -97.038, "name": "Dallas/Fort Worth Intl" },
  "arr_coords": { "lat": 33.9425, "lon": -118.4081, "name": "Los Angeles Intl" }
}
```
**Used by:** Flight Planning page — all three panels (form result, map, analysis tab)

---

#### `GET /api/flights`
List all flights saved by the current pilot (in-memory, session-scoped).
**Used by:** Flight history list in left panel

---

#### `GET /api/flights/{flight_id}`
Retrieve a specific saved flight by its ID.
**Used by:** Clicking a flight in history to reload it

---

### RUNWAY ANALYSIS

#### `GET /api/runway/{icao}?ac_type=A320&mass_lb=140000&rwy_hdg=180`
Fetch live METAR + compute takeoff performance.

**What it does internally:**
1. Fetches current METAR from aviationweather.gov
2. Extracts temp, QNH, wind from METAR
3. Looks up airport elevation (embedded DB or AWC station)
4. Computes pressure altitude and density altitude
5. Computes headwind/crosswind components for the given runway heading
6. Runs `Thrust(ac_type).takeoff(tas=0, alt)` corrected for density ratio (σ)
7. Computes V2 speed from wing area + density + mass
8. Estimates takeoff distance (simplified energy method)

**Response:**
```json
{
  "icao": "KDFW",
  "aircraft_type": "A320",
  "flight_category": "VFR",
  "station": { "elevation_ft": 607, "name": "Dallas/Fort Worth Intl" },
  "weather": {
    "raw": "KDFW 271453Z 18012KT ...",
    "temp_c": 28,
    "wind_dir": 180,
    "wind_kt": 12,
    "altim_inhg": 29.91,
    "flight_cat": "VFR"
  },
  "performance": {
    "pressure_alt_ft": 677,
    "density_alt_ft": 3214,
    "density_ratio": 0.9881,
    "headwind_kt": 12.0,
    "crosswind_kt": 0.0,
    "v2_kt": 155.5,
    "takeoff_thrust_lb": 51840,
    "tod_estimated_ft": 3650,
    "mtow_lb": 171960,
    "mlw_lb": 145505,
    "weight_vs_mtow_pct": 81.4,
    "temp_deviation_isa": 13.8
  }
}
```
**Used by:** Runway Analysis page — conditions card, performance card, wind rose SVG

---

### WEIGHT & BALANCE

#### `POST /api/wb`
Compute full W&B solution for a given loading.

**What it does internally:**
1. Loads aircraft OEW, MTOW, MLW, MAC, fuselage length from OpenAP
2. Converts all payload to kg
3. Assigns stations in metres from datum using MAC fractions
4. Computes accumulated moments for ZFW and TOW
5. Estimates landing CG (burns off 75% of fuel)
6. Converts all CG positions to %MAC
7. Checks each state against generic envelope (16% – 38% MAC)

**Request body:**
```json
{
  "aircraft_type": "A320",
  "crew": 2,
  "pax": 150,
  "cargo_lb": 5000,
  "fuel_lb": 20000,
  "crew_station_mac": 0.25,
  "pax_station_mac": 0.30,
  "cargo_station_mac": 0.45
}
```

**Response:**
```json
{
  "aircraft_type": "A320",
  "aircraft_name": "Airbus A320",
  "mac_m": 4.194,
  "lemac_m": 14.82,
  "weights": {
    "oew_lb": 93915, "crew_lb": 418, "pax_lb": 31350,
    "cargo_lb": 5000, "fuel_lb": 20000,
    "zfw_lb": 130683, "tow_lb": 150683,
    "lw_lb": 135683, "mtow_lb": 171960, "mlw_lb": 145505
  },
  "cg": {
    "zfw_pct_mac": 27.14,
    "tow_pct_mac": 27.73,
    "lw_pct_mac": 27.31,
    "fwd_limit_mac": 16.0,
    "aft_limit_mac": 38.0,
    "zfw_status": "NORMAL",
    "tow_status": "NORMAL",
    "lw_status": "NORMAL"
  },
  "limits": {
    "tow_vs_mtow_pct": 87.6,
    "lw_vs_mlw_pct": 93.2,
    "tow_within_mtow": true,
    "lw_within_mlw": true
  },
  "envelope_points": [
    { "label": "OEW", "weight_lb": 93915, "cg_mac": 27.14 },
    { "label": "ZFW", "weight_lb": 130683, "cg_mac": 27.14 },
    { "label": "TOW", "weight_lb": 150683, "cg_mac": 27.73 },
    { "label": "LW",  "weight_lb": 135683, "cg_mac": 27.31 }
  ]
}
```
**Used by:** W&B page — weight breakdown, CG status badges, Recharts ScatterChart envelope

---

### AIRPORTS

#### `GET /api/airports/{icao}`
Return coordinates and elevation for a single airport.
**Used by:** Map component — plots departure/arrival markers

#### `GET /api/airports?q=KD`
Search airports by ICAO prefix or name. Returns up to 20 results.
**Used by:** Airport autocomplete (available for future use)

---

### HEALTH

#### `GET /health`
Server status check. No auth required.
```json
{ "status": "ok", "service": "AS Flight Operations API", "version": "2.0.0" }
```

---

## 5. Data Sources

| Data | Source | How |
|---|---|---|
| Aircraft performance (thrust, drag, fuel) | **OpenAP** Python library | Local computation — no network call |
| Aircraft weights (MTOW, MLW, OEW, MAC) | **OpenAP** `aircraft()` dict | Local lookup |
| Live METAR weather | **aviationweather.gov** `/api/data/metar` | HTTP GET, JSON, free, no key |
| Live TAF forecast | **aviationweather.gov** `/api/data/taf` | HTTP GET, JSON, free, no key |
| Airport station info (fallback) | **aviationweather.gov** `/api/data/stationinfo` | HTTP GET, JSON |
| Airport coordinates (primary) | **Embedded dict** `data/airports.py` | 147 airports, zero latency |

---

## 6. Key Computations

### Fuel Burn (services/performance.py)
Flight split into three segments. Each uses OpenAP's `FuelFlow.enroute(mass, tas, alt, vs)`:
- **Climb:** 250 kt, 40% cruise alt, VS +1800 fpm, ~cruise_alt/2000 minutes
- **Cruise:** Mach → TAS conversion, cruise alt, VS 0, (dist-80nm)/TAS minutes
- **Descent:** 280 kt, 40% cruise alt, VS -1500 fpm, ~cruise_alt/3000 minutes
- **Reserve:** 45 min at cruise FF + 5% trip fuel contingency

### Density Altitude (services/performance.py)
```
PA  = elevation + (29.92 - QNH) × 1000
ISA = 15 - 1.98 × (elevation / 1000)
DA  = PA + 118.8 × (OAT - ISA)
σ   = max(0.5, 1 - DA × 6.87559×10⁻⁶)
```

### V2 Speed (services/performance.py)
```
Vs = √(2 × mass × g / (ρ × S × CLmax))
V2 = Vs × 1.944 × 1.2   [m/s → kt, × 1.2 safety factor]
```

### CG Calculation (services/wb.py)
```
LEMAC = fuselage_length × 0.30
station = LEMAC + (fraction_of_MAC × MAC)
moment  = mass × station
CG_m    = Σmoments / Σmass
CG_%MAC = (CG_m - LEMAC) / MAC × 100
```

### Great-Circle Distance (routers/flights.py)
Haversine formula → result in nautical miles.

---

## 7. iOS ↔ Web Parity

| Concern | Web | iOS |
|---|---|---|
| Auth token | `localStorage["as_token"]` | `UserDefaults["as_token"]` |
| API base URL | Vite proxy `/api` → `localhost:8000` | `ASService.BASE_URL` |
| Models | Inferred from JSON | `Codable` structs in `Models.swift` |
| Auth restore | `useAuth` hook on mount | `AppState.init()` → `restore()` |
| Flight list | `useEffect` → `api.listFlights()` | `.task` → `ASService.listFlights()` |
| Same token | Yes — pilot can log in on web and use same session on iOS |

---

## 8. Supported Aircraft (37 types)

| Family | Types |
|---|---|
| Airbus A320 family | A318, A319, A320, A321, A19N, A20N, A21N |
| Airbus widebody | A332, A333, A343, A359, A388 |
| Boeing 737 NG + MAX | B734, B737, B738, B739, B37M, B38M, B39M, B3XM |
| Boeing widebody | B744, B748, B752, B763, B772, B773, B77W, B788, B789 |
| Regional jets | CRJ9, E145, E75L, E170, E190, E195 |
| Business jets | C550, GLF6 |

---

## 9. Running the Project

### Backend
```powershell
cd apg\backend
pip install openap fastapi uvicorn requests python-multipart
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### Web Frontend
```powershell
cd apg\frontend
npm install
npm run dev
# App: http://localhost:5173
```

### Demo Login
```
Email:    pilot@aircraftsolutions.com
Password: demo1234
```

---

## 10. What's Demo-Only vs Production-Ready

| Item | Status | Production fix |
|---|---|---|
| JWT auth | Demo — HMAC-SHA256, no refresh tokens | python-jose + refresh token rotation |
| User store | In-memory dict | PostgreSQL + SQLAlchemy |
| Flight storage | In-memory dict (lost on restart) | PostgreSQL flights table |
| W&B envelope | Generic 16–38% MAC | Aircraft-specific AFM data per type |
| TOD estimate | Simplified energy method | Full AFM performance tables |
| Airport DB | 147 airports hardcoded | OurAirports CSV (70,000+ airports) |
| Weather | Single METAR per airport | Caching layer + TAF parsing |
| Rate limiting | None | slowapi + Redis |
