import { Satellite, AlertTriangle, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export default function SatelliteReplay() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Satellite Replay</h1>
          <p className="page-subtitle">Replay historical satellite imagery synchronized with storm data</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(49,130,206,0.06)', border: '1px solid rgba(49,130,206,0.15)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          <Satellite size={14} style={{ marginRight: 6, color: 'var(--primary-300)' }} />
          Satellite replay requires uploaded satellite image sequences or NetCDF data.
          Upload satellite frames via the <strong>Dataset Manager</strong> and associate them with storms.
          Full replay engine with synchronized map and timeline is available in Phase 6.
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Replay Controls</span>
          </div>
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-secondary" disabled><SkipBack size={16} /></button>
              <button className="btn btn-primary" disabled><Play size={16} /></button>
              <button className="btn btn-secondary" disabled><Pause size={16} /></button>
              <button className="btn btn-secondary" disabled><SkipForward size={16} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {['0.5x', '1x', '2x', '4x'].map(s => (
                <button key={s} className={`btn btn-sm ${s === '1x' ? 'btn-primary' : 'btn-secondary'}`} disabled>{s}</button>
              ))}
            </div>
            <div style={{ padding: '40px', color: 'var(--text-dim)', fontSize: 13, marginTop: 20 }}>
              <Satellite size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div>No satellite frames loaded</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Upload satellite image sequences or NetCDF data to enable replay</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
