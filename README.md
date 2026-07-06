# APG Flight Operations — Portfolio Project

Mirrors the core features of **iPreFlight Genesis PRO** by Aircraft Performance Group.

## Features
1. **Flight Planning** — Enter departure/destination, aircraft, cruise params → get computed EET, fuel breakdown, TOW/LW/ZFW, weather at both airports
2. **Runway Analysis** — Enter airport ICAO + mass → live METAR fetched, density altitude, V2, takeoff thrust, headwind/crosswind components, wind rose
3. **Weight & Balance** — Full W&B solution with CG journey (OEW → ZFW → TOW → LW), envelope chart, % MAC CG for each state

## Data Sources
- **OpenAP** (`pip install openap`) — real aircraft aerodynamic models: thrust, drag, fuel flow, emissions
- **aviationweather.gov** — live METARs, free, no API key
- **JWT auth** — same login works on web and iOS

## Demo Login
```
Email:    pilot@apg.com
Password: demo1234
```

---

## Backend (Python / FastAPI)

```bash
cd backend
pip install openap fastapi uvicorn python-jose passlib bcrypt requests
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Key endpoints
| Method | Path                               | Description                          |
|--------|------------------------------------|--------------------------------------|
| POST   | /api/auth/login                    | Login → JWT token                    |
| GET    | /api/aircraft                      | List all 37 OpenAP aircraft          |
| POST   | /api/flights                       | Create flight plan (full computation)|
| GET    | /api/flights                       | List pilot's flights                 |
| GET    | /api/runway/{icao}                 | Runway analysis with live METAR      |
| POST   | /api/wb                            | Weight & balance computation         |
| GET    | /api/performance/fuel/{ac_type}    | Fuel flow curve (recharts data)      |
| GET    | /api/performance/thrust/{ac_type}  | Thrust curve by altitude             |

---

## Web Frontend (React / Vite)

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Start backend first — Vite proxies /api to localhost:8000.

### Stack
- React 18 + Vite — CSS Modules for styling
- Recharts — fuel flow curves, CG envelope scatter chart
- Dark aviation theme (#0D1117 base, #F97316 APG orange accent)

---

## iOS App (SwiftUI)

**Requires Mac + Xcode 15+**

1. Create new Xcode project → App → SwiftUI, iOS 17+
2. Copy all `.swift` files from `ios/` folder into the project
3. Add named colors per `ColorAssets.md` to Assets.xcassets
4. In `APGService.swift`, update `BASE_URL` to your deployed backend
5. Build and run

### Swift files
- `APGApp.swift` — App entry, auth routing
- `Models.swift` — All Codable models (matches backend exactly)
- `APGService.swift` — Networking layer
- `AppState.swift` — ObservableObject state
- `Views.swift` — Login, tab shell, shared UI components
- `FlightPlanningView.swift` — Flight plan tab
- `RunwayAndWB.swift` — Runway analysis + W&B tabs

---

## Deployment (Free Tier)

**Backend** → Railway.app or Render.com (connect GitHub, auto-deploy)

**Frontend** → Vercel (connect GitHub, set `VITE_API_BASE` env var to backend URL, update vite proxy)

**iOS** → Update `BASE_URL` in `APGService.swift` to deployed backend URL

---

## Interview Talking Points

**Architecture:**
- Backend is a domain computation layer — not just a CRUD API. It uses OpenAP's physics models to compute real aerodynamic outputs, adds a weather enrichment layer, and returns aviation-standard quantities (lb, kt, %MAC, inHg)
- JWT auth is stateless — same token works on web and iOS. Token is stored in localStorage (web) and UserDefaults (iOS)
- All computation happens server-side so the iOS app and web app always return identical results for the same inputs

**OpenAP usage:**
- `Thrust(ac_type).takeoff(tas, alt)` → corrected for density altitude via σ
- `FuelFlow(ac_type).enroute(mass, tas, alt, vs)` → real fuel flow per segment
- `Emission(ac_type).co2(ff)` → CO₂ output for briefing
- `aircraft(ac_type)` → MTOW, MLW, OEW, MAC, wing area for W&B

**iOS/Web parity:**
- `Models.swift` mirrors the FastAPI Pydantic models exactly
- `APGService.swift` mirrors `src/utils/api.js` exactly
- Both platforms share the same JWT token (pilot can log in on web, then use the same account on iOS)
