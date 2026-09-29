import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 300000, // 5 min timeout for large uploads
});

// ─── Types ──────────────────────────────────────────────────────────────────

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface DatasetVersion {
  id: number;
  dataset_id: number;
  version: number;
  file_name: string;
  file_size_bytes: number;
  file_format: string;
  row_count: number;
  column_count: number;
  detected_columns: string[];
  data_types: Record<string, string>;
  schema_mapping: Record<string, string>;
  status: string;
  role: string;
  in_training_pool: boolean;
  upload_time: string | null;
  processing_time_seconds: number;
  valid_rows: number;
  warning_rows: number;
  rejected_rows: number;
  missing_values_count: number;
  duplicate_count: number;
  quality_score: number;
  quality_report: Record<string, any>;
  sample_rows: Record<string, any>[];
  column_statistics: Record<string, any>;
  created_at: string | null;
}

export interface Dataset {
  id: number;
  name: string;
  description: string;
  created_at: string | null;
  updated_at: string | null;
  versions: DatasetVersion[];
}

export interface Storm {
  id: number;
  storm_id: string;
  name: string;
  season: number | null;
  basin: string | null;
  sub_basin: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number | null;
  max_wind: number | null;
  min_pressure: number | null;
  num_observations: number;
  track_length_km: number | null;
}

export interface StormObservation {
  id: number;
  timestamp: string | null;
  latitude: number | null;
  longitude: number | null;
  wind_speed: number | null;
  pressure: number | null;
  storm_speed: number | null;
  storm_direction: number | null;
  basin: string | null;
  nature: string | null;
  extra_data: Record<string, any>;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  wind: number | null;
  pressure: number | null;
  time: string | null;
}

