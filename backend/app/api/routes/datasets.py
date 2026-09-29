"""Dataset management API routes."""
import os
import shutil
import asyncio
import time
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db, async_session_factory
from app.models.database import (
    Dataset, DatasetVersion, DatasetStatus, DatasetRole,
    ProcessingJob, JobStatus
)
from app.schemas.api import (
    APIResponse, DatasetOut, DatasetVersionOut, SchemaMapping,
    DatasetRoleUpdate, PaginatedResponse, TrainingPoolOut
)
from app.services.dataset_service import (
    process_csv_chunked, auto_map_schema, detect_data_types,
    compute_column_statistics, extract_storms_from_parquet
)

import pandas as pd
import numpy as np

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _sanitize_filename(filename: str) -> str:
    """Remove potentially dangerous characters from filename."""
    import re
    name = os.path.basename(filename)
    name = re.sub(r'[^\w\s\-\.]', '', name)
    return name[:200] if name else "unnamed_file"


def _validate_extension(filename: str) -> str:
    """Validate file extension against allowed list."""
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not supported. Allowed: {settings.ALLOWED_EXTENSIONS}")
    return ext


# ─── Upload ──────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=APIResponse)
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(""),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a dataset file. Supports CSV, XLSX, JSON, NetCDF, HDF, images, ZIP.
    Large files are streamed to disk, never fully held in memory.
    """
    filename = _sanitize_filename(file.filename or "unnamed")
    ext = _validate_extension(filename)

    dataset_name = name or Path(filename).stem
    
    # Check file size (stream to disk)
    safe_filename = f"{int(time.time())}_{filename}"
    raw_path = settings.RAW_STORAGE / safe_filename

    total_size = 0
    chunk_size_bytes = 1024 * 1024  # 1MB chunks

    with open(raw_path, "wb") as f:
        while True:
            chunk = await file.read(chunk_size_bytes)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                f.close()
                os.remove(raw_path)
                raise HTTPException(413, f"File exceeds max upload size of {settings.MAX_UPLOAD_SIZE_MB}MB")
            f.write(chunk)

    # Create or find dataset
    result = await db.execute(select(Dataset).where(Dataset.name == dataset_name))
    dataset = result.scalar_one_or_none()

    if dataset:
        # New version of existing dataset
        max_ver = await db.execute(
            select(func.max(DatasetVersion.version))
            .where(DatasetVersion.dataset_id == dataset.id)
        )
        next_version = (max_ver.scalar() or 0) + 1
    else:
        dataset = Dataset(name=dataset_name, description=description)
        db.add(dataset)
        await db.flush()
        next_version = 1

    # Create dataset version
    version = DatasetVersion(
        dataset_id=dataset.id,
        version=next_version,
        file_name=filename,
        original_file_path=str(raw_path),
        file_size_bytes=total_size,
        file_format=ext.lstrip("."),
        status=DatasetStatus.UPLOADING,
        upload_time=datetime.utcnow(),
    )
    db.add(version)
    await db.flush()

    # Create processing job
    job = ProcessingJob(
        job_type="dataset_processing",
        status=JobStatus.QUEUED,
        dataset_version_id=version.id,
        total_items=0,
    )
    db.add(job)
    await db.commit()

    # Start background processing based on file type
    if ext in [".csv", ".xlsx"]:
        background_tasks.add_task(_process_tabular_file, version.id, job.id, ext)
    else:
        # For non-tabular files, just mark as uploaded
        version.status = DatasetStatus.VALIDATED
        version.quality_score = 100.0
        job.status = JobStatus.COMPLETED
        job.progress = 100
        job.completed_at = datetime.utcnow()
        await db.commit()

    return APIResponse(
        success=True,
        message=f"Dataset '{dataset_name}' v{next_version} uploaded successfully. Processing started.",
        data={
            "dataset_id": dataset.id,
            "version_id": version.id,
            "version": next_version,
            "job_id": job.id,
            "file_size_bytes": total_size,
            "file_format": ext,
        }
    )


async def _process_tabular_file(version_id: int, job_id: int, ext: str):
    """Background task to process a tabular file."""
    async with async_session_factory() as db:
        try:
            version = await db.get(DatasetVersion, version_id)
            job = await db.get(ProcessingJob, job_id)

            if not version or not job:
                return

            file_path = Path(version.original_file_path)

            if ext == ".xlsx":
                # Convert XLSX to CSV first
                csv_path = file_path.with_suffix(".csv")
                df = pd.read_excel(file_path, engine="openpyxl")
                df.to_csv(csv_path, index=False)
                file_path = csv_path

            version.status = DatasetStatus.PROCESSING
            await db.commit()

            await process_csv_chunked(file_path, version, db, job)

            # Auto-extract storms if validated
            if version.status == DatasetStatus.VALIDATED and version.schema_mapping.get("storm_id"):
                extract_job = ProcessingJob(
                    job_type="storm_extraction",
                    status=JobStatus.QUEUED,
                    dataset_version_id=version.id,
                )
                db.add(extract_job)
                await db.commit()
                await extract_storms_from_parquet(version, db, extract_job)

        except Exception as e:
            import traceback
            traceback.print_exc()
            if version:
                version.status = DatasetStatus.FAILED
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(e)
                job.completed_at = datetime.utcnow()
            await db.commit()


# ─── List / Get ──────────────────────────────────────────────────────────────

@router.get("/", response_model=APIResponse)
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """List all datasets with their versions."""
    result = await db.execute(select(Dataset).order_by(desc(Dataset.created_at)))
    datasets = result.scalars().all()
    return APIResponse(
        success=True,
        data=[DatasetOut.model_validate(d).model_dump() for d in datasets]
    )


@router.get("/{dataset_id}", response_model=APIResponse)
async def get_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    """Get dataset details including all versions."""
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    return APIResponse(
        success=True,
        data=DatasetOut.model_validate(dataset).model_dump()
    )


@router.get("/version/{version_id}", response_model=APIResponse)
async def get_dataset_version(version_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific dataset version with full details."""
    version = await db.get(DatasetVersion, version_id)
    if not version:
        raise HTTPException(404, "Dataset version not found")
    return APIResponse(
        success=True,
        data=DatasetVersionOut.model_validate(version).model_dump()
    )


