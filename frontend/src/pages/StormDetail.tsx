import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wind, Gauge, Clock, MapPin, Activity } from 'lucide-react';
import { stormApi } from '../api';
import type { Storm, StormObservation, TrackPoint } from '../api';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import 'leaflet/dist/leaflet.css';

function getCategoryColor(wind: number | null): string {
  if (!wind) return '#718096';
  if (wind >= 137) return '#ff3860';
  if (wind >= 113) return '#ff6b35';
  if (wind >= 96) return '#ffa600';
  if (wind >= 83) return '#ffe066';
  if (wind >= 64) return '#93e7b8';
  if (wind >= 34) return '#7ec8e3';
  return '#a0aec0';
}

export default function StormDetail() {
  const { stormId } = useParams();
  const [storm, setStorm] = useState<Storm | null>(null);
  const [observations, setObservations] = useState<StormObservation[]>([]);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'track' | 'timeline' | 'data'>('overview');

  useEffect(() => {
    if (stormId) loadStorm(parseInt(stormId));
  }, [stormId]);

  async function loadStorm(id: number) {
    try {
      const [obsRes, trackRes] = await Promise.all([
        stormApi.observations(id),
        stormApi.track(id),
      ]);
      setStorm(obsRes.data.storm);
      setObservations(obsRes.data.observations || []);
      setTrack(trackRes.data.track || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="page-header"><div className="page-title">Loading...</div></div>
        <div className="page-body"><div className="loading-overlay"><div className="spinner" /></div></div>
      </>
    );
  }

  if (!storm) {
    return (
      <>
        <div className="page-header"><div className="page-title">Storm Not Found</div></div>
        <div className="page-body">
          <div className="empty-state">
            <div className="empty-state-title">Storm not found</div>
            <Link to="/explorer" className="btn btn-primary" style={{ marginTop: 12 }}>Back to Explorer</Link>
          </div>
        </div>
      </>
    );
  }

  const trackCoords: [number, number][] = track
    .filter(p => p.lat != null && p.lon != null)
    .map(p => [p.lat, p.lon]);

  const center: [number, number] = trackCoords.length > 0
    ? trackCoords[Math.floor(trackCoords.length / 2)]
    : [20, 80];

  // Prepare chart data
  const chartData = observations
    .filter(o => o.timestamp)
    .map(o => ({
      time: new Date(o.timestamp!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }),
      wind: o.wind_speed,
      pressure: o.pressure,
    }));

  return (
    <>
      <div className="page-header">
        <div className="flex-gap">
          <Link to="/explorer" className="btn btn-sm btn-secondary"><ArrowLeft size={14} /></Link>
          <div>
            <h1 className="page-title">
              {storm.name !== 'UNNAMED' ? storm.name : storm.storm_id}
            </h1>
            <p className="page-subtitle">
              {storm.storm_id} · {storm.basin} · Season {storm.season}
            </p>
          </div>
        </div>
      </div>

      <div className="page-body animate-in">
        {/* ── Stats ───────────────────────────────────────── */}
        <div className="stat-grid">
          <div className="stat-card primary">
            <div className="stat-label">Max Wind</div>
            <div className="stat-value" style={{ color: getCategoryColor(storm.max_wind) }}>
              {storm.max_wind ?? '—'} <span style={{ fontSize: 14 }}>kt</span>
            </div>
          </div>
          <div className="stat-card info">
            <div className="stat-label">Min Pressure</div>
            <div className="stat-value">{storm.min_pressure ?? '—'} <span style={{ fontSize: 14 }}>hPa</span></div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Duration</div>
            <div className="stat-value">{storm.duration_hours?.toFixed(0) ?? '—'} <span style={{ fontSize: 14 }}>h</span></div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Track Length</div>
            <div className="stat-value">{storm.track_length_km?.toFixed(0) ?? '—'} <span style={{ fontSize: 14 }}>km</span></div>
          </div>
          <div className="stat-card info">
            <div className="stat-label">Observations</div>
            <div className="stat-value">{storm.num_observations}</div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="tabs">
          <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            <MapPin size={13} /> Track Map
          </button>
          <button className={`tab ${tab === 'timeline' ? 'active' : ''}`} onClick={() => setTab('timeline')}>
            <Activity size={13} /> Intensity Timeline
          </button>
          <button className={`tab ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>
            <Clock size={13} /> Observation Data
          </button>
        </div>

        {/* ── Track Map ───────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Storm Track</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {trackCoords.length} track points · Colors indicate wind intensity
              </span>
            </div>
            <div className="map-container large">
              {trackCoords.length > 0 ? (
                <MapContainer center={center} zoom={4} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                    attribution="&copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                    maxZoom={16}
                  />
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                    attribution=""
                    maxZoom={16}
                  />
                  <Polyline
                    positions={trackCoords}
                    pathOptions={{ color: '#4299e1', weight: 2, opacity: 0.6 }}
                  />
                  {track.map((pt, i) => (
                    <CircleMarker
                      key={i}
                      center={[pt.lat, pt.lon]}
                      radius={4}
                      pathOptions={{
                        fillColor: getCategoryColor(pt.wind),
                        color: getCategoryColor(pt.wind),
                        fillOpacity: 0.8,
                        weight: 1,
                      }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                          <strong>{pt.time ? new Date(pt.time).toLocaleString() : 'Unknown time'}</strong><br />
                          Position: {pt.lat?.toFixed(1)}°, {pt.lon?.toFixed(1)}°<br />
                          Wind: {pt.wind ?? '—'} kt<br />
                          Pressure: {pt.pressure ?? '—'} hPa
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-title">No track data available</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Intensity Timeline ──────────────────────────── */}
        {tab === 'timeline' && chartData.length > 0 && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><span className="card-title flex-gap-sm"><Wind size={14} /> Wind Speed</span></div>
              <div className="card-body" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fill: '#718096', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#718096', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#1a2332',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="wind" stroke="#4299e1" strokeWidth={2} dot={false} name="Wind (kt)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title flex-gap-sm"><Gauge size={14} /> Pressure</span></div>
              <div className="card-body" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fill: '#718096', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#718096', fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        background: '#1a2332',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="pressure" stroke="#ed8936" strokeWidth={2} dot={false} name="Pressure (hPa)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── Observation Data ─────────────────────────────── */}
        {tab === 'data' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">All Observations</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{observations.length} records</span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 500 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Timestamp</th>
                    <th>Lat</th>
                    <th>Lon</th>
                    <th>Wind (kt)</th>
                    <th>Pressure (hPa)</th>
                    <th>Speed</th>
                    <th>Direction</th>
                    <th>Nature</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map((o, i) => (
                    <tr key={o.id}>
                      <td className="mono">{i + 1}</td>
                      <td className="mono">{o.timestamp ? new Date(o.timestamp).toLocaleString() : '—'}</td>
                      <td className="mono">{o.latitude?.toFixed(2) ?? '—'}</td>
                      <td className="mono">{o.longitude?.toFixed(2) ?? '—'}</td>
                      <td className="mono" style={{ color: getCategoryColor(o.wind_speed), fontWeight: 600 }}>
                        {o.wind_speed ?? '—'}
                      </td>
                      <td className="mono">{o.pressure ?? '—'}</td>
                      <td className="mono">{o.storm_speed ?? '—'}</td>
                      <td className="mono">{o.storm_direction ?? '—'}</td>
                      <td>{o.nature ?? '—'}</td>
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
