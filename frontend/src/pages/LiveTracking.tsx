import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Wind, Compass, AlertTriangle, Globe, Eye,
  Play, Pause, RotateCcw, SkipBack, SkipForward,
  CheckCircle, RefreshCw, ChevronRight, Gauge, Target, Activity,
  Satellite, Navigation, Clock, Shield, Layers, Zap
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { liveApi, LiveStormData, LivePredictionData } from '../api';

function getCategory(wind_kts: number) {
  if (wind_kts < 34) return { code: 'TD', name: 'Tropical Depression', color: '#63b3ed' };
  if (wind_kts < 64) return { code: 'TS', name: 'Tropical Storm', color: '#4fd1c5' };
  if (wind_kts < 83) return { code: 'Cat 1', name: 'Category 1 Hurricane', color: '#f6e05e' };
  if (wind_kts < 96) return { code: 'Cat 2', name: 'Category 2 Hurricane', color: '#f6ad55' };
  if (wind_kts < 113) return { code: 'Cat 3', name: 'Category 3 Major', color: '#ed8936' };
  if (wind_kts < 137) return { code: 'Cat 4', name: 'Category 4 Major', color: '#e53e3e' };
  return { code: 'Cat 5', name: 'Category 5 Super Typhoon', color: '#9b2c2c' };
}

function MapRecenter({ center, autoFollow }: { center: [number, number]; autoFollow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (autoFollow && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 0.4 });
    }
  }, [center[0], center[1], autoFollow, map]);
  return null;
}

