# Aircraft Solutions (AS)
### Full-Stack Flight Operations Platform

A full-stack aviation flight operations platform built with Python FastAPI, React, and SwiftUI.
Mirrors the core workflows of professional flight planning software used in business aviation —
integrated flight planning, runway performance analysis, and weight & balance computation.

Built as a portfolio project using **Windsurf AI** as the primary development tool.

> **Live Backend:** https://as-backend-production-1a7b.up.railway.app/docs

---

## Features

### ✈ Flight Planning
- Enter departure/destination ICAO codes, aircraft type, cruise profile, crew/pax/cargo
- Computes great-circle distance, estimated en-route time, fuel burn across climb/cruise/descent segments
- Trip fuel, reserve fuel (45-min alternate + 5% contingency), TOW/ZFW/LW weight stack
- Live METAR weather fetched at both airports from NOAA aviationweather.gov
- Interactive Leaflet map with animated great-circle arc, flight category markers, weather popups

### ⬜ Runway Analysis
- Enter airport ICAO, aircraft type, takeoff mass, runway heading
- Fetches live METAR → computes pressure altitude, density altitude, density ratio (σ)
- Headwind and crosswind decomposition with SVG wind rose visualization
- V2 speed, density-corrected takeoff thrust, estimated takeoff distance
- MTOW limit check with status badge

### ⚖ Weight & Balance
- Full W&B solution for any of the 37 supported aircraft types
- CG computed for four loading states: OEW → ZFW → TOW → LW
- CG position in %MAC checked against transport-category envelope (16%–38% MAC)
- Interactive Recharts ScatterChart CG envelope with MTOW/MLW reference lines
- Forward/aft limit violation detection per loading state

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| Framework | FastAPI + Uvicorn |
| Performance models | OpenAP (open-source aircraft performance library) |
| Weather data | aviationweather.gov REST API (NOAA, free, no key) |
| Auth | Custom HMAC-SHA256 JWT token |
| Airport database | Embedded dict — 147 airports, zero latency |
| Deployment | Railway (free tier) |

### Web Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| Maps | Leaflet + CARTO dark tiles (no API key) |
| Charts | Recharts — LineChart (fuel flow), ScatterChart (CG envelope) |
| Styling | CSS Modules — scoped, no runtime |
| State | React Context (auth) + useState (local) |

### iOS App
| Layer | Technology |
|---|---|
| Language | Swift 5.9 |
| UI Framework | SwiftUI |
| Networking | URLSession async/await |
| State management | ObservableObject + @StateObject + @EnvironmentObject |
| Token storage | UserDefaults |
| Min iOS | 16.0 |

---

## Architecture

```
iOS App (SwiftUI)              Web App (React + Vite)
      │                               │
      └──────────────┬────────────────┘
                     │  Same JWT token
                     │  Same endpoints
                     ▼
        FastAPI Backend (Railway)
        ├── main.py              Entry point — registers routers
        ├── config.py            Constants, JWT secret, settings
        ├── dependencies.py      JWT verification, get_current_user
        ├── models.py            Pydantic request/response schemas
        ├── openap_wrapper.py    OpenAP synonym-safe wrappers + unit helpers
        ├── data/
        │   └── airports.py      147 airport coordinates (embedded)
        ├── services/
        │   ├── performance.py   Fuel burn + runway computations (OpenAP)
        │   ├── weather.py       NOAA METAR/TAF API calls
        │   └── wb.py            Weight & balance CG math
        └── routers/
            ├── auth.py          /api/auth/*
            ├── aircraft.py      /api/aircraft/* + /api/performance/*
            ├── flights.py       /api/flights
            ├── runway.py        /api/runway/*
            ├── wb.py            /api/wb
            └── airports.py      /api/airports/*
```

Both platforms share the same JWT authentication.
The same pilot credentials work on web and iOS.
A flight created on web appears in the iOS flight history and vice versa.

---

## Data Sources

| Data | Source | Network call? |
|---|---|---|
| Aircraft thrust, drag, fuel flow, emissions | OpenAP Python library | ❌ Local computation |
| Aircraft weights (MTOW, MLW, OEW, MAC) | OpenAP Python library | ❌ Local computation |
| Live METAR / TAF weather | aviationweather.gov (NOAA) | ✅ Yes |
| Airport coordinates + elevation | Embedded dict (data/airports.py) | ❌ Instant lookup |
| Great-circle distance + route | Haversine formula | ❌ Local computation |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Pilot authentication → JWT token |
| GET | /api/auth/me | Current pilot profile |
| GET | /api/aircraft | List all 37 supported aircraft types |
| GET | /api/aircraft/{type} | Full aircraft specs and aerodynamics |
| GET | /api/performance/fuel/{type} | Fuel flow curve (chart data) |
| GET | /api/performance/thrust/{type} | Thrust curve by altitude |
| POST | /api/flights | Create full flight plan |
| GET | /api/flights | List pilot's saved flights |
| GET | /api/flights/{id} | Get specific flight |
| GET | /api/runway/{icao} | Runway performance analysis |
| POST | /api/wb | Weight & balance computation |
| GET | /api/airports/{icao} | Airport coordinates lookup |
| GET | /api/airports?q= | Airport search |
| GET | /health | Server health check |

