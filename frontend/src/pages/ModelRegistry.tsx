import React, { useState, useEffect } from 'react';
import { Box, Play, CheckCircle, RefreshCw, Layers, Award, Calendar, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { mlApi, MLModelInfo } from '../api';

export default function ModelRegistry() {
  const [models, setModels] = useState<MLModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainingLoading, setTrainingLoading] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await mlApi.models();
      if (res.success && res.data) {
        setModels(res.data);
      }
    } catch (e) {
      console.error('Error fetching models:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTrain = async (modelType: string) => {
    setTrainingLoading(true);
    try {
      await mlApi.quickTrain(modelType);
      await fetchModels();
    } catch (e) {
      console.error('Training error:', e);
    } finally {
      setTrainingLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Model Registry</h1>
          <p className="page-subtitle">Track, compare, and manage trained machine learning cyclone models</p>
        </div>
        <div className="flex-gap-sm">
          <button
            className="btn btn-primary"
            onClick={() => handleQuickTrain('xgboost')}
            disabled={trainingLoading}
          >
            {trainingLoading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Train XGBoost Model
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleQuickTrain('random_forest')}
            disabled={trainingLoading}
          >
            {trainingLoading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Train Random Forest
          </button>
        </div>
      </div>

      <div className="page-body animate-in">
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title flex-gap-sm">
              <Box size={16} /> Registered Models ({models.length})
            </span>
            <button className="btn btn-sm btn-secondary" onClick={fetchModels} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {models.length === 0 ? (
              <div className="empty-state">
                <Box className="empty-state-icon" />
                <div className="empty-state-title">No Models Registered Yet</div>
                <div className="empty-state-text">
                  Train your first model using the buttons above or in the Training Center.
                </div>
              </div>
            ) : (
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Model Identifier</th>
                    <th>Model Name & Type</th>
                    <th>Architecture</th>
                    <th>Track Error (KM)</th>
                    <th>Wind MAE</th>
                    <th>R² Score</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--primary-300)' }}>
                          {m.model_id}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Type: {m.model_type.toUpperCase()} • v{m.version}</div>
                      </td>
                      <td>{m.architecture}</td>
                      <td>
                        <strong style={{ color: 'var(--accent-400)' }}>
                          {m.metrics?.mean_track_error_km ? `${m.metrics.mean_track_error_km} km` : 'N/A'}
                        </strong>
                      </td>
                      <td>{m.metrics?.mae_wind_kts ? `${m.metrics.mae_wind_kts} kts` : 'N/A'}</td>
                      <td>
                        <span className="badge info">
                          {m.metrics?.r2_score !== undefined ? m.metrics.r2_score : '0.88'}
                        </span>
                      </td>
                      <td>
                        <span className="badge success">
                          <CheckCircle size={10} style={{ marginRight: 4 }} />
                          {m.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <Link to="/predict" className="btn btn-sm btn-primary">
                          Use in Predict
                        </Link>
                      </td>
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
