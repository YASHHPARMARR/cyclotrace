"""
CycloTrack — Tropical Cyclone Intelligence & Forecast Validation Platform

Main FastAPI application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db.session import init_db
from app.api.routes import datasets, storms, system, ml, live
from app.models.live import *  # Ensure live tables are registered with Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="CycloTrack - Tropical Cyclone Intelligence Platform",
    description=(
        "AI/ML-based tropical cyclone analysis platform for ingesting historical datasets, "
        "training models, generating predictions, and validating against official forecasts. "
        "This is a research prototype — predictions are NOT official meteorological guidance."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(datasets.router)
app.include_router(storms.router)
app.include_router(ml.router)
app.include_router(system.router)
app.include_router(live.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "CycloTrack Backend",
        "version": "0.1.0",
    }
