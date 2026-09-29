"""
Dataset processing service — handles massive CSV/file ingestion with chunked processing.

Key design decisions:
- Never loads entire files into memory at once
- Uses pandas chunksize for streaming CSV processing
- Converts to Parquet for efficient analytical access
- Validates data quality row-by-row during ingestion
- Produces immutable dataset versions
"""
import os
import time
import hashlib
import math
import json
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.database import (
    Dataset, DatasetVersion, DatasetStatus, DatasetRole,
    Storm, StormObservation, ProcessingJob, JobStatus
)

# ─── Known cyclone field patterns for auto-mapping ───────────────────────────

FIELD_PATTERNS = {
    "storm_id": ["sid", "storm_id", "serial_num", "atcf_id", "ibtracs_id", "id"],
    "name": ["name", "storm_name", "cyclone_name"],
    "season": ["season", "year"],
    "basin": ["basin", "ocean_basin"],
    "sub_basin": ["subbasin", "sub_basin"],
    "timestamp": ["iso_time", "time", "datetime", "date_time", "timestamp", "date"],
    "latitude": ["lat", "latitude", "clat", "cy"],
    "longitude": ["lon", "longitude", "clon", "cx", "long"],
    "wind_speed": ["wmo_wind", "wind", "max_wind", "vmax", "wind_speed", "usa_wind"],
    "pressure": ["wmo_pres", "pressure", "min_pressure", "pmin", "slp", "usa_pres"],
    "storm_speed": ["storm_speed", "speed", "movement_speed"],
    "storm_direction": ["storm_dir", "direction", "movement_dir"],
    "nature": ["nature", "storm_type", "system_type"],
    "track_type": ["track_type"],
    "dist2land": ["dist2land", "distance_to_land"],
    "landfall": ["landfall"],
    "iflag": ["iflag"],
}


def auto_map_schema(columns: list[str]) -> dict[str, str]:
    """
    Attempt to automatically map detected columns to known cyclone fields.
    Returns dict mapping system_field -> detected_column.
    """
    mapping = {}
    col_lower = {c.lower().strip(): c for c in columns}

    for system_field, patterns in FIELD_PATTERNS.items():
        for pattern in patterns:
            if pattern in col_lower:
                mapping[system_field] = col_lower[pattern]
                break

    return mapping


def detect_data_types(df_sample: pd.DataFrame) -> dict[str, str]:
    """Infer user-friendly data type names for each column."""
    type_map = {}
    for col in df_sample.columns:
        dtype = df_sample[col].dtype
        if pd.api.types.is_integer_dtype(dtype):
            type_map[col] = "integer"
        elif pd.api.types.is_float_dtype(dtype):
            type_map[col] = "float"
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            type_map[col] = "datetime"
        elif pd.api.types.is_bool_dtype(dtype):
            type_map[col] = "boolean"
        else:
            # Check if the column can be parsed as datetime
            try:
                sample_vals = df_sample[col].dropna().head(20)
                if len(sample_vals) > 0:
                    pd.to_datetime(sample_vals, format="mixed", dayfirst=False)
                    type_map[col] = "datetime"
                    continue
            except (ValueError, TypeError):
                pass
            type_map[col] = "string"
    return type_map


