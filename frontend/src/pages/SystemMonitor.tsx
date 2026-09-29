import { useEffect, useState } from 'react';
import { Monitor, Cpu, HardDrive, Database, Activity, Wind, Box, Clock, RefreshCw, XCircle, CheckCircle } from 'lucide-react';
import { systemApi } from '../api';
import type { SystemStatus, Job } from '../api';

export default function SystemMonitor() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadAll() {
    try {
      const [s, j, st] = await Promise.allSettled([
        systemApi.status(),
        systemApi.jobs(),
        systemApi.storage(),
      ]);
      if (s.status === 'fulfilled') setStatus(s.value.data);
      if (j.status === 'fulfilled') setJobs(j.value.data || []);
      if (st.status === 'fulfilled') setStorage(st.value.data);
    } catch {} finally { setLoading(false); }
  }

  async function cancelJob(id: number) {
    try { await systemApi.cancelJob(id); loadAll(); } catch {}
  }

  function formatUptime(s: number): string {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle size={14} style={{ color: 'var(--success-400)' }} />;
    if (s === 'failed') return <XCircle size={14} style={{ color: 'var(--danger-400)' }} />;
    if (s === 'running') return <RefreshCw size={14} style={{ color: 'var(--primary-300)' }} />;
    return <Clock size={14} style={{ color: 'var(--text-dim)' }} />;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Monitor</h1>
          <p className="page-subtitle">Real-time system health, processing jobs, and storage</p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="page-body animate-in">
        {status && (
          <>
            <div className="stat-grid">
              <div className="stat-card primary">
                <div className="stat-label">CPU Usage</div>
                <div className="stat-value">{status.cpu_percent}%</div>
                <div className="progress-bar" style={{ marginTop: 8 }}>
                  <div className={`progress-bar-fill ${status.cpu_percent > 80 ? 'danger' : ''}`} style={{ width: `${status.cpu_percent}%` }} />
                </div>
              </div>
              <div className="stat-card info">
                <div className="stat-label">Memory</div>
                <div className="stat-value">{status.memory_percent}%</div>
                <div className="stat-detail">{status.memory_used_gb} / {status.memory_total_gb} GB</div>
              </div>
              <div className="stat-card success">
                <div className="stat-label">Uptime</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{formatUptime(status.uptime_seconds)}</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">Active Jobs</div>
                <div className="stat-value">{status.active_jobs}</div>
              </div>
            </div>

            <div className="grid-3" style={{ marginBottom: 24 }}>
              <div className="stat-card primary">
                <div className="stat-label">Datasets</div>
                <div className="stat-value">{status.dataset_count}</div>
              </div>
              <div className="stat-card info">
                <div className="stat-label">Storms</div>
                <div className="stat-value">{status.storm_count?.toLocaleString()}</div>
              </div>
              <div className="stat-card success">
                <div className="stat-label">ML Models</div>
                <div className="stat-value">{status.model_count}</div>
              </div>
            </div>
          </>
        )}

        {storage && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title flex-gap-sm"><HardDrive size={14} /> Storage Usage</span>
            </div>
            <div className="card-body">
              <div className="grid-3" style={{ gap: 12 }}>
                {Object.entries(storage).map(([key, val]) => (
                  <div key={key} style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ').replace(' mb', '')}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{val as number} MB</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title flex-gap-sm"><Activity size={14} /> Processing Jobs</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{jobs.length} jobs</span>
          </div>
          {jobs.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="mono">#{j.id}</td>
                      <td>{j.job_type.replace(/_/g, ' ')}</td>
                      <td>
                        <span className="flex-gap-sm">{statusIcon(j.status)} <span className={`badge ${j.status}`}>{j.status}</span></span>
                      </td>
                      <td style={{ width: 150 }}>
                        <div className="progress-bar">
                          <div className={`progress-bar-fill ${j.status === 'completed' ? 'success' : j.status === 'failed' ? 'danger' : ''}`} style={{ width: `${j.progress}%` }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11 }}>{j.progress.toFixed(0)}%</span>
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{j.completed_at ? new Date(j.completed_at).toLocaleString() : '—'}</td>
                      <td>
                        {(j.status === 'running' || j.status === 'queued') && (
                          <button className="btn btn-sm btn-danger" onClick={() => cancelJob(j.id)}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Activity className="empty-state-icon" />
              <div className="empty-state-title">No Jobs</div>
              <div className="empty-state-text">Processing jobs will appear here when datasets are uploaded or models are trained.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
