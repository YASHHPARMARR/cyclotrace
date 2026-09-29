"""SQLAlchemy ORM models for the CycloTrack platform."""
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, JSON, Boolean,
    Enum, ForeignKey, BigInteger, Index
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class DatasetStatus(str, enum.Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    VALIDATING = "validating"
    NORMALIZING = "normalizing"
    INDEXING = "indexing"
    VALIDATED = "validated"
    FAILED = "failed"
    ARCHIVED = "archived"


class DatasetRole(str, enum.Enum):
    TRAINING = "training"
    VALIDATION = "validation"
    TEST = "test"
    REFERENCE = "reference"
    OBSERVATION = "observation"


class JobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ModelStatus(str, enum.Enum):
    CANDIDATE = "candidate"
    VALIDATED = "validated"
    PRODUCTION = "production"
    ARCHIVED = "archived"


# ─── Datasets ────────────────────────────────────────────────────────────────

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("DatasetVersion", back_populates="dataset", lazy="selectin")


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    file_name = Column(String(500), nullable=False)
    original_file_path = Column(String(1000), nullable=False)
    processed_file_path = Column(String(1000), default=None)
    parquet_file_path = Column(String(1000), default=None)
    file_size_bytes = Column(BigInteger, default=0)
    file_format = Column(String(50), nullable=False)
    row_count = Column(BigInteger, default=0)
    column_count = Column(Integer, default=0)
    detected_columns = Column(JSON, default=list)
    data_types = Column(JSON, default=dict)
    schema_mapping = Column(JSON, default=dict)
    status = Column(Enum(DatasetStatus), default=DatasetStatus.UPLOADING)
    role = Column(Enum(DatasetRole), default=DatasetRole.OBSERVATION)
    in_training_pool = Column(Boolean, default=False)
    upload_time = Column(DateTime, default=datetime.utcnow)
    processing_time_seconds = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Quality metrics
    valid_rows = Column(BigInteger, default=0)
    warning_rows = Column(BigInteger, default=0)
    rejected_rows = Column(BigInteger, default=0)
    missing_values_count = Column(BigInteger, default=0)
    duplicate_count = Column(BigInteger, default=0)
    quality_score = Column(Float, default=0.0)
    quality_report = Column(JSON, default=dict)

    # Sample data for preview
    sample_rows = Column(JSON, default=list)
    column_statistics = Column(JSON, default=dict)

    dataset = relationship("Dataset", back_populates="versions")

    __table_args__ = (
        Index("ix_dataset_version", "dataset_id", "version", unique=True),
    )


# ─── Storms ──────────────────────────────────────────────────────────────────

class Storm(Base):
    __tablename__ = "storms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    storm_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), default="UNNAMED")
    season = Column(Integer, index=True)
    basin = Column(String(50), index=True)
    sub_basin = Column(String(50))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_hours = Column(Float)
    max_wind = Column(Float)
    min_pressure = Column(Float)
    num_observations = Column(Integer, default=0)
    track_length_km = Column(Float)
    dataset_version_id = Column(Integer, ForeignKey("dataset_versions.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    observations = relationship("StormObservation", back_populates="storm", lazy="selectin")


class StormObservation(Base):
    __tablename__ = "storm_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    storm_id_ref = Column(Integer, ForeignKey("storms.id"), nullable=False, index=True)
    storm_serial = Column(String(100), index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    wind_speed = Column(Float)
    pressure = Column(Float)
    storm_speed = Column(Float)
    storm_direction = Column(Float)
    basin = Column(String(50))
    sub_basin = Column(String(50))
    nature = Column(String(50))
    extra_data = Column(JSON, default=dict)

    storm = relationship("Storm", back_populates="observations")

    __table_args__ = (
        Index("ix_obs_storm_time", "storm_id_ref", "timestamp"),
    )


# ─── Processing Jobs ────────────────────────────────────────────────────────

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String(100), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED)
    dataset_version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=True)
    progress = Column(Float, default=0.0)
    total_items = Column(BigInteger, default=0)
    processed_items = Column(BigInteger, default=0)
    error_message = Column(Text, default=None)
    result = Column(JSON, default=dict)
    started_at = Column(DateTime, default=None)
    completed_at = Column(DateTime, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    logs = Column(Text, default="")


# ─── Training ───────────────────────────────────────────────────────────────

class TrainingDataset(Base):
    __tablename__ = "training_datasets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500), nullable=False)
    version = Column(Integer, default=1)
    included_dataset_versions = Column(JSON, default=list)
    total_storms = Column(Integer, default=0)
    total_observations = Column(BigInteger, default=0)
    train_storms = Column(Integer, default=0)
    val_storms = Column(Integer, default=0)
    test_storms = Column(Integer, default=0)
    train_rows = Column(BigInteger, default=0)
    val_rows = Column(BigInteger, default=0)
    test_rows = Column(BigInteger, default=0)
    feature_config = Column(JSON, default=dict)
    split_config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class TrainingRun(Base):
    __tablename__ = "training_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500))
    training_dataset_id = Column(Integer, ForeignKey("training_datasets.id"))
    model_type = Column(String(100))
    target_variable = Column(String(100))
    hyperparameters = Column(JSON, default=dict)
    feature_set = Column(JSON, default=list)
    input_window_hours = Column(Integer, default=24)
    forecast_horizon_hours = Column(Integer, default=24)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED)
    progress = Column(Float, default=0.0)
    metrics = Column(JSON, default=dict)
    started_at = Column(DateTime, default=None)
    completed_at = Column(DateTime, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── Model Registry ─────────────────────────────────────────────────────────

class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(String(200), unique=True, nullable=False)
    name = Column(String(500))
    version = Column(Integer, default=1)
    model_type = Column(String(100))
    architecture = Column(String(200))
    training_run_id = Column(Integer, ForeignKey("training_runs.id"))
    training_dataset_version = Column(String(200))
    feature_version = Column(String(200))
    model_file_path = Column(String(1000))
    hyperparameters = Column(JSON, default=dict)
    metrics = Column(JSON, default=dict)
    status = Column(Enum(ModelStatus), default=ModelStatus.CANDIDATE)
    training_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── Predictions ─────────────────────────────────────────────────────────────

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(Integer, ForeignKey("ml_models.id"))
    storm_id_ref = Column(Integer, ForeignKey("storms.id"), nullable=True)
    storm_serial = Column(String(100))
    prediction_time = Column(DateTime)
    horizon_hours = Column(Integer)
    predicted_lat = Column(Float)
    predicted_lon = Column(Float)
    predicted_wind = Column(Float)
    predicted_pressure = Column(Float)
    confidence = Column(Float)
    uncertainty_km = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class ForecastComparison(Base):
    __tablename__ = "forecast_comparisons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"))
    storm_serial = Column(String(100))
    horizon_hours = Column(Integer)
    ai_lat = Column(Float)
    ai_lon = Column(Float)
    ai_wind = Column(Float)
    ai_pressure = Column(Float)
    official_lat = Column(Float)
    official_lon = Column(Float)
    official_wind = Column(Float)
    official_pressure = Column(Float)
    actual_lat = Column(Float)
    actual_lon = Column(Float)
    actual_wind = Column(Float)
    actual_pressure = Column(Float)
    ai_error_km = Column(Float)
    official_error_km = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── System Logs ─────────────────────────────────────────────────────────────

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    level = Column(String(20), default="INFO")
    module = Column(String(100))
    message = Column(Text)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
