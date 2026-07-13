"""
routers/wb.py
Weight & Balance endpoint.
Delegates all computation to services/wb.py.
"""
from fastapi import APIRouter, HTTPException, Depends

from dependencies import get_current_user
from models import WBRequest
from services.wb import compute_wb

router = APIRouter(prefix="/api/wb", tags=["Weight & Balance"])


@router.post("")
def weight_balance(req: WBRequest, _=Depends(get_current_user)):
    """
    Compute Weight & Balance solution for a given aircraft loading.
    Returns weights, CG (%MAC) for OEW/ZFW/TOW/LW states,
    envelope status, and chart-ready envelope_points.
    """
    try:
        return compute_wb(
            aircraft_type     = req.aircraft_type,
            crew              = req.crew,
            pax               = req.pax,
            cargo_lb          = req.cargo_lb,
            fuel_lb           = req.fuel_lb,
            crew_station_mac  = req.crew_station_mac,
            pax_station_mac   = req.pax_station_mac,
            cargo_station_mac = req.cargo_station_mac,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
