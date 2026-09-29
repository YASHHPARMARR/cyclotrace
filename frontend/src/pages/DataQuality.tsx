import { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, XCircle, Database } from 'lucide-react';
import { datasetApi } from '../api';
import type { Dataset, DatasetVersion } from '../api';
import { Link } from 'react-router-dom';

export default function DataQuality() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const res = await datasetApi.list();
      setDatasets(res.data || []);
    } catch {} finally { setLoading(false); }
  }

  function formatNum(n: number) { return n?.toLocaleString() || '0'; }

  const allVersions = datasets.flatMap(d => (d.versions || []).map(v => ({ ...v, datasetName: d.name })));
  const validatedVersions = allVersions.filter(v => v.status === 'validated');
  const avgQuality = validatedVersions.length > 0
    ? (validatedVersions.reduce((sum, v) => sum + v.quality_score, 0) / validatedVersions.length).toFixed(1)
    : '—';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Quality & Preparation</h1>
          <p className="page-subtitle">Inspect validation results and data quality across all datasets</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="stat-grid">
          <div className="stat-card primary">
            <div className="stat-label">Total Datasets</div>
            <div className="stat-value">{allVersions.length}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Avg Quality Score</div>
            <div className="stat-value">{avgQuality}%</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Total Warnings</div>
            <div className="stat-value">{formatNum(allVersions.reduce((s, v) => s + v.warning_rows, 0))}</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-label">Total Rejected</div>
            <div className="stat-value">{formatNum(allVersions.reduce((s, v) => s + v.rejected_rows, 0))}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title flex-gap-sm"><Shield size={14} /> Quality Overview</span>
          </div>
          {loading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : allVersions.length === 0 ? (
            <div className="empty-state">
              <Database className="empty-state-icon" />
              <div className="empty-state-title">No Datasets</div>
              <div className="empty-state-text">Upload datasets to see quality reports.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dataset</th>
                    <th>Version</th>
                    <th>Rows</th>
                    <th>Valid</th>
                    <th>Warnings</th>
                    <th>Rejected</th>
                    <th>Missing</th>
                    <th>Duplicates</th>
                    <th>Quality</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allVersions.map(v => (
                    <tr key={v.id}>
                      <td><Link to={`/datasets/${v.id}`} style={{ fontWeight: 600 }}>{(v as any).datasetName}</Link></td>
                      <td className="mono">v{v.version}</td>
                      <td className="mono">{formatNum(v.row_count)}</td>
                      <td className="mono" style={{ color: 'var(--success-400)' }}>{formatNum(v.valid_rows)}</td>
                      <td className="mono" style={{ color: 'var(--warning-500)' }}>{formatNum(v.warning_rows)}</td>
                      <td className="mono" style={{ color: 'var(--danger-400)' }}>{formatNum(v.rejected_rows)}</td>
                      <td className="mono">{formatNum(v.missing_values_count)}</td>
                      <td className="mono">{formatNum(v.duplicate_count)}</td>
                      <td>
                        <span style={{
                          fontWeight: 700, fontFamily: 'var(--font-mono)',
                          color: v.quality_score > 80 ? 'var(--success-400)' : v.quality_score > 50 ? 'var(--warning-500)' : 'var(--danger-400)',
                        }}>{v.quality_score}%</span>
                      </td>
                      <td><span className={`badge ${v.status}`}>{v.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
