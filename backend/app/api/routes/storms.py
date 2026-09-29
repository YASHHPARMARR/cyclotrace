"""Storm data API routes — historical cyclone explorer."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, asc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.database import Storm, StormObservation
from app.schemas.api import APIResponse, StormOut, StormObservationOut, PaginatedResponse

router = APIRouter(prefix="/api/storms", tags=["storms"])


@router.get("/", response_model=APIResponse)
async def list_storms(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=500),
    season: int = None,
    basin: str = None,
    name: str = None,
    min_wind: float = None,
    max_wind: float = None,
    min_pressure: float = None,
    max_pressure: float = None,
    search: str = None,
    sort_by: str = "season",
    sort_dir: str = "desc",
    db: AsyncSession = Depends(get_db),
):
    """List storms with filtering, searching, and pagination."""
    query = select(Storm)
    count_query = select(func.count(Storm.id))

    filters = []
    if season:
        filters.append(Storm.season == season)
    if basin:
        filters.append(Storm.basin == basin)
    if name:
        filters.append(Storm.name.ilike(f"%{name}%"))
    if min_wind is not None:
        filters.append(Storm.max_wind >= min_wind)
    if max_wind is not None:
        filters.append(Storm.max_wind <= max_wind)
    if min_pressure is not None:
        filters.append(Storm.min_pressure >= min_pressure)
    if max_pressure is not None:
        filters.append(Storm.min_pressure <= max_pressure)
    if search:
        filters.append(
            or_(
                Storm.name.ilike(f"%{search}%"),
                Storm.storm_id.ilike(f"%{search}%"),
                Storm.basin.ilike(f"%{search}%"),
            )
        )

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    # Sorting
    sort_col = getattr(Storm, sort_by, Storm.season)
    order_fn = desc if sort_dir == "desc" else asc
    query = query.order_by(order_fn(sort_col))

    # Count
    total = (await db.execute(count_query)).scalar() or 0
    total_pages = max(1, -(-total // page_size))

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    storms = result.scalars().all()

    return APIResponse(
        success=True,
        data={
            "items": [StormOut.model_validate(s).model_dump() for s in storms],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    )


@router.get("/basins", response_model=APIResponse)
async def list_basins(db: AsyncSession = Depends(get_db)):
    """Get all unique basins."""
    result = await db.execute(
        select(Storm.basin, func.count(Storm.id))
        .where(Storm.basin.isnot(None))
        .group_by(Storm.basin)
        .order_by(desc(func.count(Storm.id)))
    )
    basins = [{"basin": row[0], "count": row[1]} for row in result.all()]
    return APIResponse(success=True, data=basins)


@router.get("/seasons", response_model=APIResponse)
async def list_seasons(db: AsyncSession = Depends(get_db)):
    """Get all unique seasons."""
    result = await db.execute(
        select(Storm.season, func.count(Storm.id))
        .where(Storm.season.isnot(None))
        .group_by(Storm.season)
        .order_by(desc(Storm.season))
    )
    seasons = [{"season": row[0], "count": row[1]} for row in result.all()]
    return APIResponse(success=True, data=seasons)


@router.get("/stats", response_model=APIResponse)
async def storm_stats(db: AsyncSession = Depends(get_db)):
    """Get aggregate storm statistics."""
    total = (await db.execute(select(func.count(Storm.id)))).scalar() or 0
    total_obs = (await db.execute(select(func.count(StormObservation.id)))).scalar() or 0

    result = await db.execute(select(
        func.min(Storm.season),
        func.max(Storm.season),
        func.avg(Storm.max_wind),
        func.min(Storm.min_pressure),
        func.avg(Storm.duration_hours),
        func.count(func.distinct(Storm.basin)),
    ))
    row = result.one()

    return APIResponse(
        success=True,
        data={
            "total_storms": total,
            "total_observations": total_obs,
            "season_range": [row[0], row[1]],
            "avg_max_wind": round(row[2], 1) if row[2] else None,
            "lowest_pressure": row[3],
            "avg_duration_hours": round(row[4], 1) if row[4] else None,
            "basin_count": row[5],
        }
    )


@router.get("/{storm_id}", response_model=APIResponse)
async def get_storm(storm_id: int, db: AsyncSession = Depends(get_db)):
    """Get detailed storm information."""
    storm = await db.get(Storm, storm_id)
    if not storm:
        raise HTTPException(404, "Storm not found")

    return APIResponse(
        success=True,
        data=StormOut.model_validate(storm).model_dump()
    )


@router.get("/{storm_id}/observations", response_model=APIResponse)
async def get_storm_observations(
    storm_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all observations for a storm, ordered by timestamp."""
    storm = await db.get(Storm, storm_id)
    if not storm:
        raise HTTPException(404, "Storm not found")

    result = await db.execute(
        select(StormObservation)
        .where(StormObservation.storm_id_ref == storm_id)
        .order_by(asc(StormObservation.timestamp))
    )
    observations = result.scalars().all()

    return APIResponse(
        success=True,
        data={
            "storm": StormOut.model_validate(storm).model_dump(),
            "observations": [
                StormObservationOut.model_validate(o).model_dump()
                for o in observations
            ]
        }
    )


