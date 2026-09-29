"""
CycloTrack — Machine Learning & Prediction API Routes
"""
import io
import csv
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.db.session import get_db, AsyncSessionLocal
from app.models.database import (
    MLModel, TrainingRun, Prediction, Storm, JobStatus
)
from app.schemas.api import APIResponse
from app.services.ml_service import MLService

router = APIRouter(prefix="/api/ml", tags=["Machine Learning & Predictions"])


@router.get("/models", response_model=APIResponse)
async def list_models(db: AsyncSession = Depends(get_db)):
    """List all registered ML models."""
    res = await db.execute(select(MLModel).order_by(MLModel.created_at.desc()))
    models = res.scalars().all()

    items = [
        {
            "id": m.id,
            "model_id": m.model_id,
            "name": m.name,
            "version": m.version,
            "model_type": m.model_type,
            "architecture": m.architecture,
            "metrics": m.metrics or {},
            "status": m.status.value if hasattr(m.status, 'value') else m.status,
            "training_date": m.training_date.isoformat() if m.training_date else None,
        }
        for m in models
    ]
    return APIResponse(data=items)


@router.post("/train", response_model=APIResponse)
async def trigger_training(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Trigger background ML model training on uploaded datasets."""
    name = payload.get("name", "XGBoost Cyclone Trajectory Model")
    model_type = payload.get("model_type", "xgboost")
    horizon = payload.get("forecast_horizon_hours", 24)
    dataset_versions = payload.get("dataset_version_ids", [])

    run = TrainingRun(
        name=name,
        model_type=model_type,
        target_variable="trajectory_and_intensity",
        forecast_horizon_hours=horizon,
        status=JobStatus.QUEUED,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    async def run_bg_training(run_id: int, versions: list, m_type: str, h: int):
        async with AsyncSessionLocal() as bg_db:
            await MLService.prepare_features_and_train(bg_db, run_id, versions, m_type, h)

    background_tasks.add_task(run_bg_training, run.id, dataset_versions, model_type, horizon)

    return APIResponse(
        message=f"Training job '{name}' queued successfully.",
        data={"training_run_id": run.id, "status": "queued"}
    )


@router.post("/quick-train", response_model=APIResponse)
async def quick_train_model(
    payload: dict = Body(default={}),
    db: AsyncSession = Depends(get_db)
):
    """Synchronously train and register an ML model on all available storm data."""
    model_type = payload.get("model_type", "xgboost")
    result = await MLService.quick_train(db, model_type=model_type)
    return APIResponse(
        message=f"Model trained and registered successfully.",
        data=result
    )


@router.get("/runs", response_model=APIResponse)
async def list_training_runs(db: AsyncSession = Depends(get_db)):
    """List recent training runs."""
    res = await db.execute(select(TrainingRun).order_by(TrainingRun.created_at.desc()).limit(20))
    runs = res.scalars().all()
    return APIResponse(data=[
        {
            "id": r.id,
            "name": r.name,
            "model_type": r.model_type,
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "progress": r.progress,
            "metrics": r.metrics or {},
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ])


@router.get("/runs/{run_id}", response_model=APIResponse)
async def get_training_run(run_id: int, db: AsyncSession = Depends(get_db)):
    """Get status and metrics of a training run."""
    res = await db.execute(select(TrainingRun).where(TrainingRun.id == run_id))
    run = res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Training run not found")

    return APIResponse(data={
        "id": run.id,
        "name": run.name,
        "model_type": run.model_type,
        "status": run.status.value if hasattr(run.status, 'value') else run.status,
        "progress": run.progress,
        "metrics": run.metrics or {},
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    })


@router.post("/predict", response_model=APIResponse)
async def predict_storm(
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    """Generate future forecast trajectory and intensity for a storm in the database."""
    storm_id = payload.get("storm_id")
    model_id = payload.get("model_id")
    horizons = payload.get("horizons", [6, 12, 24, 48, 72, 120])

    if not storm_id:
        raise HTTPException(status_code=400, detail="storm_id is required")

    result = await MLService.generate_prediction(db, storm_id=int(storm_id), model_id=model_id, horizons=horizons)
    if result is None:
        raise HTTPException(status_code=404, detail="Storm or observations not found")

    return APIResponse(message="Predictions generated successfully.", data=result)


@router.get("/predictions/storm/{storm_id}", response_model=APIResponse)
async def get_storm_predictions(storm_id: int, db: AsyncSession = Depends(get_db)):
    """Get previously generated predictions for a storm."""
    res = await db.execute(
        select(Prediction)
        .where(Prediction.storm_id_ref == storm_id)
        .order_by(Prediction.created_at.desc(), Prediction.horizon_hours.asc())
        .limit(20)
    )
    preds = res.scalars().all()
    return APIResponse(data=[
        {
            "id": p.id,
            "horizon_hours": p.horizon_hours,
            "prediction_time": p.prediction_time.isoformat() if p.prediction_time else None,
            "predicted_lat": p.predicted_lat,
            "predicted_lon": p.predicted_lon,
            "predicted_wind": p.predicted_wind,
            "predicted_pressure": p.predicted_pressure,
            "confidence": p.confidence,
            "uncertainty_km": p.uncertainty_km,
        }
        for p in preds
    ])


@router.get("/predict-upcoming", response_model=APIResponse)
@router.post("/predict-upcoming", response_model=APIResponse)
async def predict_upcoming(db: AsyncSession = Depends(get_db)):
    """
    Predict upcoming cyclones and cyclogenesis risk based on uploaded dataset history:
    - Active storm forward forecasts
    - Climatological cyclogenesis hotspots
    - Probability and expected formation date window of the next cyclone
    - Precursor disturbance alerts
    """
    result = await MLService.predict_upcoming_cyclones(db)
    return APIResponse(
        message="Upcoming cyclone and cyclogenesis risk prediction generated.",
        data=result
    )


@router.post("/predict-custom", response_model=APIResponse)
async def predict_custom_csv_or_points(payload: dict):
    """
    Instantly predict cyclone trajectory and intensity from raw user CSV text or points:
    Expects payload:
    {
      "csv_text": "LAT,LON,WIND,PRES,TIME\\n21.1,-85.2,35,1005,2023-08-26 12:00:00\\n...",
      OR
      "points": [{"lat": 21.1, "lon": -85.2, "wind": 35, "pres": 1005}, ...],
      "storm_name": "My Custom Cyclone",
      "horizons": [6, 12, 24, 48, 72]
    }
    """
    points = payload.get("points")
    csv_text = payload.get("csv_text")
    storm_name = payload.get("storm_name", "Custom Cyclone")
    horizons = payload.get("horizons", [6, 12, 24, 48, 72, 120])

    if not points and csv_text:
        # Parse CSV text
        points = []
        try:
            reader = csv.DictReader(io.StringIO(csv_text.strip()))
            for row in reader:
                # normalize keys to lowercase
                low_row = {k.strip().lower(): v.strip() for k, v in row.items() if k and v}
                lat = float(low_row.get("lat") or low_row.get("latitude") or 0.0)
                lon = float(low_row.get("lon") or low_row.get("longitude") or 0.0)
                wind = float(low_row.get("wind") or low_row.get("wind_speed") or low_row.get("wmo_wind") or 35.0)
                pres = float(low_row.get("pres") or low_row.get("pressure") or low_row.get("wmo_pres") or 1000.0)
                time_val = low_row.get("time") or low_row.get("iso_time") or low_row.get("timestamp") or datetime.utcnow().isoformat()
                points.append({"lat": lat, "lon": lon, "wind": wind, "pres": pres, "time": time_val})
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse CSV text: {e}")

    if not points:
        raise HTTPException(status_code=400, detail="Either 'points' array or 'csv_text' string must be provided.")

    try:
        res = MLService.predict_from_custom_data(track_points=points, storm_name=storm_name, horizons=horizons)
        return APIResponse(message="Custom prediction generated successfully.", data=res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
