import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Database, Shield, Map, Eye, Save, RefreshCw,
  CheckCircle, AlertTriangle, FileText, Columns, BarChart3
} from 'lucide-react';
import { datasetApi } from '../api';
import type { DatasetVersion } from '../api';

const SYSTEM_FIELDS = [
  'storm_id', 'name', 'season', 'basin', 'sub_basin', 'timestamp',
  'latitude', 'longitude', 'wind_speed', 'pressure', 'storm_speed',
  'storm_direction', 'nature', 'track_type', 'dist2land', 'landfall',
];

export default function DatasetDetail() {
  const { versionId } = useParams();
  const [version, setVersion] = useState<DatasetVersion | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [tab, setTab] = useState<'overview' | 'schema' | 'preview' | 'quality' | 'stats'>('overview');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (versionId) loadVersion(parseInt(versionId));
  }, [versionId]);

  useEffect(() => {
    if (versionId && tab === 'preview') loadPreview(parseInt(versionId), previewPage);
  }, [tab, previewPage]);

  async function loadVersion(id: number) {
    try {
      const res = await datasetApi.getVersion(id);
      setVersion(res.data);
      setMapping(res.data.schema_mapping || {});
    } catch (e: any) {
      setError('Failed to load dataset version');
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(id: number, page: number) {
    try {
      const res = await datasetApi.preview(id, page, 50);
      setPreview(res.data);
    } catch (e: any) {
      setError('Failed to load preview');
    }
  }

  async function saveMapping() {
    if (!versionId) return;
    setSaving(true);
    try {
      const res = await datasetApi.updateMapping(parseInt(versionId), mapping);
      setVersion(res.data);
      setSuccess('Schema mapping saved successfully');
    } catch (e: any) {
      setError('Failed to save mapping');
    } finally {
      setSaving(false);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  function formatNum(n: number): string {
    return n?.toLocaleString() || '0';
  }

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div className="page-title">Loading...</div>
        </div>
        <div className="page-body">
          <div className="loading-overlay"><div className="spinner" /> Loading dataset...</div>
        </div>
      </>
    );
  }

  if (!version) {
    return (
      <>
        <div className="page-header">
          <div className="page-title">Dataset Not Found</div>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <div className="empty-state-title">Dataset version not found</div>
            <Link to="/datasets" className="btn btn-primary" style={{ marginTop: 12 }}>
              Back to Datasets
            </Link>
          </div>
        </div>
      </>
    );
  }

  const qr = version.quality_report || {};

  return (
    <>
      <div className="page-header">
        <div className="flex-gap">
          <Link to="/datasets" className="btn btn-sm btn-secondary"><ArrowLeft size={14} /></Link>
          <div>
            <h1 className="page-title">{version.file_name}</h1>
            <p className="page-subtitle">
              Version {version.version} · {formatSize(version.file_size_bytes)} · {version.file_format.toUpperCase()}
            </p>
          </div>
        </div>
        <span className={`badge ${version.status}`}>{version.status.toUpperCase()}</span>
      </div>

      <div className="page-body animate-in">
        {error && (
          <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-sm)', background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', color: 'var(--danger-400)', fontSize: 13 }}>
            <AlertTriangle size={14} style={{ marginRight: 6 }} />{error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-sm)', background: 'rgba(56,161,105,0.1)', border: '1px solid rgba(56,161,105,0.3)', color: 'var(--success-400)', fontSize: 13 }}>
            <CheckCircle size={14} style={{ marginRight: 6 }} />{success}
          </div>
        )}

        {/* ── Stats Row ───────────────────────────────────── */}
        <div className="stat-grid">
          <div className="stat-card primary">
            <div className="stat-label">Rows</div>
            <div className="stat-value">{formatNum(version.row_count)}</div>
          </div>
          <div className="stat-card info">
            <div className="stat-label">Columns</div>
            <div className="stat-value">{version.column_count}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Valid Rows</div>
            <div className="stat-value">{formatNum(version.valid_rows)}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Warnings</div>
            <div className="stat-value">{formatNum(version.warning_rows)}</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-label">Rejected</div>
            <div className="stat-value">{formatNum(version.rejected_rows)}</div>
          </div>
          <div className="stat-card primary">
            <div className="stat-label">Quality Score</div>
            <div className="stat-value" style={{
              color: version.quality_score > 80 ? 'var(--success-400)' :
                version.quality_score > 50 ? 'var(--warning-500)' : 'var(--danger-400)'
            }}>
              {version.quality_score}%
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="tabs">
          {(['overview', 'schema', 'preview', 'quality', 'stats'] as const).map((t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'overview' && <><FileText size={13} style={{ marginRight: 4 }} />Overview</>}
              {t === 'schema' && <><Map size={13} style={{ marginRight: 4 }} />Schema Mapping</>}
              {t === 'preview' && <><Eye size={13} style={{ marginRight: 4 }} />Data Preview</>}
              {t === 'quality' && <><Shield size={13} style={{ marginRight: 4 }} />Quality Report</>}
              {t === 'stats' && <><BarChart3 size={13} style={{ marginRight: 4 }} />Column Stats</>}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><span className="card-title">Dataset Info</span></div>
              <div className="card-body">
                <table style={{ width: '100%', fontSize: 13 }}>
                  <tbody>
                    {[
                      ['File Name', version.file_name],
                      ['Format', version.file_format.toUpperCase()],
                      ['Size', formatSize(version.file_size_bytes)],
                      ['Rows', formatNum(version.row_count)],
                      ['Columns', version.column_count],
                      ['Version', `v${version.version}`],
                      ['Status', version.status],
                      ['Role', version.role],
                      ['In Training Pool', version.in_training_pool ? 'Yes' : 'No'],
                      ['Processing Time', `${version.processing_time_seconds.toFixed(1)}s`],
                      ['Upload Time', version.upload_time ? new Date(version.upload_time).toLocaleString() : '—'],
                    ].map(([label, val]) => (
                      <tr key={String(label)}>
                        <td style={{ padding: '6px 0', color: 'var(--text-muted)', width: '40%' }}>{label}</td>
                        <td style={{ padding: '6px 0', fontWeight: 500 }}>{String(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Detected Columns</span></div>
              <div className="card-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
                {version.detected_columns.map((col, i) => (
                  <div key={i} className="flex-between" style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 12,
                  }}>
                    <span className="mono">{col}</span>
                    <span className="badge processing">{version.data_types[col] || 'unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Schema Mapping Tab ──────────────────────────── */}
        {tab === 'schema' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title flex-gap-sm">
                <Columns size={14} /> Field Mapping
              </span>
              <button className="btn btn-primary btn-sm" onClick={saveMapping} disabled={saving}>
                <Save size={12} /> {saving ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Map detected columns to standard system fields. Auto-mapped fields are pre-filled.
                Adjust as needed before processing.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
                {SYSTEM_FIELDS.map((sysField) => {
                  const currentCol = mapping[sysField] || '';
                  return (
                    <div key={sysField} className="mapping-row">
                      <div className="mapping-field" style={{ background: 'rgba(49,130,206,0.08)', color: 'var(--primary-300)' }}>
                        {sysField}
                      </div>
                      <div className="mapping-arrow">→</div>
                      <select
                        className="form-select"
                        value={currentCol}
                        onChange={(e) => setMapping(prev => ({ ...prev, [sysField]: e.target.value }))}
                        style={{ fontSize: 12, padding: '6px 8px' }}
                      >
                        <option value="">— Not Mapped —</option>
                        {version.detected_columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                      <div className={`mapping-status ${currentCol ? 'mapped' : 'unmapped'}`}>
                        {currentCol ? '✓ Mapped' : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Data Preview Tab ────────────────────────────── */}
        {tab === 'preview' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title flex-gap-sm">
                <Eye size={14} /> Data Preview
              </span>
              {preview && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Page {preview.page} of {preview.total_pages} · {formatNum(preview.total)} rows total
                </span>
              )}
            </div>
            {preview?.rows ? (
              <>
                <div style={{ overflowX: 'auto', maxHeight: 500 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {version.detected_columns.slice(0, 20).map((col) => (
                          <th key={col} style={{ minWidth: 100 }}>{col}</th>
                        ))}
                        {version.detected_columns.length > 20 && <th>+{version.detected_columns.length - 20} more</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row: any, i: number) => (
                        <tr key={i}>
                          <td className="mono">{(previewPage - 1) * 50 + i + 1}</td>
                          {version.detected_columns.slice(0, 20).map((col) => (
                            <td key={col} className="mono" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[col] != null ? String(row[col]) : <span style={{ color: 'var(--text-dim)' }}>null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-footer">
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage(p => p - 1)}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Page {preview.page}
                  </span>
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={previewPage >= preview.total_pages}
                    onClick={() => setPreviewPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <div className="loading-overlay"><div className="spinner" /> Loading preview...</div>
            )}
          </div>
        )}

        {/* ── Quality Report Tab ──────────────────────────── */}
        {tab === 'quality' && (
          <div>
            <div className="grid-3" style={{ marginBottom: 20 }}>
              <div className="stat-card success">
                <div className="stat-label">Valid Rows</div>
                <div className="stat-value">{formatNum(version.valid_rows)}</div>
                <div className="stat-detail">
                  {version.row_count > 0 ? ((version.valid_rows / version.row_count) * 100).toFixed(1) : 0}% of total
                </div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">Warning Rows</div>
                <div className="stat-value">{formatNum(version.warning_rows)}</div>
              </div>
              <div className="stat-card danger">
                <div className="stat-label">Rejected Rows</div>
                <div className="stat-value">{formatNum(version.rejected_rows)}</div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><span className="card-title">Missing Values</span></div>
                <div className="card-body">
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
                    {formatNum(version.missing_values_count)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Total null/missing cells across all columns
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Duplicates</span></div>
                <div className="card-body">
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
                    {formatNum(version.duplicate_count)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Duplicate storm+timestamp records
                  </div>
                </div>
              </div>
            </div>

            {qr.sample_warnings?.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                  <span className="card-title" style={{ color: 'var(--warning-500)' }}>Sample Warnings</span>
                </div>
                <div className="card-body" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {qr.sample_warnings.map((w: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {qr.sample_rejections?.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                  <span className="card-title" style={{ color: 'var(--danger-400)' }}>Sample Rejections</span>
                </div>
                <div className="card-body" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {qr.sample_rejections.map((r: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Column Statistics Tab ───────────────────────── */}
        {tab === 'stats' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Column Statistics (sampled from first 1000 rows)</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Non-Null</th>
                    <th>Null %</th>
                    <th>Unique</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Mean</th>
                    <th>Std</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(version.column_statistics).map(([col, stats]: [string, any]) => (
                    <tr key={col}>
                      <td className="mono" style={{ fontWeight: 600 }}>{col}</td>
                      <td className="mono">{stats.non_null}</td>
                      <td className="mono">{stats.null_pct}%</td>
                      <td className="mono">{stats.unique}</td>
                      <td className="mono">{stats.min ?? '—'}</td>
                      <td className="mono">{stats.max ?? '—'}</td>
                      <td className="mono">{stats.mean ?? '—'}</td>
                      <td className="mono">{stats.std ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
