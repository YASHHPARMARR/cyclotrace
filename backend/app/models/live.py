"""
CycloTrack — Live Cyclone Intelligence Module: Database Models

Stores real-time cyclone observations, source status, ingestion metadata,
and rolling prediction runs. These tables are independent from the
historical/training pipeline and never overwrite old observations.
"""
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, JSON, Boolean,
    Enum, ForeignKey, BigInteger, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.db.session import Base


# ─── Enums ───────────────────────────────────────────────────────────────────

class LiveStormStatus(str, enum.Enum):
    ACTIVE = "active"
    POST_TROPICAL = "post_tropical"
    DISSIPATED = "dissipated"
    INVEST = "invest"


class SourceState(str, enum.Enum):
    CONNECTED = "connected"
    STALE = "stale"
    AUTH_REQUIRED = "auth_required"
    UNAVAILABLE = "unavailable"
    UNTESTED = "untested"


class IngestionState(str, enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


# ─── Live Storms ─────────────────────────────────────────────────────────────

class LiveStorm(Base):
    """
    A currently-active or recently-active cyclone tracked by the live module.
    Each row is created when a new storm is first detected from any source.
    """
    __tablename__ = "live_storms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    storm_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), default="UNNAMED")
    basin = Column(String(50), index=True)
    sub_basin = Column(String(50))
    status = Column(Enum(LiveStormStatus), default=LiveStormStatus.ACTIVE, index=True)

    # Latest known position (cache for fast dashboard queries)
    latest_lat = Column(Float)
    latest_lon = Column(Float)
    latest_wind_kts = Column(Float)
    latest_pressure_hpa = Column(Float)
    latest_category = Column(String(20))
    latest_observation_time = Column(DateTime)

    # Lifecycle
    first_detected_at = Column(DateTime, default=datetime.utcnow)
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Source tracking
    primary_source = Column(String(50))  # e.g. "imd", "jtwc", "nhc"
    source_storm_id = Column(String(200))  # Original ID from the source

    observations = relationship("LiveObservation", back_populates="storm", lazy="selectin",
                                order_by="LiveObservation.observation_time.asc()")
    prediction_runs = relationship("LivePredictionRun", back_populates="storm", lazy="dynamic")


# ─── Live Observations ───────────────────────────────────────────────────────

class LiveObservation(Base):
    """
    Each row is a single observation from a data source at a specific time.
    Observations are NEVER overwritten — they are append-only historical evidence.
    """
    __tablename__ = "live_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    storm_id = Column(Integer, ForeignKey("live_storms.id"), nullable=False, index=True)

    # Source metadata — "never pretend retrieval time is observation time"
    source = Column(String(50), nullable=False)  # "imd", "jtwc", "nhc", "gfs"
    source_observation_id = Column(String(200))  # Dedup key from source
    observation_time = Column(DateTime, nullable=False, index=True)  # Actual met observation time
    retrieval_time = Column(DateTime, default=datetime.utcnow)  # When we fetched it

    # Core meteorological fields
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    wind_speed_kts = Column(Float)
    pressure_hpa = Column(Float)
    storm_speed_kts = Column(Float)
    storm_direction_deg = Column(Float)
    category = Column(String(20))

    # Extended data (source-specific fields preserved as JSON)
    extra_data = Column(JSON, default=dict)

    storm = relationship("LiveStorm", back_populates="observations")

    __table_args__ = (
        UniqueConstraint("storm_id", "source", "observation_time", name="uq_live_obs_dedup"),
        Index("ix_live_obs_storm_time", "storm_id", "observation_time"),
    )


# ─── Live Prediction Runs ───────────────────────────────────────────────────

class LivePredictionRun(Base):
    """
    Each time the AI model runs on a live storm, a new run record is created.
    This preserves the full history of rolling predictions.
    """
    __tablename__ = "live_prediction_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    storm_id = Column(Integer, ForeignKey("live_storms.id"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("ml_models.id"), nullable=True)

    run_time = Column(DateTime, default=datetime.utcnow, index=True)
    input_obs_count = Column(Integer, default=0)
    input_window_start = Column(DateTime)
    input_window_end = Column(DateTime)

    # Full prediction output (same format as generate_prediction)
    forecast_track = Column(JSON, default=list)  # List of forecast points
    summary = Column(JSON, default=dict)
    raw_output = Column(JSON, default=dict)  # Full prediction result for archival

    # Quality
    model_name = Column(String(200))
    confidence_avg = Column(Float)

    storm = relationship("LiveStorm", back_populates="prediction_runs")


# ─── Source Status ───────────────────────────────────────────────────────────

class SourceStatus(Base):
    """
    Tracks the health and connectivity of each external data source.
    """
    __tablename__ = "source_status"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(200))
    state = Column(Enum(SourceState), default=SourceState.UNTESTED)

    last_success_time = Column(DateTime)
    last_failure_time = Column(DateTime)
    last_error_message = Column(Text)
    total_requests = Column(Integer, default=0)
    total_failures = Column(Integer, default=0)
    total_observations_ingested = Column(BigInteger, default=0)

    # Config
    poll_interval_seconds = Column(Integer, default=600)  # 10 min default
    endpoint_url = Column(String(1000))
    requires_auth = Column(Boolean, default=False)
    auth_configured = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Ingestion Jobs ─────────────────────────────────────────────────────────

class IngestionJob(Base):
    """
    Audit trail for each data-fetch cycle.
    """
    __tablename__ = "ingestion_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_name = Column(String(50), nullable=False, index=True)
    state = Column(Enum(IngestionState), default=IngestionState.RUNNING)

    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    duration_seconds = Column(Float)

    storms_found = Column(Integer, default=0)
    observations_ingested = Column(Integer, default=0)
    observations_deduplicated = Column(Integer, default=0)
    predictions_triggered = Column(Integer, default=0)

    error_message = Column(Text)
    details = Column(JSON, default=dict)