export interface Job {
  id: number;
  job_type: string;
  status: string;
  dataset_version_id: number | null;
  progress: number;
  total_items: number;
  processed_items: number;
  error_message: string | null;
  result: Record<string, any>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

export interface SystemStatus {
  cpu_percent: number;
  memory_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  dataset_count: number;
  storm_count: number;
  model_count: number;
  active_jobs: number;
  uptime_seconds: number;
}

export interface PaginatedStorms {
  items: Storm[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Dataset API ────────────────────────────────────────────────────────────

export const datasetApi = {
  upload: async (file: File, name?: string, description?: string, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (description) formData.append('description', description);

    const res = await api.post<APIResponse>('/api/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data;
  },

  list: async () => {
    const res = await api.get<APIResponse<Dataset[]>>('/api/datasets/');
    return res.data;
  },

  get: async (id: number) => {
    const res = await api.get<APIResponse<Dataset>>(`/api/datasets/${id}`);
    return res.data;
  },

  getVersion: async (versionId: number) => {
    const res = await api.get<APIResponse<DatasetVersion>>(`/api/datasets/version/${versionId}`);
    return res.data;
  },

  preview: async (versionId: number, page = 1, pageSize = 50) => {
    const res = await api.get<APIResponse>(`/api/datasets/version/${versionId}/preview`, {
      params: { page, page_size: pageSize },
    });
    return res.data;
  },

  updateMapping: async (versionId: number, mapping: Record<string, string>) => {
    const res = await api.put<APIResponse>(`/api/datasets/version/${versionId}/mapping`, { mapping });
    return res.data;
  },

  updateRole: async (versionId: number, role: string, inTrainingPool: boolean) => {
    const res = await api.put<APIResponse>(`/api/datasets/version/${versionId}/role`, {
      role,
      in_training_pool: inTrainingPool,
    });
    return res.data;
  },

  getTrainingPool: async () => {
    const res = await api.get<APIResponse>('/api/datasets/training-pool/status');
    return res.data;
  },

  reprocess: async (versionId: number) => {
    const res = await api.post<APIResponse>(`/api/datasets/version/${versionId}/reprocess`);
    return res.data;
  },

  delete: async (id: number) => {
    const res = await api.delete<APIResponse>(`/api/datasets/${id}`);
    return res.data;
  },
};

// ─── Storm API ──────────────────────────────────────────────────────────────

export const stormApi = {
  list: async (params: Record<string, any> = {}) => {
    const res = await api.get<APIResponse<PaginatedStorms>>('/api/storms/', { params });
    return res.data;
  },

  basins: async () => {
    const res = await api.get<APIResponse>('/api/storms/basins');
    return res.data;
  },

  seasons: async () => {
    const res = await api.get<APIResponse>('/api/storms/seasons');
    return res.data;
  },

  stats: async () => {
    const res = await api.get<APIResponse>('/api/storms/stats');
    return res.data;
  },

  get: async (id: number) => {
    const res = await api.get<APIResponse<Storm>>(`/api/storms/${id}`);
    return res.data;
  },

  observations: async (id: number) => {
    const res = await api.get<APIResponse>(`/api/storms/${id}/observations`);
    return res.data;
  },

  track: async (id: number) => {
    const res = await api.get<APIResponse>(`/api/storms/${id}/track`);
    return res.data;
  },

  active: async () => {
    const res = await api.get<APIResponse<any[]>>('/api/storms/active/all');
    return res.data;
  },
};

// ─── System API ─────────────────────────────────────────────────────────────

export const systemApi = {
  status: async () => {
    const res = await api.get<APIResponse<SystemStatus>>('/api/system/status');
    return res.data;
  },

  jobs: async (status?: string) => {
    const res = await api.get<APIResponse<Job[]>>('/api/system/jobs', {
      params: status ? { status } : {},
    });
    return res.data;
  },

  job: async (id: number) => {
    const res = await api.get<APIResponse<Job>>(`/api/system/jobs/${id}`);
    return res.data;
  },

  cancelJob: async (id: number) => {
    const res = await api.post<APIResponse>(`/api/system/jobs/${id}/cancel`);
    return res.data;
  },

  storage: async () => {
    const res = await api.get<APIResponse>('/api/system/storage');
    return res.data;
  },

  health: async () => {
    const res = await api.get('/api/health');
    return res.data;
  },
};

// ─── ML API ─────────────────────────────────────────────────────────────────

export interface MLModelInfo {
  id: number;
  model_id: string;
  name: string;
  version: number;
  model_type: string;
  architecture: string;
  metrics: Record<string, any>;
  status: string;
  training_date: string | null;
}

export interface ForecastPoint {
  horizon_hours: number;
  time: string;
  lat: number;
  lon: number;
  wind_kts: number;
  wind_kmh: number;
  pressure_hpa: number;
  confidence: number;
  uncertainty_km: number;
  category: string;
  category_name: string;
  color: string;
}

export interface PredictionResult {
  storm: {
    id: number;
    storm_id: string;
    name: string;
    season: number | null;
    basin: string | null;
    current_lat: number;
    current_lon: number;
    current_wind: number;
    current_pressure: number;
    current_category: string;
    base_time: string;
  };
  model_used: {
    id: number | null;
    name: string;
    type: string;
  };
  past_track: Array<{
    id?: number;
    lat: number;
    lon: number;
    wind_kts: number;
    wind_kmh: number;
    pressure_hpa: number;
    time: string | null;
    category: string;
    category_name: string;
    color: string;
  }>;
  forecast_track: ForecastPoint[];
  summary: {
    peak_wind_kts: number;
    peak_wind_kmh: number;
    min_pressure_hpa: number;
    peak_category: string;
    peak_category_name: string;
    movement_speed_kts: number;
    dominant_heading_deg: number;
    landfall_alert?: boolean;
    landfall_eta_hours?: number | null;
    landfall_coordinates?: { lat: number; lon: number } | null;
  };
}

export interface UpcomingPredictionResult {
  has_data: boolean;
  total_storms_in_database: number;
  active_forecasts: PredictionResult[];
  genesis_prediction: {
    projected_window_start: string;
    projected_window_end: string;
    estimated_interval_days: number;
    formation_risk_level: string;
    formation_probability_score: number;
    primary_basin: string;
    genesis_hotspot: {
      center_lat: number;
      center_lon: number;
      lat_bounds: [number, number];
      lon_bounds: [number, number];
      radius_km: number;
    };
    expected_intensity_profile: {
      expected_peak_wind_kts: number;
      expected_category: string;
      expected_category_name: string;
      expected_central_pressure_hpa: number;
    };
    expected_trajectory_archetype: {
      dominant_heading: string;
      typical_forward_speed_kts: number;
      recurvature_risk: string;
    };
    historical_storms_analyzed: number;
  } | null;
  disturbance_alerts: Array<{
    storm_name: string;
    storm_serial: string;
    lat: number;
    lon: number;
    current_wind_kts: number;
    pressure_hpa: number;
    formation_probability_pct: number;
    status: string;
  }>;
  generated_at: string;
}

export const mlApi = {
  models: async () => {
    const res = await api.get<APIResponse<MLModelInfo[]>>('/api/ml/models');
    return res.data;
  },

  quickTrain: async (modelType = 'xgboost') => {
    const res = await api.post<APIResponse>('/api/ml/quick-train', { model_type: modelType });
    return res.data;
  },

  train: async (payload: { name?: string; model_type?: string; forecast_horizon_hours?: number; dataset_version_ids?: number[] }) => {
    const res = await api.post<APIResponse>('/api/ml/train', payload);
    return res.data;
  },

  runs: async () => {
    const res = await api.get<APIResponse>('/api/ml/runs');
    return res.data;
  },

  predict: async (stormId: number, modelId?: number, horizons: number[] = [6, 12, 24, 48, 72, 120]) => {
    const res = await api.post<APIResponse<PredictionResult>>('/api/ml/predict', {
      storm_id: stormId,
      model_id: modelId,
      horizons,
    });
    return res.data;
  },

  predictUpcoming: async () => {
    const res = await api.get<APIResponse<UpcomingPredictionResult>>('/api/ml/predict-upcoming');
    return res.data;
  },

  predictCustom: async (payload: { points?: any[]; csv_text?: string; storm_name?: string; horizons?: number[] }) => {
    const res = await api.post<APIResponse<any>>('/api/ml/predict-custom', payload);
    return res.data;
  },
};

// ─── Live Cyclone Intelligence API ──────────────────────────────────────────

export interface LiveStormData {
  id: number;
  storm_id: string;
  name: string;
  basin: string | null;
  sub_basin: string | null;
  status: string;
  latest_lat: number | null;
  latest_lon: number | null;
  latest_wind_kts: number | null;
  latest_pressure_hpa: number | null;
  latest_category: string;
  latest_category_name: string;
  latest_category_color: string;
  latest_observation_time: string | null;
  first_detected: string | null;
  last_updated: string | null;
  primary_source: string;
  track: LiveTrackPoint[];
  observation_count: number;
  latest_prediction: LivePredictionData | null;
}

export interface LiveTrackPoint {
  lat: number;
  lon: number;
  wind_kts: number | null;
  pressure_hpa: number | null;
  time: string | null;
  category: string;
  category_name: string;
  color: string;
  source: string;
}

export interface LivePredictionData {
  run_id: number;
  run_time: string | null;
  forecast_track: ForecastPoint[];
  summary: Record<string, any>;
  model_name: string;
  confidence_avg: number;
  input_obs_count: number;
}

export interface SourceStatusData {
  source_name: string;
  display_name: string;
  state: string;
  last_success: string | null;
  last_failure: string | null;
  last_error: string | null;
  total_requests: number;
  total_observations: number;
  poll_interval_seconds: number;
  requires_auth: boolean;
  auth_configured: boolean;
}

export interface LiveDashboardSummary {
  active_storms: number;
  total_tracked_storms: number;
  total_observations: number;
  total_prediction_runs: number;
  sources: SourceStatusData[];
}

export const liveApi = {
  dashboard: async () => {
    const res = await api.get<APIResponse<LiveDashboardSummary>>('/api/live/dashboard');
    return res.data;
  },

  sources: async () => {
    const res = await api.get<APIResponse<SourceStatusData[]>>('/api/live/sources');
    return res.data;
  },

  initializeSources: async () => {
    const res = await api.post<APIResponse>('/api/live/sources/initialize');
    return res.data;
  },

  ingestUserData: async () => {
    const res = await api.post<APIResponse>('/api/live/ingest/user-data');
    return res.data;
  },

  storms: async (status?: string, basin?: string) => {
    const res = await api.get<APIResponse<LiveStormData[]>>('/api/live/storms', {
      params: { ...(status && { status }), ...(basin && { basin }) },
    });
    return res.data;
  },

  storm: async (id: number) => {
    const res = await api.get<APIResponse<LiveStormData>>(`/api/live/storms/${id}`);
    return res.data;
  },

  predict: async (stormId: number) => {
    const res = await api.post<APIResponse<PredictionResult>>(`/api/live/storms/${stormId}/predict`);
    return res.data;
  },

  predictionHistory: async (stormId: number, limit = 20) => {
    const res = await api.get<APIResponse<LivePredictionData[]>>(`/api/live/storms/${stormId}/predictions`, {
      params: { limit },
    });
    return res.data;
  },

  predictAll: async () => {
    const res = await api.post<APIResponse>('/api/live/predict-all');
    return res.data;
  },
};

export default api;

