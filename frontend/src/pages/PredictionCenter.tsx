import React, { useState, useEffect } from 'react';
import {
  Target, Wind, Compass, AlertTriangle, TrendingUp, MapPin,
  Calendar, Shield, Play, Upload, FileText, Sparkles, RefreshCw,
  Clock, CheckCircle, HelpCircle, Activity, ChevronRight, Gauge
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend
} from 'recharts';
import { mlApi, stormApi, Storm, PredictionResult, UpcomingPredictionResult, MLModelInfo } from '../api';

export default function PredictionCenter() {
  const [activeTab, setActiveTab] = useState<'existing' | 'upcoming' | 'custom'>('existing');

  // State for Existing Storm Prediction
  const [storms, setStorms] = useState<Storm[]>([]);
  const [models, setModels] = useState<MLModelInfo[]>([]);
  const [selectedStormId, setSelectedStormId] = useState<number | ''>('');
  const [selectedModelId, setSelectedModelId] = useState<number | ''>('');
  const [selectedHorizons, setSelectedHorizons] = useState<number[]>([6, 12, 24, 48, 72, 120]);
  const [loading, setLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State for Upcoming Cyclones
  const [upcomingData, setUpcomingData] = useState<UpcomingPredictionResult | null>(null);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  // State for Custom CSV Predict
  const [customCsvText, setCustomCsvText] = useState(
`LAT,LON,WIND,PRES,TIME
14.5,-99.8,45,998,2023-10-23 12:00:00
14.9,-100.1,50,994,2023-10-23 18:00:00
15.3,-100.3,55,991,2023-10-24 00:00:00
15.7,-100.3,60,987,2023-10-24 06:00:00
16.1,-100.1,70,980,2023-10-24 12:00:00
16.3,-99.9,110,950,2023-10-24 15:00:00
16.6,-99.8,125,938,2023-10-24 18:00:00`
  );
  const [customStormName, setCustomStormName] = useState('Observed Cyclone');
  const [customResult, setCustomResult] = useState<any | null>(null);

  // Load available storms & models
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [stormsRes, modelsRes] = await Promise.all([
        stormApi.list({ page_size: 100 }),
        mlApi.models(),
      ]);
      if (stormsRes.success && stormsRes.data?.items) {
        setStorms(stormsRes.data.items);
        if (stormsRes.data.items.length > 0) {
          setSelectedStormId(stormsRes.data.items[0].id);
        }
      }
      if (modelsRes.success && modelsRes.data) {
        setModels(modelsRes.data);
        if (modelsRes.data.length > 0) {
          setSelectedModelId(modelsRes.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  };

  // Load upcoming predictions
  const fetchUpcoming = async () => {
    setUpcomingLoading(true);
    try {
      const res = await mlApi.predictUpcoming();
      if (res.success && res.data) {
        setUpcomingData(res.data);
      }
    } catch (err: any) {
      console.error('Error predicting upcoming cyclones:', err);
    } finally {
      setUpcomingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'upcoming' && !upcomingData) {
      fetchUpcoming();
    }
  }, [activeTab]);

  // Generate Prediction for selected storm
  const handleGeneratePrediction = async () => {
    if (!selectedStormId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await mlApi.predict(
        Number(selectedStormId),
        selectedModelId ? Number(selectedModelId) : undefined,
        selectedHorizons
      );
      if (res.success && res.data) {
        setPrediction(res.data);
      } else {
        setErrorMsg(res.message || 'Failed to generate predictions');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Error running prediction model');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Quick Train on uploaded data
  const handleQuickTrain = async (modelType: string) => {
    setTrainingLoading(true);
    try {
      const res = await mlApi.quickTrain(modelType);
      if (res.success) {
        // Refresh models list
        const mRes = await mlApi.models();
        if (mRes.success && mRes.data) {
          setModels(mRes.data);
          if (mRes.data.length > 0) {
            setSelectedModelId(mRes.data[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Training error:', e);
    } finally {
      setTrainingLoading(false);
    }
  };

  // Predict from Custom CSV input
  const handleCustomPredict = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await mlApi.predictCustom({
        csv_text: customCsvText,
        storm_name: customStormName,
        horizons: selectedHorizons,
      });
      if (res.success && res.data) {
        setCustomResult(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to parse and predict custom CSV');
    } finally {
      setLoading(false);
    }
  };

  const toggleHorizon = (h: number) => {
    if (selectedHorizons.includes(h)) {
      if (selectedHorizons.length > 1) {
        setSelectedHorizons(selectedHorizons.filter(x => x !== h));
      }
    } else {
      setSelectedHorizons([...selectedHorizons, h].sort((a, b) => a - b));
    }
  };

  // Map center calculation
  const getMapCenter = (pred: PredictionResult | null): [number, number] => {
    if (pred && pred.storm) {
      return [pred.storm.current_lat, pred.storm.current_lon];
    }
    if (pred && pred.forecast_track.length > 0) {
      return [pred.forecast_track[0].lat, pred.forecast_track[0].lon];
    }
    return [18.0, -90.0];
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title flex-gap">
            <Target size={26} style={{ color: 'var(--primary-400)' }} />
            Cyclone AI Prediction Center
          </h1>
          <p className="page-subtitle">
            Predict cyclone tracks & intensity from your CSV data, plus forecast upcoming storm formations
          </p>
        </div>
        <div className="flex-gap-sm">
          <button
            className={`btn ${activeTab === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('existing')}
          >
            <Activity size={15} /> Predict from My Data
          </button>
          <button
            className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('upcoming')}
          >
            <Sparkles size={15} /> Upcoming Cyclone Forecast
          </button>
          <button
            className={`btn ${activeTab === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('custom')}
          >
            <FileText size={15} /> Quick CSV Predict
          </button>
        </div>
      </div>

      <div className="page-body animate-in">
        {/* Research Prototype Alert */}
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(237,137,54,0.08)',
          border: '1px solid rgba(237,137,54,0.25)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent-400)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--accent-400)' }}>Local AI Machine Learning Engine:</strong>{' '}
            Uses multi-output XGBoost / Random Forest models trained directly on your uploaded CSV observation records.
            <strong> 0 External APIs required</strong> — all computation and mapping runs 100% locally on your machine.
          </div>
        </div>

        {errorMsg && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(229,62,62,0.1)',
            border: '1px solid rgba(229,62,62,0.3)',
            color: '#fc8181',
            marginBottom: 20,
            fontSize: 13,
          }}>
            {errorMsg}
          </div>
        )}

        {/* TAB 1: PREDICT CYCLONE FROM STORED CSV DATA */}
        {activeTab === 'existing' && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title flex-gap-sm">
                  <Compass size={16} /> Forecast Configuration
                </span>
                {models.length === 0 ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleQuickTrain('xgboost')}
                    disabled={trainingLoading}
                  >
                    {trainingLoading ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
                    Train Model on My Data (1-Click)
                  </button>
                ) : (
                  <span className="badge success flex-gap-sm">
                    <CheckCircle size={12} /> {models.length} AI Model{models.length > 1 ? 's' : ''} Active
                  </span>
                )}
              </div>
              <div className="card-body">
                <div className="grid-3" style={{ gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Select Cyclone from Uploaded Data</label>
                    <select
                      className="form-select"
                      value={selectedStormId}
                      onChange={(e) => setSelectedStormId(Number(e.target.value))}
                    >
                      {storms.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.storm_id}) — {s.season || 'N/A'} {s.basin ? `[${s.basin}]` : ''} ({s.num_observations} obs)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Prediction AI Model</label>
                    <select
                      className="form-select"
                      value={selectedModelId}
                      onChange={(e) => setSelectedModelId(e.target.value ? Number(e.target.value) : '')}
                    >
                      {models.length > 0 ? (
                        models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.model_type.toUpperCase()})
                          </option>
                        ))
                      ) : (
                        <option value="">Physics-Informed Kinematic AI (Built-in)</option>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Forecast Lead Horizons</label>
                    <div className="flex-gap-sm" style={{ flexWrap: 'wrap' }}>
                      {[6, 12, 24, 48, 72, 120].map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`btn btn-sm ${selectedHorizons.includes(h) ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleHorizon(h)}
                        >
                          +{h}h
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleGeneratePrediction}
                    disabled={loading || !selectedStormId}
                    style={{ minWidth: 200 }}
                  >
                    {loading ? <RefreshCw size={15} className="spin" /> : <Target size={15} />}
                    {loading ? 'Generating Prediction...' : 'Generate AI Prediction'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleQuickTrain('xgboost')}
                    disabled={trainingLoading}
                    title="Retrain model on latest observations"
                  >
                    {trainingLoading ? <RefreshCw size={13} className="spin" /> : <RefreshCw size={13} />} Retrain Model
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Outputs future track coordinates, intensity thresholds, cone of uncertainty, and landfall risk.
                  </span>
                </div>
              </div>
            </div>

            {/* PREDICTION RESULTS VIEW */}
            {prediction && (
              <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Summary Stat Cards */}
                <div className="grid-4" style={{ gap: 14 }}>
                  <div className="card stat-card">
                    <div className="stat-label flex-gap-sm"><Wind size={14} /> Peak Predicted Wind</div>
                    <div className="stat-value" style={{ color: 'var(--accent-400)' }}>
                      {prediction.summary.peak_wind_kts} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>kts</span>
                    </div>
                    <div className="stat-sub">{prediction.summary.peak_wind_kmh} km/h • {prediction.summary.peak_category_name}</div>
                  </div>

                  <div className="card stat-card">
                    <div className="stat-label flex-gap-sm"><Gauge size={14} /> Min Central Pressure</div>
                    <div className="stat-value" style={{ color: '#63b3ed' }}>
                      {prediction.summary.min_pressure_hpa} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>hPa</span>
                    </div>
                    <div className="stat-sub">Lowest core pressure along track</div>
                  </div>

                  <div className="card stat-card">
                    <div className="stat-label flex-gap-sm"><Compass size={14} /> Forward Motion</div>
                    <div className="stat-value">
                      {prediction.summary.movement_speed_kts} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>kts</span>
                    </div>
                    <div className="stat-sub">Heading ~{prediction.summary.dominant_heading_deg}° (West-Northwest)</div>
                  </div>

                  <div className="card stat-card" style={{ borderColor: prediction.summary.landfall_alert ? 'rgba(237,137,54,0.4)' : undefined }}>
                    <div className="stat-label flex-gap-sm"><MapPin size={14} /> Landfall Alert</div>
                    <div className="stat-value" style={{ color: prediction.summary.landfall_alert ? 'var(--accent-400)' : 'var(--text-primary)' }}>
                      {prediction.summary.landfall_alert ? `In ~${prediction.summary.landfall_eta_hours}h` : 'No Imminent Landfall'}
                    </div>
                    <div className="stat-sub">
                      {prediction.summary.landfall_coordinates
                        ? `Target: ${prediction.summary.landfall_coordinates.lat}°N, ${prediction.summary.landfall_coordinates.lon}°E`
                        : 'Open ocean trajectory'}
                    </div>
                  </div>
                </div>

                {/* Interactive Map: Observed Track + AI Forecast Track + Uncertainty Cone */}
                <div className="card">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="card-title flex-gap-sm">
                      <MapPin size={16} /> Interactive Trajectory & Uncertainty Cone Map
                    </span>
                    <div className="flex-gap" style={{ fontSize: 12 }}>
                      <span className="flex-gap-xs"><span style={{ display: 'inline-block', width: 12, height: 3, background: '#4fd1c5' }} /> Past Observed</span>
                      <span className="flex-gap-xs"><span style={{ display: 'inline-block', width: 12, height: 3, background: '#ed8936', borderTop: '2px dashed #ed8936' }} /> AI Predicted Track</span>
                      <span className="flex-gap-xs"><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'rgba(237,137,54,0.25)', border: '1px solid #ed8936' }} /> Cone of Uncertainty</span>
                    </div>
                  </div>
                  <div className="card-body" style={{ padding: 0, height: 460 }}>
                    <MapContainer
                      center={getMapCenter(prediction)}
                      zoom={5}
                      style={{ height: '100%', width: '100%', background: '#0b1118' }}
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                        attribution="&copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                        maxZoom={16}
                      />
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                        attribution=""
                        maxZoom={16}
                      />

                      {/* Past Observed Track Line */}
                      {prediction.past_track.length > 1 && (
                        <Polyline
                          positions={prediction.past_track.map(p => [p.lat, p.lon])}
                          pathOptions={{ color: '#4fd1c5', weight: 3, opacity: 0.8 }}
                        />
                      )}

                      {/* Past Observed Points */}
                      {prediction.past_track.map((p, idx) => (
                        <CircleMarker
                          key={`past-${idx}`}
                          center={[p.lat, p.lon]}
                          radius={idx === prediction.past_track.length - 1 ? 6 : 4}
                          pathOptions={{ color: '#ffffff', fillColor: p.color || '#4fd1c5', fillOpacity: 0.9, weight: 1.5 }}
                        >
                          <Popup>
                            <div style={{ fontSize: 12, color: '#1a202c' }}>
                              <strong>{prediction.storm.name} (Observed)</strong><br />
                              Time: {p.time || 'N/A'}<br />
                              Lat: {p.lat}°, Lon: {p.lon}°<br />
                              Wind: {p.wind_kts} kts ({p.category_name})<br />
                              Pressure: {p.pressure_hpa} hPa
                            </div>
                          </Popup>
                        </CircleMarker>
                      ))}

                      {/* Predicted Track Line */}
                      {prediction.forecast_track.length > 0 && (
                        <Polyline
                          positions={[
                            [prediction.storm.current_lat, prediction.storm.current_lon],
                            ...prediction.forecast_track.map(p => [p.lat, p.lon])
                          ] as any}
                          pathOptions={{ color: '#ed8936', weight: 4, dashArray: '6, 8', opacity: 0.95 }}
                        />
                      )}

                      {/* Uncertainty Cones (Circles expanding per horizon) */}
                      {prediction.forecast_track.map((p, idx) => (
                        <React.Fragment key={`cone-group-${idx}`}>
                          <Circle
                            center={[p.lat, p.lon]}
                            radius={p.uncertainty_km * 1000}
                            pathOptions={{
                              color: '#ed8936',
                              fillColor: '#ed8936',
                              fillOpacity: 0.08,
                              weight: 1,
                              dashArray: '3, 4'
                            }}
                          />
                          <CircleMarker
                            center={[p.lat, p.lon]}
                            radius={7}
                            pathOptions={{ color: '#ffffff', fillColor: p.color || '#ed8936', fillOpacity: 1, weight: 2 }}
                          >
                            <Popup>
                              <div style={{ fontSize: 12, color: '#1a202c' }}>
                                <strong style={{ color: '#c05621' }}>Forecast +{p.horizon_hours}h</strong><br />
                                Time: {p.time}<br />
                                Coord: {p.lat}°N, {p.lon}°E<br />
                                Wind: {p.wind_kts} kts ({p.category_name})<br />
                                Pressure: {p.pressure_hpa} hPa<br />
                                Margin of Error: ±{p.uncertainty_km} km ({Math.round(p.confidence * 100)}% conf)
                              </div>
                            </Popup>
                          </CircleMarker>
                        </React.Fragment>
                      ))}
                    </MapContainer>
                  </div>
                </div>

                {/* Intensity Forecast Charts */}
                <div className="grid-2" style={{ gap: 20 }}>
                  <div className="card">
                    <div className="card-header"><span className="card-title flex-gap-sm"><TrendingUp size={16} /> Wind Speed Trajectory (Knots)</span></div>
                    <div className="card-body" style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={prediction.forecast_track}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="horizon_hours" tickFormatter={(v) => `+${v}h`} stroke="var(--text-dim)" />
                          <YAxis domain={['auto', 'auto']} stroke="var(--text-dim)" />
                          <Tooltip
                            contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                            formatter={(v: any) => [`${v} kts`, 'Wind Speed']}
                            labelFormatter={(v) => `Lead Horizon +${v} Hours`}
                          />
                          <Line type="monotone" dataKey="wind_kts" stroke="#ed8936" strokeWidth={3} dot={{ r: 5, fill: '#ed8936' }} name="Wind (kts)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header"><span className="card-title flex-gap-sm"><Gauge size={16} /> Central Pressure Evolution (hPa)</span></div>
                    <div className="card-body" style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={prediction.forecast_track}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="horizon_hours" tickFormatter={(v) => `+${v}h`} stroke="var(--text-dim)" />
                          <YAxis domain={['auto', 'auto']} stroke="var(--text-dim)" />
                          <Tooltip
                            contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                            formatter={(v: any) => [`${v} hPa`, 'Central Pressure']}
                            labelFormatter={(v) => `Lead Horizon +${v} Hours`}
                          />
                          <Line type="monotone" dataKey="pressure_hpa" stroke="#63b3ed" strokeWidth={3} dot={{ r: 5, fill: '#63b3ed' }} name="Pressure (hPa)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Tabular Forecast Breakdown */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Forecast Lead-Time Breakdown</span></div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <table className="table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Lead Time</th>
                          <th>Valid Time</th>
                          <th>Coordinates</th>
                          <th>Max Wind</th>
                          <th>Min Pressure</th>
                          <th>Category</th>
                          <th>Uncertainty Radius</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prediction.forecast_track.map((f) => (
                          <tr key={f.horizon_hours}>
                            <td><strong>+{f.horizon_hours}h</strong></td>
                            <td style={{ fontSize: 12 }}>{new Date(f.time).toLocaleString()}</td>
                            <td>{f.lat.toFixed(2)}°N, {f.lon.toFixed(2)}°E</td>
                            <td><strong>{f.wind_kts} kts</strong> ({f.wind_kmh} km/h)</td>
                            <td>{f.pressure_hpa} hPa</td>
                            <td>
                              <span className="badge" style={{ background: `${f.color}22`, color: f.color, border: `1px solid ${f.color}44` }}>
                                {f.category} — {f.category_name}
                              </span>
                            </td>
                            <td>±{f.uncertainty_km} km</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 50, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${f.confidence * 100}%`, height: '100%', background: 'var(--primary-400)' }} />
                                </div>
                                <span style={{ fontSize: 11 }}>{Math.round(f.confidence * 100)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: UPCOMING CYCLONE & CYCLOGENESIS RISK FORECAST */}
        {activeTab === 'upcoming' && (
          <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="card-title flex-gap-sm">
                    <Sparkles size={18} style={{ color: 'var(--primary-400)' }} />
                    Upcoming Cyclone Genesis & Formation Risk Forecast
                  </span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Machine-learned historical cyclogenesis clustering, recurrence intervals, and potential formation windows based on your uploaded CSV data.
                  </p>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={fetchUpcoming} disabled={upcomingLoading}>
                  <RefreshCw size={13} className={upcomingLoading ? 'spin' : ''} /> Refresh Analysis
                </button>
              </div>

              {upcomingData && upcomingData.genesis_prediction && (
                <div className="card-body">
                  <div className="grid-3" style={{ gap: 16, marginBottom: 20 }}>
                    <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Projected Next Cyclone Formation</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-400)' }}>
                        {upcomingData.genesis_prediction.projected_window_start} to {upcomingData.genesis_prediction.projected_window_end}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                        Average cadence: 1 new storm every ~{upcomingData.genesis_prediction.estimated_interval_days} days
                      </div>
                    </div>

                    <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Formation Risk Level</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#48bb78', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge success">{upcomingData.genesis_prediction.formation_risk_level} RISK</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>({Math.round(upcomingData.genesis_prediction.formation_probability_score * 100)}% prob)</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                        Primary Basin: {upcomingData.genesis_prediction.primary_basin}
                      </div>
                    </div>

                    <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Expected Severity & Archetype</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {upcomingData.genesis_prediction.expected_intensity_profile.expected_category_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                        Peak: ~{upcomingData.genesis_prediction.expected_intensity_profile.expected_peak_wind_kts} kts •
                        Track: {upcomingData.genesis_prediction.expected_trajectory_archetype.dominant_heading}
                      </div>
                    </div>
                  </div>

                  {/* Genesis Hotspot Map */}
                  <div style={{ height: 350, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: 20 }}>
                    <MapContainer
                      center={[
                        upcomingData.genesis_prediction.genesis_hotspot.center_lat,
                        upcomingData.genesis_prediction.genesis_hotspot.center_lon
                      ]}
                      zoom={4}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                        attribution="&copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                        maxZoom={16}
                      />
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                        attribution=""
                        maxZoom={16}
                      />
                      {/* Genesis Hotspot Circle */}
                      <Circle
                        center={[
                          upcomingData.genesis_prediction.genesis_hotspot.center_lat,
                          upcomingData.genesis_prediction.genesis_hotspot.center_lon
                        ]}
                        radius={upcomingData.genesis_prediction.genesis_hotspot.radius_km * 1000}
                        pathOptions={{
                          color: '#f56565',
                          fillColor: '#f56565',
                          fillOpacity: 0.15,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div style={{ color: '#1a202c', fontSize: 12 }}>
                            <strong>High-Risk Genesis Hotspot</strong><br />
                            Centroid: {upcomingData.genesis_prediction.genesis_hotspot.center_lat}°N, {upcomingData.genesis_prediction.genesis_hotspot.center_lon}°E<br />
                            Radius: ~{upcomingData.genesis_prediction.genesis_hotspot.radius_km} km<br />
                            Derived from {upcomingData.genesis_prediction.historical_storms_analyzed} storms in your dataset.
                          </div>
                        </Popup>
                      </Circle>
                    </MapContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Active & Latest Storm Forecasts from Uploaded Data */}
            {upcomingData && upcomingData.active_forecasts && upcomingData.active_forecasts.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title flex-gap-sm">
                    <Activity size={16} /> Latest & Active Storms in Your Data (Upcoming Predictions)
                  </span>
                </div>
                <div className="card-body">
                  <div className="grid-3" style={{ gap: 16 }}>
                    {upcomingData.active_forecasts.map((f) => (
                      <div
                        key={f.storm.id}
                        style={{
                          padding: '16px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setSelectedStormId(f.storm.id);
                          setPrediction(f);
                          setActiveTab('existing');
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{f.storm.name}</span>
                          <span className="badge info">{f.storm.season}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          Current Intensity: <strong>{f.storm.current_wind} kts</strong> ({f.storm.current_category})
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--accent-400)', marginBottom: 8 }}>
                          Predicted Peak: <strong>{f.summary.peak_wind_kts} kts</strong> ({f.summary.peak_category})
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          Landfall risk: {f.summary.landfall_alert ? `Yes (~${f.summary.landfall_eta_hours}h)` : 'No'}
                        </div>
                        <button className="btn btn-sm btn-secondary" style={{ marginTop: 12, width: '100%' }}>
                          View Detailed Track <ChevronRight size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUICK CSV DIRECT PREDICT */}
        {activeTab === 'custom' && (
          <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title flex-gap-sm">
                  <Upload size={16} /> Paste or Upload Custom Cyclone CSV Rows
                </span>
              </div>
              <div className="card-body">
                <div className="grid-2" style={{ gap: 16, marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Cyclone Name / Identifier</label>
                    <input
                      type="text"
                      className="form-input"
                      value={customStormName}
                      onChange={(e) => setCustomStormName(e.target.value)}
                      placeholder="e.g. Cyclone Tej"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Forecast Lead Horizons</label>
                    <div className="flex-gap-sm" style={{ flexWrap: 'wrap' }}>
                      {[6, 12, 24, 48, 72, 120].map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`btn btn-sm ${selectedHorizons.includes(h) ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleHorizon(h)}
                        >
                          +{h}h
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">CSV Observation Track Points (LAT, LON, WIND, PRES, TIME)</label>
                  <textarea
                    rows={8}
                    className="form-input"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                    value={customCsvText}
                    onChange={(e) => setCustomCsvText(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                    Provide at least 1-2 points. If 2+ points are provided, the AI automatically computes velocity, forward bearing, and beta-drift recurvature.
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleCustomPredict}
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Predict Cyclone Trajectory
                </button>
              </div>
            </div>

            {/* Custom Prediction Results */}
            {customResult && (
              <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card">
                  <div className="card-header"><span className="card-title">Predicted Trajectory ({customResult.storm_name})</span></div>
                  <div className="card-body" style={{ padding: 0, height: 420 }}>
                    <MapContainer
                      center={[
                        customResult.forecast_track[0]?.lat || 15.0,
                        customResult.forecast_track[0]?.lon || -90.0
                      ]}
                      zoom={5}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                        attribution="&copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                        maxZoom={16}
                      />
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                        attribution=""
                        maxZoom={16}
                      />
                      {/* Observed */}
                      {customResult.past_track.length > 1 && (
                        <Polyline
                          positions={customResult.past_track.map((p: any) => [p.lat, p.lon]) as any}
                          pathOptions={{ color: '#4fd1c5', weight: 3 }}
                        />
                      )}
                      {customResult.past_track.map((p: any, idx: number) => (
                        <CircleMarker
                          key={`cpast-${idx}`}
                          center={[p.lat, p.lon]}
                          radius={5}
                          pathOptions={{ color: '#ffffff', fillColor: '#4fd1c5', fillOpacity: 0.9, weight: 1.5 }}
                        >
                          <Popup>
                            <div style={{ fontSize: 12, color: '#1a202c' }}>
                              Observed Point: {p.lat}°, {p.lon}° • {p.wind_kts} kts
                            </div>
                          </Popup>
                        </CircleMarker>
                      ))}

                      {/* Forecast */}
                      <Polyline
                        positions={[
                          [customResult.past_track[customResult.past_track.length - 1].lat, customResult.past_track[customResult.past_track.length - 1].lon],
                          ...customResult.forecast_track.map((p: any) => [p.lat, p.lon])
                        ] as any}
                        pathOptions={{ color: '#ed8936', weight: 4, dashArray: '6, 8' }}
                      />

                      {customResult.forecast_track.map((p: any, idx: number) => (
                        <React.Fragment key={`cpred-${idx}`}>
                          <Circle
                            center={[p.lat, p.lon]}
                            radius={p.uncertainty_km * 1000}
                            pathOptions={{ color: '#ed8936', fillColor: '#ed8936', fillOpacity: 0.08, weight: 1, dashArray: '3, 4' }}
                          />
                          <CircleMarker
                            center={[p.lat, p.lon]}
                            radius={6}
                            pathOptions={{ color: '#ffffff', fillColor: p.color, fillOpacity: 1, weight: 2 }}
                          >
                            <Popup>
                              <div style={{ fontSize: 12, color: '#1a202c' }}>
                                +{p.horizon_hours}h Forecast: {p.lat}°, {p.lon}°<br />
                                Wind: {p.wind_kts} kts ({p.category_name})<br />
                                Error Margin: ±{p.uncertainty_km} km
                              </div>
                            </Popup>
                          </CircleMarker>
                        </React.Fragment>
                      ))}
                    </MapContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