# ─── Preview ─────────────────────────────────────────────────────────────────

@router.get("/version/{version_id}/preview", response_model=APIResponse)
async def preview_dataset(
    version_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Preview dataset rows with pagination. Uses Parquet for speed if available."""
    version = await db.get(DatasetVersion, version_id)
    if not version:
        raise HTTPException(404, "Dataset version not found")

    import duckdb

    # Prefer Parquet, fall back to raw CSV
    if version.parquet_file_path and Path(version.parquet_file_path).exists():
        source = version.parquet_file_path.replace("\\", "/")
        read_fn = f"read_parquet('{source}')"
    elif Path(version.original_file_path).exists():
        source = version.original_file_path.replace("\\", "/")
        read_fn = f"read_csv_auto('{source}')"
    else:
        raise HTTPException(404, "Data file not found")

    con = duckdb.connect()
    offset = (page - 1) * page_size

    rows = con.execute(f"SELECT * FROM {read_fn} LIMIT {page_size} OFFSET {offset}").fetchdf()
    total = version.row_count or con.execute(f"SELECT COUNT(*) FROM {read_fn}").fetchone()[0]
    con.close()

    # Clean NaN/Inf values for JSON serialization
    rows = rows.replace({np.nan: None, np.inf: None, -np.inf: None})
    records = rows.to_dict(orient="records")

    return APIResponse(
        success=True,
        data={
            "rows": records,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, -(-total // page_size)),
        }
    )


# ─── Schema Mapping ─────────────────────────────────────────────────────────

@router.put("/version/{version_id}/mapping", response_model=APIResponse)
async def update_schema_mapping(
    version_id: int,
    mapping: SchemaMapping,
    db: AsyncSession = Depends(get_db),
):
    """Update the field mapping for a dataset version."""
    version = await db.get(DatasetVersion, version_id)
    if not version:
        raise HTTPException(404, "Dataset version not found")

    version.schema_mapping = mapping.mapping
    await db.commit()

    return APIResponse(
        success=True,
        message="Schema mapping updated",
        data=DatasetVersionOut.model_validate(version).model_dump()
    )


# ─── Role & Training Pool ───────────────────────────────────────────────────

@router.put("/version/{version_id}/role", response_model=APIResponse)
async def update_dataset_role(
    version_id: int,
    update: DatasetRoleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update dataset role and training pool inclusion."""
    version = await db.get(DatasetVersion, version_id)
    if not version:
        raise HTTPException(404, "Dataset version not found")

    try:
        version.role = DatasetRole(update.role)
    except ValueError:
        raise HTTPException(400, f"Invalid role: {update.role}")

    version.in_training_pool = update.in_training_pool
    await db.commit()

    return APIResponse(
        success=True,
        message=f"Dataset role updated to '{update.role}', training pool: {update.in_training_pool}",
        data=DatasetVersionOut.model_validate(version).model_dump()
    )


@router.get("/training-pool/status", response_model=APIResponse)
async def get_training_pool(db: AsyncSession = Depends(get_db)):
    """Get current training pool status."""
    included = await db.execute(
        select(DatasetVersion).where(DatasetVersion.in_training_pool == True)
    )
    excluded = await db.execute(
        select(DatasetVersion).where(DatasetVersion.in_training_pool == False)
    )

    return APIResponse(
        success=True,
        data=TrainingPoolOut(
            included=[DatasetVersionOut.model_validate(v) for v in included.scalars().all()],
            excluded=[DatasetVersionOut.model_validate(v) for v in excluded.scalars().all()],
        ).model_dump()
    )


# ─── Reprocess ───────────────────────────────────────────────────────────────

@router.post("/version/{version_id}/reprocess", response_model=APIResponse)
async def reprocess_dataset(
    version_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Re-run processing on an existing dataset version."""
    version = await db.get(DatasetVersion, version_id)
    if not version:
        raise HTTPException(404, "Dataset version not found")

    ext = f".{version.file_format}"
    job = ProcessingJob(
        job_type="dataset_reprocessing",
        status=JobStatus.QUEUED,
        dataset_version_id=version.id,
    )
    db.add(job)
    await db.commit()

    background_tasks.add_task(_process_tabular_file, version.id, job.id, ext)

    return APIResponse(
        success=True,
        message="Reprocessing started",
        data={"job_id": job.id}
    )


# ─── Delete ──────────────────────────────────────────────────────────────────

@router.delete("/{dataset_id}", response_model=APIResponse)
async def delete_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a dataset and all its versions (preserves raw files)."""
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # Delete versions
    versions = await db.execute(
        select(DatasetVersion).where(DatasetVersion.dataset_id == dataset_id)
    )
    for v in versions.scalars().all():
        await db.delete(v)

    await db.delete(dataset)
    await db.commit()

    return APIResponse(success=True, message=f"Dataset '{dataset.name}' deleted")