export default function LiveTracking() {
  const [activeStorms, setActiveStorms] = useState<LiveStormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStorm, setSelectedStorm] = useState<LiveStormData | null>(null);
  const [prediction, setPrediction] = useState<LivePredictionData | null>(null);
  const [predictLoading, setPredictLoading] = useState(false);
  const [filterBasin, setFilterBasin] = useState('ALL');

  const [mapLayer, setMapLayer] = useState<'satellite' | 'dark' | 'ocean'>('satellite');
  
  const [isTracing, setIsTracing] = useState(false);
  const [traceIndex, setTraceIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    loadActiveStorms();
  }, []);

  const loadActiveStorms = async () => {
    setLoading(true);
    try {
      const res = await liveApi.storms('active');
      if (res.success && res.data && res.data.length > 0) {
        setActiveStorms(res.data);
        const first = res.data[0];
        setSelectedStorm(first);
        setPrediction(first.latest_prediction);
        if (first.track && first.track.length > 0) {
          setTraceIndex(first.track.length - 1);
        }
      }
    } catch (e) {
      console.error('Failed to load live storms:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStorm = async (storm: LiveStormData) => {
    setSelectedStorm(storm);
    setIsTracing(false);
    setPrediction(storm.latest_prediction);
    if (storm.track && storm.track.length > 0) {
      setTraceIndex(storm.track.length - 1);
    } else {
      setTraceIndex(0);
    }
  };

  useEffect(() => {
    if (isTracing && selectedStorm?.track && selectedStorm.track.length > 0) {
      timerRef.current = setInterval(() => {
        setTraceIndex((prev) => {
          if (prev >= selectedStorm.track.length - 1) {
            setIsTracing(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracing, playbackSpeed, selectedStorm]);

  const handleToggleTrace = () => {
    if (!selectedStorm?.track?.length) return;
    if (traceIndex >= selectedStorm.track.length - 1) {
      setTraceIndex(0);
      setIsTracing(true);
    } else {
      setIsTracing(!isTracing);
    }
  };

  const handlePredictStorm = async (stormId: number) => {
    setPredictLoading(true);
    try {
      const res = await liveApi.predict(stormId);
      if (res.success && res.data) {
        // Find updated storm data to get the new prediction format
        const detailRes = await liveApi.storm(stormId);
        if (detailRes.success && detailRes.data && detailRes.data.prediction_runs && detailRes.data.prediction_runs.length > 0) {
           setPrediction(detailRes.data.prediction_runs[0]);
        }
      }
    } catch (e) {
      console.error('Prediction failed in live tracking:', e);
    } finally {
      setPredictLoading(false);
    }
  };

  const filteredStorms = activeStorms.filter(s => {
    if (filterBasin !== 'ALL' && s.basin !== filterBasin) return false;
    return true;
  });

  const currentObs = (selectedStorm?.track && selectedStorm.track[traceIndex])
    ? selectedStorm.track[traceIndex]
    : selectedStorm
      ? { lat: selectedStorm.latest_lat, lon: selectedStorm.latest_lon, wind_kts: selectedStorm.latest_wind_kts, pressure_hpa: selectedStorm.latest_pressure_hpa, time: selectedStorm.latest_observation_time }
      : null;

  const currentCat = currentObs ? getCategory(currentObs.wind_kts || 35) : getCategory(35);

  const mapCenter: [number, number] = currentObs && currentObs.lat && currentObs.lon
    ? [currentObs.lat, currentObs.lon]
    : [20.0, -85.0];

  return (
    <>
      <div className="page-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
        <div>
          <h1 className="page-title flex-gap">
            <Activity size={26} style={{ color: 'var(--neon-green)' }} />
            Live Cyclone Intelligence
            <span className="badge" style={{ background: 'var(--neon-green)', color: '#000', fontWeight: 'bold' }}>LIVE ONLINE</span>
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)' }}>
            Real-time satellite observation, active tracking animation, and continuous rolling AI predictions.
          </p>
        </div>
        <div className="flex-gap-sm">
          <span className="badge success flex-gap-xs" style={{ background: 'rgba(0,230,118,0.1)', color: 'var(--neon-green)', border: '1px solid rgba(0,230,118,0.2)' }}>
            <CheckCircle size={12} /> Sources Connected
          </span>
          <button className="btn btn-sm btn-primary" onClick={loadActiveStorms} disabled={loading} style={{ background: 'var(--neon-blue)' }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh Map
          </button>
        </div>
      </div>

      <div className="page-body animate-in">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          background: 'rgba(21, 27, 38, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div className="flex-gap">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-cyan)' }}>
              <Target size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>
              {filteredStorms.length} Active Target{filteredStorms.length !== 1 ? 's' : ''}
            </span>
            <div className="flex-gap-xs" style={{ marginLeft: 16 }}>
              {['ALL', 'EP', 'NA', 'WP', 'NI', 'SI', 'SP'].map(b => (
                <button
                  key={b}
                  className={`btn btn-sm ${filterBasin === b ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ 
                    padding: '2px 8px', fontSize: 11,
                    background: filterBasin === b ? 'rgba(0,140,255,0.15)' : 'transparent',
                    color: filterBasin === b ? 'var(--neon-cyan)' : 'var(--text-muted)'
                  }}
                  onClick={() => setFilterBasin(b)}
                >
                  {b === 'ALL' ? 'Global' : b}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-gap-sm" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Layers size={14} /> View:
            </span>
            <div className="flex-gap-xs" style={{ background: 'var(--bg-tertiary)', padding: 3, borderRadius: 6 }}>
              <button
                className={`btn btn-sm ${mapLayer === 'satellite' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '3px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, background: mapLayer === 'satellite' ? 'var(--neon-blue)' : '' }}
                onClick={() => setMapLayer('satellite')}
              >
                <Satellite size={13} /> Satellite
              </button>
              <button
                className={`btn btn-sm ${mapLayer === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '3px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, background: mapLayer === 'dark' ? 'var(--neon-blue)' : '' }}
                onClick={() => setMapLayer('dark')}
              >
                <Globe size={13} /> Dark GIS
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>
            {filteredStorms.map((storm) => {
              const cat = getCategory(storm.latest_wind_kts || 35);
              const isSelected = selectedStorm?.id === storm.id;

              return (
                <div
                  key={storm.id}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(0, 140, 255, 0.05)' : 'var(--bg-card)',
                    border: isSelected ? '1px solid rgba(0, 140, 255, 0.3)' : '1px solid var(--border-default)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 0 15px rgba(0,140,255,0.1)' : 'none'
                  }}
                  onClick={() => handleSelectStorm(storm)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {storm.name}
                        {isSelected && <span className="online-dot" style={{ background: 'var(--neon-green)', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{storm.storm_id} • {storm.basin}</div>
                    </div>
                    <span className="badge" style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40`, fontWeight: 'bold' }}>
                      {cat.code}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>WIND (KTS)</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: cat.color }}>{storm.latest_wind_kts ?? '--'} kt</div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>PRESSURE</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon-cyan)' }}>{storm.latest_pressure_hpa ?? '--'} hPa</div>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                       <Clock size={10} style={{ display: 'inline', marginRight: 4 }}/>
                       {storm.observation_count} obs
                     </div>
                     {storm.latest_prediction && (
                        <div style={{ fontSize: 10, color: 'var(--neon-purple)', background: 'rgba(157, 78, 221, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          <Zap size={10} style={{ display: 'inline', marginRight: 2}} /> AI Active
                        </div>
                     )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative', height: '50vh', minHeight: 400, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-default)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              <MapContainer
                center={mapCenter}
                zoom={5}
                style={{ width: '100%', height: '100%', background: '#0a0e17' }}
                zoomControl={false}
              >
                {mapLayer === 'satellite' && (
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                )}
                {mapLayer === 'dark' && (
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                  />
                )}

                <MapRecenter center={mapCenter} autoFollow={autoFollow} />

                {selectedStorm && selectedStorm.track && selectedStorm.track.slice(0, traceIndex + 1).map((point, idx, arr) => {
                  const ptCat = getCategory(point.wind_kts || 35);
                  if (idx > 0) {
                    const prev = arr[idx - 1];
                    return (
                      <Polyline
                        key={`line-${idx}`}
                        positions={[[prev.lat, prev.lon], [point.lat, point.lon]]}
                        color={ptCat.color}
                        weight={3}
                        opacity={0.8}
                      />
                    );
                  }
                  return null;
                })}

                {selectedStorm && selectedStorm.track && selectedStorm.track.slice(0, traceIndex + 1).map((point, idx) => {
                  const ptCat = getCategory(point.wind_kts || 35);
                  return (
                    <CircleMarker
                      key={`point-${idx}`}
                      center={[point.lat, point.lon]}
                      radius={idx === traceIndex ? 7 : 4}
                      fillColor={ptCat.color}
                      color={idx === traceIndex ? '#fff' : ptCat.color}
                      weight={idx === traceIndex ? 2 : 1}
                      fillOpacity={1}
                    >
                      <Popup className="dark-popup">
                        <div style={{ padding: '4px 8px' }}>
                          <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: ptCat.color }}>{ptCat.name}</div>
                          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Time: {new Date(point.time!).toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: '#fff' }}>Wind: {point.wind_kts} kts | Pres: {point.pressure_hpa} hPa</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {prediction && prediction.forecast_track && prediction.forecast_track.length > 0 && (
                  <>
                    <Polyline
                      positions={[
                        mapCenter,
                        [prediction.forecast_track[0].lat, prediction.forecast_track[0].lon]
                      ]}
                      color="rgba(255,255,255,0.5)"
                      weight={2}
                      dashArray="5, 5"
                    />
                    
                    {prediction.forecast_track.map((pt, idx, arr) => {
                      if (idx > 0) {
                        const prev = arr[idx - 1];
                        return (
                          <Polyline
                            key={`pred-line-${idx}`}
                            positions={[[prev.lat, prev.lon], [pt.lat, pt.lon]]}
                            color={pt.color}
                            weight={2}
                            dashArray="5, 5"
                          />
                        );
                      }
                      return null;
                    })}

                    {prediction.forecast_track.map((pt, idx) => (
                      <React.Fragment key={`pred-node-${idx}`}>
                        <Circle
                          center={[pt.lat, pt.lon]}
                          radius={pt.uncertainty_km * 1000}
                          color={pt.color}
                          fillColor={pt.color}
                          fillOpacity={0.15}
                          weight={1}
                          dashArray="4,4"
                        />
                        <CircleMarker
                          center={[pt.lat, pt.lon]}
                          radius={5}
                          fillColor={pt.color}
                          color="#fff"
                          weight={1}
                          fillOpacity={1}
                        >
                          <Popup className="dark-popup">
                            <div style={{ padding: '4px 8px' }}>
                              <div style={{ fontWeight: 'bold', fontSize: 13, color: pt.color }}>AI FORECAST +{pt.horizon_hours}H</div>
                              <div style={{ fontSize: 11, color: '#aaa', margin: '4px 0' }}>{new Date(pt.time).toLocaleString()}</div>
                              <div style={{ fontSize: 11, color: '#fff' }}>{pt.category_name}</div>
                              <div style={{ fontSize: 11, color: '#fff' }}>Wind: {pt.wind_kts} kts | Pres: {pt.pressure_hpa} hPa</div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      </React.Fragment>
                    ))}
                  </>
                )}
              </MapContainer>

              <div style={{
                position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 1000,
                background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(8px)',
                borderRadius: '8px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', gap: 16
              }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setTraceIndex(0)} title="Reset Trace">
                    <SkipBack size={16} />
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={handleToggleTrace} style={{ width: 36, padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {isTracing ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setTraceIndex(selectedStorm?.track?.length ? selectedStorm.track.length - 1 : 0); setIsTracing(false); }} title="Jump to Present">
                    <SkipForward size={16} />
                  </button>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span>Observation Trace</span>
                    <span style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>
                      {currentObs?.time ? new Date(currentObs.time).toLocaleString() : 'No Data'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={selectedStorm?.track?.length ? selectedStorm.track.length - 1 : 0}
                    value={traceIndex}
                    onChange={(e) => {
                      setTraceIndex(parseInt(e.target.value));
                      setIsTracing(false);
                    }}
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--neon-cyan)' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    className={`btn btn-sm ${autoFollow ? 'btn-secondary' : 'btn-ghost'}`} 
                    onClick={() => setAutoFollow(!autoFollow)}
                    title="Auto-pan Map"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    <Navigation size={13} style={{ marginRight: 4 }}/> Follow
                  </button>
                </div>
              </div>
            </div>

            {selectedStorm && (
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={18} style={{ color: 'var(--neon-purple)' }} />
                    Live AI Inference
                  </h3>
                  <button 
                    className="btn btn-sm" 
                    onClick={() => handlePredictStorm(selectedStorm.id)}
                    disabled={predictLoading || !selectedStorm.track || selectedStorm.track.length < 2}
                    style={{ background: 'var(--neon-purple)', color: '#fff', border: 'none' }}
                  >
                    {predictLoading ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
                    {predictLoading ? ' Computing Trajectory...' : ' Run Prediction Engine'}
                  </button>
                </div>

                {!selectedStorm.track || selectedStorm.track.length < 2 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                    Insufficient observations. Need at least 2 track points to establish a motion vector for the AI model.
                  </div>
                ) : prediction ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, borderLeft: '3px solid var(--neon-cyan)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PEAK INTENSITY FORECAST</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{prediction.summary.peak_wind_kts} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>kts</span></div>
                      <div style={{ fontSize: 13, color: getCategory(prediction.summary.peak_wind_kts).color, marginTop: 4 }}>
                        {prediction.summary.peak_category_name}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, borderLeft: '3px solid var(--neon-purple)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PREDICTED MIN PRESSURE</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{prediction.summary.min_pressure_hpa} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>hPa</span></div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        System intensifying
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, borderLeft: prediction.summary.landfall_alert ? '3px solid var(--neon-pink)' : '3px solid var(--neon-green)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>LANDFALL ALERT</div>
                      {prediction.summary.landfall_alert ? (
                        <>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--neon-pink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={16} /> HIGH RISK
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                            ETA: {prediction.summary.landfall_eta_hours} Hours
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--neon-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle size={16} /> CLEAR
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                            No imminent landfall detected
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                    Ready to run forecast. Click "Run Prediction Engine" to compute +72h trajectory.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