@router.get("/{storm_id}/track", response_model=APIResponse)
async def get_storm_track(storm_id: int, db: AsyncSession = Depends(get_db)):
    """Get storm track coordinates for map visualization."""
    storm = await db.get(Storm, storm_id)
    if not storm:
        raise HTTPException(404, "Storm not found")

    result = await db.execute(
        select(
            StormObservation.latitude,
            StormObservation.longitude,
            StormObservation.wind_speed,
            StormObservation.pressure,
            StormObservation.timestamp,
        )
        .where(StormObservation.storm_id_ref == storm_id)
        .where(StormObservation.latitude.isnot(None))
        .where(StormObservation.longitude.isnot(None))
        .order_by(asc(StormObservation.timestamp))
    )
    points = [
        {
            "lat": row[0],
            "lon": row[1],
            "wind": row[2],
            "pressure": row[3],
            "time": row[4].isoformat() if row[4] else None,
        }
        for row in result.all()
    ]

    return APIResponse(
        success=True,
        data={
            "storm": StormOut.model_validate(storm).model_dump(),
            "track": points,
        }
    )


@router.get("/active/all", response_model=APIResponse)
async def get_active_storms(db: AsyncSession = Depends(get_db)):
    """Get active/recent cyclones from user data with latest positions and tracks for live map."""
    storms_res = await db.execute(select(Storm).order_by(desc(Storm.season), desc(Storm.id)).limit(10))
    storms = storms_res.scalars().all()

    active_items = []
    for s in storms:
        obs_res = await db.execute(
            select(StormObservation)
            .where(StormObservation.storm_id_ref == s.id)
            .where(StormObservation.latitude.isnot(None))
            .where(StormObservation.longitude.isnot(None))
            .order_by(asc(StormObservation.timestamp))
        )
        observations = obs_res.scalars().all()
        if not observations:
            continue

        latest = observations[-1]
        track = [
            {
                "lat": o.latitude,
                "lon": o.longitude,
                "wind": o.wind_speed,
                "pressure": o.pressure,
                "time": o.timestamp.isoformat() if o.timestamp else None,
            }
            for o in observations
        ]

        active_items.append({
            "id": s.id,
            "storm_id": s.storm_id,
            "name": s.name,
            "season": s.season,
            "basin": s.basin,
            "current_lat": latest.latitude,
            "current_lon": latest.longitude,
            "current_wind": latest.wind_speed or 35.0,
            "current_pressure": latest.pressure or 1000.0,
            "latest_time": latest.timestamp.isoformat() if latest.timestamp else None,
            "observations_count": len(observations),
            "track": track,
        })

    return APIResponse(success=True, data=active_items)