Interactive Swagger docs: https://as-backend-production-1a7b.up.railway.app/docs

---

## Running Locally

### Backend
```bash
cd backend
pip install openap fastapi uvicorn requests python-multipart
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### Web Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Backend is deployed on Railway — frontend proxy points there by default.
No need to run the backend locally unless making backend changes.

### Demo Credentials
```
Email:    pilot@aircraftsolutions.com
Password: demo1234
```

---

## iOS App Setup (Requires Mac + Xcode 15)

1. Open `AircraftSolutions.xcodeproj` in Xcode
2. Xcode → Settings → Accounts → add your Apple ID
3. Select your Apple ID as the signing team
4. Change Bundle ID to `com.YOURNAME.aircraftsolutions`
5. Build and run on simulator or device

Swift files:
| File | Responsibility |
|---|---|
| `ASApp.swift` | App entry point, auth routing (Login vs Tabs) |
| `AppState.swift` | Global state — user session + aircraft list |
| `ASService.swift` | All HTTP calls to Railway backend |
| `Models.swift` | Codable structs matching FastAPI response shapes |
| `Views.swift` | Shared UI components + LoginView + MainTabView |
| `FlightPlanningView.swift` | Flight Planning screen |
| `RunwayAndWB.swift` | Runway Analysis + W&B screens |

---

## Supported Aircraft (37 types)

| Family | Types |
|---|---|
| Airbus A320 family | A318, A319, A320, A321, A19N, A20N, A21N |
| Airbus widebody | A332, A333, A343, A359, A388 |
| Boeing 737 NG + MAX | B734, B737, B738, B739, B37M, B38M, B39M, B3XM |
| Boeing widebody | B744, B748, B752, B763, B772, B773, B77W, B788, B789 |
| Regional jets | CRJ9, E145, E75L, E170, E190, E195 |
| Business jets | C550, GLF6 |

---

## Key Computations

### Fuel Burn (services/performance.py)
Flight split into climb / cruise / descent using OpenAP `FuelFlow.enroute(mass, tas, alt, vs)`:
- Climb: 250kt, 40% cruise alt, VS +1800fpm
- Cruise: Mach → TAS via ISA temperature, cruise altitude, VS 0
- Descent: 280kt, 40% cruise alt, VS -1500fpm
- Reserve: 45 min at cruise FF + 5% contingency

### Density Altitude
```
PA  = elevation + (29.92 − QNH) × 1000
ISA = 15 − 1.98 × (elevation / 1000)
DA  = PA + 118.8 × (OAT − ISA)
σ   = max(0.5, 1 − DA × 6.87559×10⁻⁶)
```

### CG Computation
```
LEMAC   = fuselage_length × 0.30
station = LEMAC + (fraction_of_MAC × MAC)
moment  = mass × station
CG_m    = Σmoments / Σmass
CG_%MAC = (CG_m − LEMAC) / MAC × 100
```

### Great-Circle Distance
Haversine formula → nautical miles

---

## Development Approach

Built using **Windsurf** (Codeium) as the primary IDE with Cascade AI for:
- Generating SwiftUI view structure and components
- Refactoring the FastAPI monolith into modular routers/services
- Cross-file type error resolution
- Unit conversion and physics formula implementation

Architecture decisions, domain modeling, and output validation
were made by the developer. AI used to accelerate implementation.

---

## Demo vs Production

| Item | Demo | Production fix |
|---|---|---|
| Auth | In-memory HMAC token | python-jose + refresh tokens |
| Users | Hardcoded dict | PostgreSQL + bcrypt |
| Flight storage | In-memory (lost on restart) | PostgreSQL flights table |
| W&B envelope | Generic 16–38% MAC | Aircraft-specific AFM data |
| TOD estimate | Simplified energy method | AFM performance tables |
| Airport database | 147 airports hardcoded | OurAirports CSV (70,000+) |

---

## Disclaimer

Performance values (V2, TOD, fuel burn, CG position) are computed from
OpenAP aerodynamic models and are estimates for demonstration purposes only.
**Not certified for use in actual flight operations.**
Always use AFM-certified performance data for real flights.

---

## Author

**Chirag Narkar**
MS Software Engineering — George Mason University
[github.com/chirag1207](https://github.com/chirag1207) |
[linkedin.com/in/chiragnarkar](https://linkedin.com/in/chiragnarkar)
