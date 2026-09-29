"""Pydantic schemas for API request/response contracts."""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# ─── Generic ─────────────────────────────────────────────────────────────────

class APIResponse(BaseModel):
    success: bool = True
    message: str = ""
    data: Any = None


class PaginatedResponse(BaseModel):
    items: list = []
    total: int = 0
    page: int = 1
    page_size: int = 50
    total_pages: int = 0


# ─── Dataset Schemas ─────────────────────────────────────────────────────────

class DatasetCreate(BaseModel):
    name: str
    description: str = ""


class DatasetVersionOut(BaseModel):
    id: int
    dataset_id: int
    version: int
    file_name: str
    file_size_bytes: int
    file_format: str
    row_count: int
    column_count: int
    detected_columns: list
    data_types: dict
    schema_mapping: dict
    status: str
    role: str
    in_training_pool: bool
    upload_time: Optional[datetime]
    processing_time_seconds: float
    valid_rows: int
    warning_rows: int
    rejected_rows: int
    missing_values_count: int
    duplicate_count: int
    quality_score: float
    quality_report: dict
    sample_rows: list
    column_statistics: dict
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DatasetOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    versions: list[DatasetVersionOut] = []

    class Config:
        from_attributes = True


class SchemaMapping(BaseModel):
    """User-provided field mapping overrides."""
    mapping: dict[str, str] = Field(
        default_factory=dict,
        description="Map of detected_column_name -> system_field_name"
    )


class DatasetRoleUpdate(BaseModel):
    role: str
    in_training_pool: bool = False


# ─── Storm Schemas ───────────────────────────────────────────────────────────

class StormOut(BaseModel):
    id: int
    storm_id: str
    name: str
    season: Optional[int]
    basin: Optional[str]
    sub_basin: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration_hours: Optional[float]
    max_wind: Optional[float]
    min_pressure: Optional[float]
    num_observations: int
    track_length_km: Optional[float]

    class Config:
        from_attributes = True


class StormObservationOut(BaseModel):
    id: int
    timestamp: Optional[datetime]
    latitude: Optional[float]
    longitude: Optional[float]
    wind_speed: Optional[float]
    pressure: Optional[float]
    storm_speed: Optional[float]
    storm_direction: Optional[float]
    basin: Optional[str]
    nature: Optional[str]
    extra_data: dict = {}

    class Config:
        from_attributes = True


class StormFilter(BaseModel):
    season: Optional[int] = None
    basin: Optional[str] = None
    name: Optional[str] = None
    min_wind: Optional[float] = None
    max_wind: Optional[float] = None
    min_pressure: Optional[float] = None
    max_pressure: Optional[float] = None
    page: int = 1
    page_size: int = 50


# ─── Job Schemas ─────────────────────────────────────────────────────────────

class JobOut(BaseModel):
    id: int
    job_type: str
    status: str
    dataset_version_id: Optional[int]
    progress: float
    total_items: int
    processed_items: int
    error_message: Optional[str]
    result: dict
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── System Schemas ──────────────────────────────────────────────────────────

class SystemStatus(BaseModel):
    cpu_percent: float
    memory_percent: float
    memory_used_gb: float
    memory_total_gb: float
    disk_used_gb: float
    disk_total_gb: float
    dataset_count: int
    storm_count: int
    model_count: int
    active_jobs: int
    uptime_seconds: float


class TrainingPoolOut(BaseModel):
    included: list[DatasetVersionOut] = []
    excluded: list[DatasetVersionOut] = []
