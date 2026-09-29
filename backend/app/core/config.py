"""Core configuration for the CycloTrack backend."""
import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "CycloTrack - Tropical Cyclone Intelligence Platform"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./cyclotrack.db"

    # Storage paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    RAW_STORAGE: Path = STORAGE_DIR / "raw"
    PROCESSED_STORAGE: Path = STORAGE_DIR / "processed"
    PARQUET_STORAGE: Path = STORAGE_DIR / "parquet"
    SATELLITE_STORAGE: Path = STORAGE_DIR / "satellites"
    MODEL_STORAGE: Path = STORAGE_DIR / "models_store"
    MODELS_STORE: Path = STORAGE_DIR / "models_store"

    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 5000  # 5GB max
    CHUNK_SIZE: int = 50000  # rows per chunk for CSV processing
    ALLOWED_EXTENSIONS: list = [
        ".csv", ".xlsx", ".json", ".nc", ".hdf", ".hdf5", ".h5",
        ".tif", ".tiff", ".png", ".jpg", ".jpeg", ".zip"
    ]

    # Processing
    PARQUET_COMPRESSION: str = "snappy"
    MAX_PREVIEW_ROWS: int = 100
    MAX_SAMPLE_ROWS: int = 20

    class Config:
        env_file = ".env"


settings = Settings()

# Ensure storage directories exist
for dir_path in [
    settings.RAW_STORAGE,
    settings.PROCESSED_STORAGE,
    settings.PARQUET_STORAGE,
    settings.SATELLITE_STORAGE,
    settings.MODEL_STORAGE,
]:
    dir_path.mkdir(parents=True, exist_ok=True)
