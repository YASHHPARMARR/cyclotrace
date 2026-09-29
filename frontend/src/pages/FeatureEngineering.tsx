import { Layers, Info } from 'lucide-react';

const FEATURES = [
  { name: 'latitude', type: 'raw', desc: 'Current latitude' },
  { name: 'longitude', type: 'raw', desc: 'Current longitude' },
  { name: 'wind_speed', type: 'raw', desc: 'Current max sustained wind' },
  { name: 'pressure', type: 'raw', desc: 'Central pressure' },
  { name: 'prev_latitude', type: 'derived', desc: 'Previous observation latitude' },
  { name: 'prev_longitude', type: 'derived', desc: 'Previous observation longitude' },
  { name: 'delta_lat', type: 'derived', desc: 'Latitude displacement since last observation' },
  { name: 'delta_lon', type: 'derived', desc: 'Longitude displacement since last observation' },
  { name: 'storm_speed', type: 'derived', desc: 'Movement speed (km/h)' },
  { name: 'storm_direction', type: 'derived', desc: 'Movement bearing (degrees)' },
  { name: 'wind_change_6h', type: 'derived', desc: '6-hour wind speed change' },
  { name: 'wind_change_12h', type: 'derived', desc: '12-hour wind speed change' },
  { name: 'wind_change_24h', type: 'derived', desc: '24-hour wind speed change' },
  { name: 'pressure_change_6h', type: 'derived', desc: '6-hour pressure change' },
  { name: 'pressure_change_12h', type: 'derived', desc: '12-hour pressure change' },
  { name: 'pressure_change_24h', type: 'derived', desc: '24-hour pressure change' },
  { name: 'track_curvature', type: 'derived', desc: 'Rate of track direction change' },
  { name: 'acceleration', type: 'derived', desc: 'Storm speed acceleration/deceleration' },
  { name: 'distance_travelled', type: 'derived', desc: 'Cumulative track distance (km)' },
  { name: 'sin_lat', type: 'transformed', desc: 'Sine of latitude (for cyclical encoding)' },
  { name: 'cos_lat', type: 'transformed', desc: 'Cosine of latitude' },
  { name: 'sin_lon', type: 'transformed', desc: 'Sine of longitude' },
  { name: 'cos_lon', type: 'transformed', desc: 'Cosine of longitude' },
  { name: 'season_day', type: 'temporal', desc: 'Day of the cyclone season' },
  { name: 'hour_of_day', type: 'temporal', desc: 'Hour of observation (UTC)' },
];

export default function FeatureEngineering() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Feature Engineering</h1>
          <p className="page-subtitle">Define and configure features derived from cyclone observations</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(49,130,206,0.06)', border: '1px solid rgba(49,130,206,0.15)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          <Info size={14} style={{ marginRight: 6, color: 'var(--primary-300)' }} />
          Feature computation runs automatically during training dataset preparation (Phase 4).
          Below is the catalogue of available features that will be derived from raw observations.
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title flex-gap-sm"><Layers size={14} /> Feature Catalogue</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{FEATURES.length} features</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontWeight: 600 }}>{f.name}</td>
                    <td><span className={`badge ${f.type === 'raw' ? 'validated' : f.type === 'derived' ? 'processing' : f.type === 'transformed' ? 'training' : 'observation'}`}>{f.type}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
