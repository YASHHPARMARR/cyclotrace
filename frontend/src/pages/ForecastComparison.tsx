import { GitCompare, Info } from 'lucide-react';

export default function ForecastComparison() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Forecast Validation</h1>
          <p className="page-subtitle">Compare AI predictions against official forecasts and actual outcomes</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(237,137,54,0.06)', border: '1px solid rgba(237,137,54,0.15)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          <strong style={{ color: 'var(--accent-400)' }}>⚠ Important:</strong>{' '}
          Comparisons are historical measurements, not proof that any system is universally better.
          The AI prediction, official forecast, and actual outcome are always clearly distinguished.
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title flex-gap-sm"><GitCompare size={14} /> Comparison Panel</span></div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>6h</th>
                    <th>12h</th>
                    <th>24h</th>
                    <th>48h</th>
                  </tr>
                </thead>
                <tbody>
                  {['Position Error (km)', 'Wind MAE (kt)', 'Pressure MAE (hPa)', 'Track Bias'].map(m => (
                    <tr key={m}>
                      <td style={{ fontWeight: 600 }}>{m}</td>
                      <td className="mono" style={{ color: 'var(--text-dim)' }}>—</td>
                      <td className="mono" style={{ color: 'var(--text-dim)' }}>—</td>
                      <td className="mono" style={{ color: 'var(--text-dim)' }}>—</td>
                      <td className="mono" style={{ color: 'var(--text-dim)' }}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 13 }}>
              No comparison data available yet. Generate predictions and compare against actual outcomes.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
