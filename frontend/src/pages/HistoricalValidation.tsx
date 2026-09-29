import { CheckCircle, Info } from 'lucide-react';

export default function HistoricalValidation() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historical Validation & Backtesting</h1>
          <p className="page-subtitle">Backtest AI predictions on historical storms with no data leakage</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(49,130,206,0.06)', border: '1px solid rgba(49,130,206,0.15)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          <Info size={14} style={{ marginRight: 6, color: 'var(--primary-300)' }} />
          Backtesting simulates predictions at a historical cutoff time, using only data available up to that point.
          Future observations are revealed only for validation — never leaked to the model input.
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Backtesting Workflow</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Select Cyclone</label>
                <select className="form-select" disabled><option>— Requires trained model —</option></select>
              </div>
              <div className="form-group">
                <label className="form-label">Historical Cutoff Time</label>
                <input type="datetime-local" className="form-input" disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Prediction Horizon</label>
                <div className="flex-gap-sm">
                  {['6h', '12h', '24h', '48h'].map(h => (
                    <button key={h} className="btn btn-sm btn-secondary" disabled>{h}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Model</label>
                <select className="form-select" disabled><option>— No models available —</option></select>
              </div>
            </div>
            <button className="btn btn-primary" disabled style={{ marginTop: 12 }}>
              <CheckCircle size={14} /> Run Backtest
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><span className="card-title">Backtesting Results</span></div>
          <div className="empty-state">
            <CheckCircle className="empty-state-icon" />
            <div className="empty-state-title">No Backtests Yet</div>
            <div className="empty-state-text">
              Select a historical cyclone, set a cutoff time, and run a backtest to compare
              AI predictions against actual observed outcomes.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
