"""
main.py
Application entry point — wires together all routers and middleware.

To add a new feature:
  1. Create a service in services/
  2. Create a router in routers/
  3. Register the router here with app.include_router()

Run with:
  uvicorn main:app --reload --port 8000
"""
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, aircraft, flights, runway, wb, airports

app = FastAPI(
    title       = "AS Flight Operations API",
    description = "Aircraft Solutions — flight planning, runway analysis, and W&B",
    version     = "2.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS — allow all origins for local dev ────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(aircraft.router)
app.include_router(flights.router)
app.include_router(runway.router)
app.include_router(wb.router)
app.include_router(airports.router)

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health():
    return {
        "status":  "ok",
        "service": "AS Flight Operations API",
        "version": "2.0.0",
        "uptime":  round(time.time()),
    }
