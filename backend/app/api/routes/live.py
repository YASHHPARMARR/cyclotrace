"""
CycloTrack — Live Cyclone Intelligence API Routes

Endpoints for the live observation & prediction module. These are
independent from the historical pipeline routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.live_cyclone_service import LiveCycloneService

router = APIRouter(prefix="/api/live", tags=["Live Cyclone Intelligence"])


# ─── Dashboard & Summary ────────────────────────────────────────────────────

@router.get("/dashboard")
async def live_dashboard(db: AsyncSession = Depends(get_db)):
    """Get live module dashboard summary (active storms, source health, etc.)."""
    summary = await LiveCycloneService.get_live_dashboard_summary(db)
    return {"success": True, "data": summary}


# ─── Source Management ──────────────────────────────────────────────────────

@router.get("/sources")
async def list_sources(db: AsyncSession = Depends(get_db)):
    """Get status of all configured data sources."""
    sources = await LiveCycloneService.get_all_source_status(db)
    return {"success": True, "data": sources}


@router.post("/sources/initialize")
async def initialize_sources(db: AsyncSession = Depends(get_db)):
    """Seed/initialize known data source configurations."""
    await LiveCycloneService.initialize_sources(db)
    sources = await LiveCycloneService.get_all_source_status(db)
    return {"success": True, "message": "Sources initialized", "data": sources}


# ─── Data Ingestion ─────────────────────────────────────────────────────────

@router.post("/ingest/user-data")
async def ingest_user_data(db: AsyncSession = Depends(get_db)):
    """
    Ingest storms from user-uploaded historical datasets into the live module.
    This makes the system functional even without external API access.
    """
    result = await LiveCycloneService.ingest_from_user_data(db)
    return {
        "success": result.get("status") != "failed",
        "message": f"Ingested {result.get('observations_ingested', 0)} observations from {result.get('storms_found', 0)} storms",
        "data": result,
    }


# ─── Live Storm Queries ────────────────────────────────────────────────────

@router.get("/storms")
async def list_live_storms(
    status: str = None,
    basin: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all live-tracked storms with observations and latest prediction."""
    storms = await LiveCycloneService.get_live_storms(db, status=status, basin=basin)
    return {"success": True, "data": storms}


@router.get("/storms/{storm_id}")
async def get_live_storm(storm_id: int, db: AsyncSession = Depends(get_db)):
    """Get detailed data for a specific live storm."""
    detail = await LiveCycloneService.get_live_storm_detail(db, storm_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Live storm not found")
    return {"success": True, "data": detail}


# ─── Prediction on Live Storms ──────────────────────────────────────────────

@router.post("/storms/{storm_id}/predict")
async def predict_live_storm(
    storm_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Run the existing AI/ML prediction engine on a live storm.
    Creates a new prediction run record (append-only).
    """
    result = await LiveCycloneService.run_prediction_for_live_storm(db, storm_id)
    if not result:
        raise HTTPException(status_code=404, detail="Storm not found or insufficient data")
    if "error" in result:
        return {"success": False, "message": result["error"], "data": None}
    return {"success": True, "data": result}


@router.get("/storms/{storm_id}/predictions")
async def get_prediction_history(
    storm_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get all past prediction runs for a live storm."""
    history = await LiveCycloneService.get_prediction_history(db, storm_id, limit)
    return {"success": True, "data": history}


# ─── Bulk predict all active storms ─────────────────────────────────────────

@router.post("/predict-all")
async def predict_all_active(db: AsyncSession = Depends(get_db)):
    """Run predictions on ALL active live storms."""
    storms = await LiveCycloneService.get_live_storms(db, status="active")
    results = []
    for storm in storms:
        try:
            pred = await LiveCycloneService.run_prediction_for_live_storm(db, storm["id"])
            results.append({
                "storm_id": storm["storm_id"],
                "name": storm["name"],
                "success": pred is not None and "error" not in pred,
            })
        except Exception as e:
            results.append({
                "storm_id": storm["storm_id"],
                "name": storm["name"],
                "success": False,
                "error": str(e),
            })
    return {
        "success": True,
        "message": f"Ran predictions on {len(results)} storms",
        "data": results,
    }
