"""System monitoring and job management API routes."""
import time
import psutil
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.database import (
    Dataset, DatasetVersion, Storm, StormObservation,
    ProcessingJob, JobStatus, MLModel
)
from app.schemas.api import APIResponse, JobOut, SystemStatus

router = APIRouter(prefix="/api/system", tags=["system"])

_start_time = time.time()


@router.get("/status", response_model=APIResponse)
async def get_system_status(db: AsyncSession = Depends(get_db)):
    """Get current system resource usage and platform statistics."""
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    dataset_count = (await db.execute(select(func.count(DatasetVersion.id)))).scalar() or 0
    storm_count = (await db.execute(select(func.count(Storm.id)))).scalar() or 0
    model_count = (await db.execute(select(func.count(MLModel.id)))).scalar() or 0
    active_jobs = (await db.execute(
        select(func.count(ProcessingJob.id))
        .where(ProcessingJob.status.in_([JobStatus.QUEUED, JobStatus.RUNNING]))
    )).scalar() or 0

    status = SystemStatus(
        cpu_percent=cpu,
        memory_percent=mem.percent,
        memory_used_gb=round(mem.used / (1024**3), 2),
        memory_total_gb=round(mem.total / (1024**3), 2),
        disk_used_gb=round(disk.used / (1024**3), 2),
        disk_total_gb=round(disk.total / (1024**3), 2),
        dataset_count=dataset_count,
        storm_count=storm_count,
        model_count=model_count,
        active_jobs=active_jobs,
        uptime_seconds=round(time.time() - _start_time, 0),
    )

    return APIResponse(success=True, data=status.model_dump())


@router.get("/jobs", response_model=APIResponse)
async def list_jobs(
    status: str = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List processing jobs with optional status filter."""
    query = select(ProcessingJob).order_by(desc(ProcessingJob.created_at)).limit(limit)
    if status:
        try:
            job_status = JobStatus(status)
            query = query.where(ProcessingJob.status == job_status)
        except ValueError:
            pass

    result = await db.execute(query)
    jobs = result.scalars().all()

    return APIResponse(
        success=True,
        data=[JobOut.model_validate(j).model_dump() for j in jobs]
    )


@router.get("/jobs/{job_id}", response_model=APIResponse)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """Get details for a specific job."""
    job = await db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    return APIResponse(
        success=True,
        data=JobOut.model_validate(job).model_dump()
    )


@router.post("/jobs/{job_id}/cancel", response_model=APIResponse)
async def cancel_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """Cancel a queued or running job."""
    job = await db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
        raise HTTPException(400, f"Cannot cancel job with status '{job.status.value}'")

    job.status = JobStatus.CANCELLED
    job.completed_at = datetime.utcnow()
    await db.commit()

    return APIResponse(success=True, message="Job cancelled")


@router.get("/storage", response_model=APIResponse)
async def get_storage_info():
    """Get storage directory sizes."""
    from app.core.config import settings
    import os

    def dir_size(path):
        total = 0
        if path.exists():
            for f in path.rglob("*"):
                if f.is_file():
                    total += f.stat().st_size
        return total

    return APIResponse(
        success=True,
        data={
            "raw_storage_mb": round(dir_size(settings.RAW_STORAGE) / (1024**2), 2),
            "processed_storage_mb": round(dir_size(settings.PROCESSED_STORAGE) / (1024**2), 2),
            "parquet_storage_mb": round(dir_size(settings.PARQUET_STORAGE) / (1024**2), 2),
            "satellite_storage_mb": round(dir_size(settings.SATELLITE_STORAGE) / (1024**2), 2),
            "model_storage_mb": round(dir_size(settings.MODEL_STORAGE) / (1024**2), 2),
        }
    )