def compute_column_statistics(df: pd.DataFrame) -> dict:
    """Compute per-column statistics for a sample DataFrame."""
    stats = {}
    for col in df.columns:
        col_stats = {
            "name": col,
            "non_null": int(df[col].notna().sum()),
            "null_count": int(df[col].isna().sum()),
            "null_pct": round(float(df[col].isna().mean() * 100), 2),
            "unique": int(df[col].nunique()),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            desc = df[col].describe()
            col_stats.update({
                "min": None if pd.isna(desc.get("min")) else float(desc["min"]),
                "max": None if pd.isna(desc.get("max")) else float(desc["max"]),
                "mean": None if pd.isna(desc.get("mean")) else round(float(desc["mean"]), 4),
                "std": None if pd.isna(desc.get("std")) else round(float(desc["std"]), 4),
                "median": None if pd.isna(desc.get("50%")) else float(desc["50%"]),
            })
        elif df[col].dtype == object:
            top_values = df[col].value_counts().head(10).to_dict()
            col_stats["top_values"] = {str(k): int(v) for k, v in top_values.items()}
        stats[col] = col_stats
    return stats


class DataQualityValidator:
    """Validates cyclone observation data quality row-by-row."""

    def __init__(self, schema_mapping: dict[str, str]):
        self.mapping = schema_mapping
        self.warnings = []
        self.rejections = []
        self.missing_count = 0
        self.duplicate_timestamps = set()

    def validate_row(self, row: pd.Series, row_idx: int) -> tuple[bool, list[str]]:
        """Validate a single row. Returns (is_valid, list_of_issues)."""
        issues = []
        is_valid = True

        # Latitude validation
        lat_col = self.mapping.get("latitude")
        if lat_col and lat_col in row.index:
            lat = row[lat_col]
            if pd.notna(lat):
                try:
                    lat_f = float(lat)
                    if lat_f < -90 or lat_f > 90:
                        issues.append(f"Row {row_idx}: latitude {lat_f} out of range [-90, 90]")
                        is_valid = False
                except (ValueError, TypeError):
                    issues.append(f"Row {row_idx}: invalid latitude value '{lat}'")
                    is_valid = False

        # Longitude validation
        lon_col = self.mapping.get("longitude")
        if lon_col and lon_col in row.index:
            lon = row[lon_col]
            if pd.notna(lon):
                try:
                    lon_f = float(lon)
                    if lon_f < -360 or lon_f > 360:
                        issues.append(f"Row {row_idx}: longitude {lon_f} out of range [-360, 360]")
                        is_valid = False
                except (ValueError, TypeError):
                    issues.append(f"Row {row_idx}: invalid longitude value '{lon}'")
                    is_valid = False

        # Wind speed validation
        wind_col = self.mapping.get("wind_speed")
        if wind_col and wind_col in row.index:
            wind = row[wind_col]
            if pd.notna(wind):
                try:
                    wind_f = float(wind)
                    if wind_f < 0 or wind_f > 400:
                        issues.append(f"Row {row_idx}: wind speed {wind_f} physically impossible")
                        is_valid = False
                except (ValueError, TypeError):
                    pass  # Non-numeric wind is a warning, not rejection

        # Pressure validation
        pres_col = self.mapping.get("pressure")
        if pres_col and pres_col in row.index:
            pres = row[pres_col]
            if pd.notna(pres):
                try:
                    pres_f = float(pres)
                    if pres_f < 800 or pres_f > 1100:
                        issues.append(f"Row {row_idx}: pressure {pres_f} outside plausible range [800, 1100] hPa")
                except (ValueError, TypeError):
                    pass

        # Timestamp validation
        time_col = self.mapping.get("timestamp")
        if time_col and time_col in row.index:
            ts = row[time_col]
            if pd.isna(ts) or str(ts).strip() == "":
                issues.append(f"Row {row_idx}: missing timestamp")
                self.missing_count += 1

        return is_valid, issues

    def validate_chunk(self, chunk: pd.DataFrame, start_idx: int) -> tuple[int, int, int]:
        """Validate an entire chunk. Returns (valid, warnings, rejected)."""
        valid = 0
        warns = 0
        rejected = 0

        for i, (_, row) in enumerate(chunk.iterrows()):
            row_idx = start_idx + i
            is_valid, issues = self.validate_row(row, row_idx)
            if is_valid:
                if issues:
                    warns += 1
                    self.warnings.extend(issues[:3])  # Limit stored warnings
                else:
                    valid += 1
            else:
                rejected += 1
                self.rejections.extend(issues[:3])

        return valid, warns, rejected


async def process_csv_chunked(
    file_path: Path,
    dataset_version: DatasetVersion,
    db: AsyncSession,
    job: ProcessingJob,
) -> DatasetVersion:
    """
    Process a massive CSV file using chunked reading.
    
    Pipeline:
    1. Schema inspection (read first chunk)
    2. Auto-map fields
    3. Chunked validation
    4. Parquet conversion
    5. Quality report generation
    """
    start_time = time.time()
    chunk_size = settings.CHUNK_SIZE

    try:
        # ── Step 1: Quick schema inspection ──────────────────────────────
        await _update_job(db, job, JobStatus.RUNNING, 5, "Inspecting schema...")

        # Count rows efficiently without loading entire file
        row_count = 0
        for chunk in pd.read_csv(file_path, chunksize=100000, usecols=[0]):
            row_count += len(chunk)

        # Read first chunk for schema detection
        first_chunk = pd.read_csv(file_path, nrows=min(1000, row_count), low_memory=False)
        columns = list(first_chunk.columns)
        col_count = len(columns)
        data_types = detect_data_types(first_chunk)

        # ── Step 2: Auto-map schema ──────────────────────────────────────
        schema_mapping = auto_map_schema(columns)

        # ── Step 3: Sample rows and statistics ───────────────────────────
        sample_rows = first_chunk.head(settings.MAX_SAMPLE_ROWS).replace(
            {np.nan: None, np.inf: None, -np.inf: None}
        ).to_dict(orient="records")

        # Clean sample rows - convert any remaining non-serializable values
        clean_sample = []
        for row in sample_rows:
            clean_row = {}
            for k, v in row.items():
                if isinstance(v, (np.integer,)):
                    clean_row[k] = int(v)
                elif isinstance(v, (np.floating,)):
                    clean_row[k] = float(v) if not (np.isnan(v) or np.isinf(v)) else None
                else:
                    clean_row[k] = v
            clean_sample.append(clean_row)

        col_statistics = compute_column_statistics(first_chunk)

        # Update version with initial findings
        dataset_version.row_count = row_count
        dataset_version.column_count = col_count
        dataset_version.detected_columns = columns
        dataset_version.data_types = data_types
        dataset_version.schema_mapping = schema_mapping
        dataset_version.sample_rows = clean_sample
        dataset_version.column_statistics = col_statistics
        dataset_version.status = DatasetStatus.VALIDATING
        await db.commit()

        await _update_job(db, job, JobStatus.RUNNING, 20, f"Schema detected: {col_count} columns, {row_count} rows")

        # ── Step 4: Chunked validation ───────────────────────────────────
        validator = DataQualityValidator(schema_mapping)
        total_valid = 0
        total_warnings = 0
        total_rejected = 0
        total_missing = 0
        total_duplicates = 0
        processed_rows = 0

        # Track duplicate storm+timestamp pairs
        seen_keys = set()

        for chunk_num, chunk in enumerate(pd.read_csv(file_path, chunksize=chunk_size, low_memory=False)):
            v, w, r = validator.validate_chunk(chunk, processed_rows)
            total_valid += v
            total_warnings += w
            total_rejected += r

            # Count missing values in this chunk
            total_missing += int(chunk.isna().sum().sum())

            # Check for duplicate storm+timestamp
            sid_col = schema_mapping.get("storm_id")
            ts_col = schema_mapping.get("timestamp")
            if sid_col and ts_col and sid_col in chunk.columns and ts_col in chunk.columns:
                for _, row in chunk[[sid_col, ts_col]].iterrows():
                    key = (str(row[sid_col]), str(row[ts_col]))
                    if key in seen_keys:
                        total_duplicates += 1
                    else:
                        seen_keys.add(key)

            processed_rows += len(chunk)
            progress = 20 + (processed_rows / row_count) * 40
            await _update_job(
                db, job, JobStatus.RUNNING, min(progress, 60),
                f"Validated {processed_rows:,} / {row_count:,} rows"
            )

        dataset_version.status = DatasetStatus.NORMALIZING
        await db.commit()

        # ── Step 5: Parquet conversion ───────────────────────────────────
        await _update_job(db, job, JobStatus.RUNNING, 65, "Converting to Parquet...")

        parquet_path = settings.PARQUET_STORAGE / f"{dataset_version.id}_{dataset_version.file_name}.parquet"

        # Stream CSV to Parquet
        writer = None
        for chunk_num, chunk in enumerate(pd.read_csv(file_path, chunksize=chunk_size, low_memory=False)):
            # Attempt numeric coercion on known numeric fields
            for sys_field in ["latitude", "longitude", "wind_speed", "pressure", "storm_speed", "storm_direction"]:
                col = schema_mapping.get(sys_field)
                if col and col in chunk.columns:
                    chunk[col] = pd.to_numeric(chunk[col], errors="coerce")

            # Attempt datetime coercion on timestamp field
            ts_col = schema_mapping.get("timestamp")
            if ts_col and ts_col in chunk.columns:
                chunk[ts_col] = pd.to_datetime(chunk[ts_col], errors="coerce", format="mixed")

            table = pa.Table.from_pandas(chunk, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(str(parquet_path), table.schema, compression=settings.PARQUET_COMPRESSION)
            writer.write_table(table)

            progress = 65 + (chunk_num * chunk_size / row_count) * 25
            await _update_job(db, job, JobStatus.RUNNING, min(progress, 90), "Writing Parquet...")

        if writer:
            writer.close()

        dataset_version.parquet_file_path = str(parquet_path)

        # ── Step 6: Quality scoring ──────────────────────────────────────
        await _update_job(db, job, JobStatus.RUNNING, 92, "Computing quality score...")

        quality_score = (total_valid / row_count * 100) if row_count > 0 else 0
        quality_report = {
            "total_rows": row_count,
            "valid_rows": total_valid,
            "warning_rows": total_warnings,
            "rejected_rows": total_rejected,
            "missing_values": total_missing,
            "duplicate_records": total_duplicates,
            "quality_score": round(quality_score, 2),
            "sample_warnings": validator.warnings[:20],
            "sample_rejections": validator.rejections[:20],
            "validation_time": round(time.time() - start_time, 2),
        }

        dataset_version.valid_rows = total_valid
        dataset_version.warning_rows = total_warnings
        dataset_version.rejected_rows = total_rejected
        dataset_version.missing_values_count = total_missing
        dataset_version.duplicate_count = total_duplicates
        dataset_version.quality_score = round(quality_score, 2)
        dataset_version.quality_report = quality_report
        dataset_version.processing_time_seconds = round(time.time() - start_time, 2)
        dataset_version.status = DatasetStatus.VALIDATED
        await db.commit()

        await _update_job(db, job, JobStatus.COMPLETED, 100, "Processing complete",
                         result=quality_report)

        return dataset_version

    except Exception as e:
        tb = traceback.format_exc()
        dataset_version.status = DatasetStatus.FAILED
        await db.commit()
        await _update_job(db, job, JobStatus.FAILED, 0, f"Error: {str(e)}\n{tb}")
        raise


async def extract_storms_from_parquet(
    dataset_version: DatasetVersion,
    db: AsyncSession,
    job: ProcessingJob,
) -> int:
    """
    Extract individual storm records from a processed Parquet file and 
    populate the storms and storm_observations tables.
    """
    import duckdb

    parquet_path = dataset_version.parquet_file_path
    if not parquet_path or not Path(parquet_path).exists():
        await _update_job(db, job, JobStatus.FAILED, 0, "Parquet file not found")
        return 0

    mapping = dataset_version.schema_mapping
    sid_col = mapping.get("storm_id")
    name_col = mapping.get("name")
    season_col = mapping.get("season")
    basin_col = mapping.get("basin")
    sub_basin_col = mapping.get("sub_basin")
    ts_col = mapping.get("timestamp")
    lat_col = mapping.get("latitude")
    lon_col = mapping.get("longitude")
    wind_col = mapping.get("wind_speed")
    pres_col = mapping.get("pressure")
    speed_col = mapping.get("storm_speed")
    dir_col = mapping.get("storm_direction")
    nature_col = mapping.get("nature")

    if not sid_col:
        await _update_job(db, job, JobStatus.FAILED, 0, "No storm_id column mapped")
        return 0

    await _update_job(db, job, JobStatus.RUNNING, 10, "Querying unique storms from Parquet...")

    con = duckdb.connect()
    con.execute(f"CREATE VIEW data AS SELECT * FROM read_parquet('{parquet_path.replace(chr(92), '/')}')")

    # Get unique storm IDs
    storm_ids = con.execute(f"SELECT DISTINCT \"{sid_col}\" FROM data WHERE \"{sid_col}\" IS NOT NULL").fetchall()
    total_storms = len(storm_ids)

    await _update_job(db, job, JobStatus.RUNNING, 15, f"Found {total_storms} unique storms")

    storms_created = 0
    for i, (raw_sid,) in enumerate(storm_ids):
        storm_serial = str(raw_sid).strip()
        if not storm_serial:
            continue

        # Check if storm already exists
        existing = await db.execute(select(Storm).where(Storm.storm_id == storm_serial))
        if existing.scalar_one_or_none():
            continue

        # Query storm data using DuckDB for speed
        cols_to_select = [f'"{sid_col}"']
        for label, col in [("name", name_col), ("season", season_col), ("basin", basin_col),
                           ("sub_basin", sub_basin_col), ("timestamp", ts_col),
                           ("lat", lat_col), ("lon", lon_col), ("wind", wind_col),
                           ("pres", pres_col), ("speed", speed_col), ("dir", dir_col),
                           ("nature", nature_col)]:
            if col:
                cols_to_select.append(f'"{col}" AS "{label}"')

        query = f"SELECT {', '.join(cols_to_select)} FROM data WHERE \"{sid_col}\" = ? ORDER BY \"{ts_col}\"" if ts_col else f"SELECT {', '.join(cols_to_select)} FROM data WHERE \"{sid_col}\" = ?"
        rows = con.execute(query, [raw_sid]).fetchdf()

        if rows.empty:
            continue

        # Extract storm metadata
        storm_name = str(rows["name"].iloc[0]).strip() if "name" in rows.columns and pd.notna(rows["name"].iloc[0]) else "UNNAMED"
        storm_season = int(rows["season"].iloc[0]) if "season" in rows.columns and pd.notna(rows["season"].iloc[0]) else None
        storm_basin = str(rows["basin"].iloc[0]).strip() if "basin" in rows.columns and pd.notna(rows["basin"].iloc[0]) else None
        storm_sub = str(rows["sub_basin"].iloc[0]).strip() if "sub_basin" in rows.columns and pd.notna(rows["sub_basin"].iloc[0]) else None

        # Time range
        start_time = None
        end_time = None
        if "timestamp" in rows.columns:
            times = pd.to_datetime(rows["timestamp"], errors="coerce").dropna()
            if len(times) > 0:
                start_time = times.min().to_pydatetime()
                end_time = times.max().to_pydatetime()

        duration = (end_time - start_time).total_seconds() / 3600 if start_time and end_time else None

        max_wind = None
        if "wind" in rows.columns:
            wind_vals = pd.to_numeric(rows["wind"], errors="coerce").dropna()
            if len(wind_vals) > 0:
                max_wind = float(wind_vals.max())

        min_pressure = None
        if "pres" in rows.columns:
            pres_vals = pd.to_numeric(rows["pres"], errors="coerce").dropna()
            if len(pres_vals) > 0:
                min_pressure = float(pres_vals.min())

        # Calculate track length
        track_length = 0.0
        if "lat" in rows.columns and "lon" in rows.columns:
            lats = pd.to_numeric(rows["lat"], errors="coerce")
            lons = pd.to_numeric(rows["lon"], errors="coerce")
            valid_mask = lats.notna() & lons.notna()
            lats_v = lats[valid_mask].values
            lons_v = lons[valid_mask].values
            for j in range(1, len(lats_v)):
                dlat = lats_v[j] - lats_v[j-1]
                dlon = lons_v[j] - lons_v[j-1]
                track_length += math.sqrt(dlat**2 + dlon**2) * 111.12  # approx km

        # Create storm record
        storm = Storm(
            storm_id=storm_serial,
            name=storm_name if storm_name and storm_name != "nan" else "UNNAMED",
            season=storm_season,
            basin=storm_basin,
            sub_basin=storm_sub,
            start_time=start_time,
            end_time=end_time,
            duration_hours=duration,
            max_wind=max_wind,
            min_pressure=min_pressure,
            num_observations=len(rows),
            track_length_km=round(track_length, 2),
            dataset_version_id=dataset_version.id,
        )
        db.add(storm)
        await db.flush()

        # Create observations (batch insert)
        observations = []
        for _, obs_row in rows.iterrows():
            obs_ts = None
            if "timestamp" in obs_row.index and pd.notna(obs_row.get("timestamp")):
                try:
                    obs_ts = pd.to_datetime(obs_row["timestamp"]).to_pydatetime()
                except Exception:
                    pass

            obs = StormObservation(
                storm_id_ref=storm.id,
                storm_serial=storm_serial,
                timestamp=obs_ts,
                latitude=_safe_float(obs_row.get("lat")),
                longitude=_safe_float(obs_row.get("lon")),
                wind_speed=_safe_float(obs_row.get("wind")),
                pressure=_safe_float(obs_row.get("pres")),
                storm_speed=_safe_float(obs_row.get("speed")),
                storm_direction=_safe_float(obs_row.get("dir")),
                basin=storm_basin,
                nature=str(obs_row.get("nature", "")).strip() if pd.notna(obs_row.get("nature")) else None,
            )
            observations.append(obs)

        db.add_all(observations)
        storms_created += 1

        if storms_created % 100 == 0:
            await db.commit()
            progress = 15 + (i / total_storms) * 80
            await _update_job(db, job, JobStatus.RUNNING, min(progress, 95),
                            f"Extracted {storms_created} / {total_storms} storms")

    await db.commit()
    con.close()

    await _update_job(db, job, JobStatus.COMPLETED, 100,
                     f"Extracted {storms_created} storms",
                     result={"storms_created": storms_created, "total_storms": total_storms})

    return storms_created


def _safe_float(val) -> Optional[float]:
    """Safely convert a value to float."""
    if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
        return None
    try:
        f = float(val)
        return f if not (np.isnan(f) or np.isinf(f)) else None
    except (ValueError, TypeError):
        return None


async def _update_job(
    db: AsyncSession,
    job: ProcessingJob,
    status: JobStatus,
    progress: float,
    message: str,
    result: dict = None,
):
    """Update job status in database."""
    job.status = status
    job.progress = progress
    if status == JobStatus.RUNNING and not job.started_at:
        job.started_at = datetime.utcnow()
    if status in (JobStatus.COMPLETED, JobStatus.FAILED):
        job.completed_at = datetime.utcnow()
    if result:
        job.result = result
    job.logs = (job.logs or "") + f"\n[{datetime.utcnow().isoformat()}] {message}"
    job.error_message = message if status == JobStatus.FAILED else job.error_message
    await db.commit()
