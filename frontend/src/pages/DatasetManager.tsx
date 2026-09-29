import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, Database, FileText, CheckCircle, AlertTriangle, X,
  RefreshCw, Trash2, Eye, Shield, GraduationCap
} from 'lucide-react';
import { datasetApi, systemApi } from '../api';
import type { Dataset, DatasetVersion, Job } from '../api';

export default function DatasetManager() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadName, setUploadName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [processingJobs, setProcessingJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(pollJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const res = await datasetApi.list();
      setDatasets(res.data || []);
    } catch (e: any) {
      setError('Cannot connect to backend. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function pollJobs() {
    try {
      const res = await systemApi.jobs();
      const active = (res.data || []).filter(
        (j: Job) => j.status === 'running' || j.status === 'queued'
      );
      setProcessingJobs(active);

      // Reload datasets if a job just completed
      if (active.length === 0 && processingJobs.length > 0) {
        loadData();
      }
    } catch {}
  }

  async function handleUpload(file: File) {
    if (!file) return;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const allowed = ['.csv', '.xlsx', '.json', '.nc', '.hdf', '.hdf5', '.h5', '.tif', '.tiff', '.png', '.jpg', '.jpeg', '.zip'];
    if (!allowed.includes(ext)) {
      setError(`File type "${ext}" not supported. Supported: ${allowed.join(', ')}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setSuccess('');

    try {
      const name = uploadName || file.name.replace(/\.[^/.]+$/, '');
      const res = await datasetApi.upload(file, name, '', (pct) => setUploadProgress(pct));

      setSuccess(res.message);
      setUploadName('');
      setUploadProgress(100);
      loadData();

      // Start polling for processing status
      pollJobs();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [uploadName]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragActive(false), []);

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  function formatNum(n: number): string {
    return n?.toLocaleString() || '0';
  }

  async function deleteDataset(id: number) {
    if (!confirm('Delete this dataset? Raw files will be preserved.')) return;
    try {
      await datasetApi.delete(id);
      loadData();
      setSuccess('Dataset deleted');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Delete failed');
    }
  }

  async function updateRole(versionId: number, role: string, inPool: boolean) {
    try {
      await datasetApi.updateRole(versionId, role, inPool);
      loadData();
      setSuccess(`Dataset role updated to "${role}"${inPool ? ', added to training pool' : ''}`);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Update failed');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dataset Manager</h1>
          <p className="page-subtitle">Upload, validate, and manage cyclone datasets for analysis and training</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="page-body animate-in">
        {/* ── Alerts ──────────────────────────────────────── */}
        {error && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(229,62,62,0.3)' }}>
            <div className="card-body flex-between">
              <span className="flex-gap-sm" style={{ color: 'var(--danger-400)', fontSize: 13 }}>
                <AlertTriangle size={16} /> {error}
              </span>
              <button className="btn btn-sm btn-icon" onClick={() => setError('')}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(56,161,105,0.3)' }}>
            <div className="card-body flex-between">
              <span className="flex-gap-sm" style={{ color: 'var(--success-400)', fontSize: 13 }}>
                <CheckCircle size={16} /> {success}
              </span>
              <button className="btn btn-sm btn-icon" onClick={() => setSuccess('')}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Upload Section ──────────────────────────────── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title flex-gap-sm">
              <Upload size={14} /> Upload Dataset
            </span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Dataset Name (optional, auto-detected from filename)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. IBTrACS Historical Archive"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                style={{ maxWidth: 400 }}
              />
            </div>

            <div
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="dropzone-icon" />
              <div className="dropzone-text">
                {uploading ? 'Uploading...' : 'Drop dataset file here or click to browse'}
              </div>
              <div className="dropzone-subtext">
                Supported: CSV / XLSX / JSON / NetCDF / HDF / GeoTIFF / Images / ZIP
              </div>
              <div className="dropzone-subtext" style={{ marginTop: 4, color: 'var(--text-dim)' }}>
                Large files (hundreds of MB) are streamed and processed in chunks
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".csv,.xlsx,.json,.nc,.hdf,.hdf5,.h5,.tif,.tiff,.png,.jpg,.jpeg,.zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = '';
              }}
            />

            {uploading && (
              <div style={{ marginTop: 16 }}>
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Uploading...
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-300)' }}>
                    {uploadProgress}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Active Processing Jobs ──────────────────────── */}
        {processingJobs.length > 0 && (
          <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(49,130,206,0.3)' }}>
            <div className="card-header">
              <span className="card-title flex-gap-sm" style={{ color: 'var(--primary-300)' }}>
                <RefreshCw size={14} className="pulse" /> Active Processing
              </span>
            </div>
            <div className="card-body">
              {processingJobs.map((job) => (
                <div key={job.id} style={{ marginBottom: 12 }}>
                  <div className="flex-between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {job.job_type.replace(/_/g, ' ')} — Job #{job.id}
                    </span>
                    <span className={`badge ${job.status}`}>{job.status}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                    Progress: {job.progress.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Datasets List ───────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex-gap-sm">
              <Database size={14} /> All Datasets
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="loading-overlay">
              <div className="spinner" />
              <span>Loading datasets...</span>
            </div>
          ) : datasets.length === 0 ? (
            <div className="empty-state">
              <Database className="empty-state-icon" />
              <div className="empty-state-title">No Datasets</div>
              <div className="empty-state-text">
                Upload your first dataset above to get started.
                The platform processes large CSV files in chunks.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dataset</th>
                    <th>Version</th>
                    <th>File</th>
                    <th>Size</th>
                    <th>Rows</th>
                    <th>Columns</th>
                    <th>Quality</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Training</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds) =>
                    (ds.versions || []).map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{ds.name}</td>
                        <td className="mono">v{v.version}</td>
                        <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.file_name}
                        </td>
                        <td className="mono">{formatSize(v.file_size_bytes)}</td>
                        <td className="mono">{formatNum(v.row_count)}</td>
                        <td className="mono">{v.column_count}</td>
                        <td>
                          {v.quality_score > 0 ? (
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: v.quality_score > 80 ? 'var(--success-400)' :
                                v.quality_score > 50 ? 'var(--warning-500)' : 'var(--danger-400)',
                            }}>
                              {v.quality_score}%
                            </span>
                          ) : '—'}
                        </td>
                        <td><span className={`badge ${v.status}`}>{v.status}</span></td>
                        <td>
                          <select
                            className="form-select"
                            value={v.role}
                            onChange={(e) => updateRole(v.id, e.target.value, v.in_training_pool)}
                            style={{ fontSize: 11, padding: '4px 6px', width: 100 }}
                          >
                            <option value="observation">Observation</option>
                            <option value="training">Training</option>
                            <option value="validation">Validation</option>
                            <option value="test">Test</option>
                            <option value="reference">Reference</option>
                          </select>
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${v.in_training_pool ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => updateRole(v.id, v.role, !v.in_training_pool)}
                            title={v.in_training_pool ? 'Remove from training pool' : 'Add to training pool'}
                          >
                            <GraduationCap size={12} />
                            {v.in_training_pool ? '✓ Pool' : 'Add'}
                          </button>
                        </td>
                        <td>
                          <div className="flex-gap-sm">
                            <Link
                              to={`/datasets/${v.id}`}
                              className="btn btn-sm btn-secondary"
                              title="View details"
                            >
                              <Eye size={12} />
                            </Link>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => deleteDataset(ds.id)}
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Training Pool Summary ───────────────────────── */}
        {datasets.some(d => d.versions?.some(v => v.in_training_pool)) && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <span className="card-title flex-gap-sm">
                <GraduationCap size={14} /> Training Pool
              </span>
            </div>
            <div className="card-body">
              {datasets.map(ds =>
                (ds.versions || []).filter(v => v.in_training_pool).map(v => (
                  <div key={v.id} className="flex-between" style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(56,161,105,0.06)',
                    border: '1px solid rgba(56,161,105,0.15)',
                    marginBottom: 8,
                  }}>
                    <span className="flex-gap-sm" style={{ fontSize: 13 }}>
                      <CheckCircle size={14} style={{ color: 'var(--success-400)' }} />
                      <strong>{ds.name}</strong> v{v.version}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatNum(v.row_count)} rows · {v.column_count} cols
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
