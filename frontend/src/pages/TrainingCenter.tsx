import React, { useState, useEffect } from 'react';
import { GraduationCap, Play, RefreshCw, CheckCircle, Clock, AlertCircle, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { mlApi, datasetApi, Dataset } from '../api';

export default function TrainingCenter() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [modelType, setModelType] = useState('xgboost');
  const [horizon, setHorizon] = useState(24);
  const [runName, setRunName] = useState('XGBoost Track & Intensity Model');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadRuns, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [dRes, rRes] = await Promise.all([
        datasetApi.list(),
        mlApi.runs(),
      ]);
      if (dRes.success && dRes.data) setDatasets(dRes.data);
      if (rRes.success && rRes.data) setRuns(rRes.data);
    } catch (e) {
      console.error('Error loading training center data:', e);
    }
  };

  const loadRuns = async () => {
    try {
      const rRes = await mlApi.runs();
      if (rRes.success && rRes.data) setRuns(rRes.data);
    } catch (e) {
      // ignore poll error
    }
  };

  const handleStartTraining = async () => {
    setLoading(true);
    setSuccessMsg(null);
    try {
      const res = await mlApi.train({
        name: runName,
        model_type: modelType,
        forecast_horizon_hours: horizon,
      });
      if (res.success) {
        setSuccessMsg(`Training run '${runName}' queued successfully.`);
        loadRuns();
      }
    } catch (e: any) {
      console.error('Training trigger failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Training Center</h1>
          <p className="page-subtitle">Configure, train, and evaluate machine learning models on your cyclone datasets</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleStartTraining}
          disabled={loading}
        >
          {loading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Start Training Run
        </button>
      </div>

      <div className="page-body animate-in">
        {successMsg && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(72,187,120,0.1)',
            border: '1px solid rgba(72,187,120,0.3)',
            color: '#68d391',
            marginBottom: 20,
            fontSize: 13,
          }}>
            {successMsg}
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Training Configuration</span></div>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Run Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Model Architecture / Type</label>
                <select
                  className="form-select"
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                >
                  <option value="xgboost">XGBoost Multi-Output Regressor</option>
                  <option value="random_forest">Random Forest Regressor (Ensemble)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Variables</label>
                <select className="form-select" disabled>
                  <option>Multi-Task: Track Coordinates (Δlat, Δlon) & Intensity (Δwind, Δpres)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Primary Forecast Horizon</label>
                <select
                  className="form-select"
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                >
                  <option value={6}>6 hours ahead</option>
                  <option value={12}>12 hours ahead</option>
                  <option value={24}>24 hours ahead</option>
                  <option value={48}>48 hours ahead</option>
                  <option value={72}>72 hours ahead</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleStartTraining}
                disabled={loading}
              >
                {loading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Start Training
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Trains model weights on all verified storm observation vectors in your database.
              </span>
            </div>
          </div>
        </div>

        {/* Training Runs History */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title flex-gap-sm">
              <GraduationCap size={16} /> Training Runs ({runs.length})
            </span>
            <button className="btn btn-sm btn-secondary" onClick={loadRuns}>
              <RefreshCw size={13} /> Refresh Runs
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {runs.length === 0 ? (
              <div className="empty-state">
                <GraduationCap className="empty-state-icon" />
                <div className="empty-state-title">No Training Runs Yet</div>
                <div className="empty-state-text">
                  Configure and start your first training run using the form above.
                </div>
              </div>
            ) : (
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Model Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Track MAE</th>
                    <th>Wind MAE</th>
                    <th>R² Score</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td><strong>#{r.id}</strong></td>
                      <td>{r.name}</td>
                      <td><span className="badge info">{r.model_type.toUpperCase()}</span></td>
                      <td>
                        <span className={`badge ${r.status === 'completed' ? 'success' : r.status === 'running' ? 'processing' : 'error'}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${r.progress}%`, height: '100%', background: 'var(--primary-400)' }} />
                          </div>
                          <span style={{ fontSize: 11 }}>{r.progress}%</span>
                        </div>
                      </td>
                      <td>{r.metrics?.mean_track_error_km ? `${r.metrics.mean_track_error_km} km` : '—'}</td>
                      <td>{r.metrics?.mae_wind_kts ? `${r.metrics.mae_wind_kts} kts` : '—'}</td>
                      <td>{r.metrics?.r2_score !== undefined ? r.metrics.r2_score : '—'}</td>
                      <td style={{ fontSize: 12 }}>{r.started_at ? new Date(r.started_at).toLocaleTimeString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
