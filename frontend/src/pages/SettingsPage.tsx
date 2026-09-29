import React, { useState, useEffect } from 'react';
import {
  BookOpen, Database, Activity, Target, MapPin, Search, Server, ShieldCheck, Play, ArrowRight, ActivitySquare, AlertTriangle
} from 'lucide-react';
import { liveApi, systemApi, SystemStatus, SourceStatusData } from '../api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'manual' | 'status'>('manual');
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [liveSources, setLiveSources] = useState<SourceStatusData[]>([]);

  useEffect(() => {
    if (activeTab === 'status') {
      systemApi.status().then(res => {
        if (res.success) setSysStatus(res.data);
      });
      liveApi.sources().then(res => {
        if (res.success) setLiveSources(res.data);
      });
    }
  }, [activeTab]);

  return (
    <>
      <div className="page-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
        <div>
          <h1 className="page-title flex-gap">
            <BookOpen size={26} style={{ color: 'var(--neon-purple)' }} />
            System Manual & Settings
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)' }}>
            Complete operational guide on using CycloTrack and platform health status.
          </p>
        </div>
        <div className="flex-gap-sm">
          <span className="badge success flex-gap-xs" style={{ background: 'rgba(0,230,118,0.1)', color: 'var(--neon-green)', border: '1px solid rgba(0,230,118,0.2)' }}>
            <ShieldCheck size={13} /> Secure & Offline Ready
          </span>
        </div>
      </div>

      <div className="page-body animate-in">
        <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border-default)', paddingBottom: 12, marginBottom: 20 }}>
          <button
            className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('manual')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: activeTab === 'manual' ? 'var(--neon-purple)' : 'transparent' }}
          >
            <BookOpen size={16} /> User Manual & Operational Guide
          </button>
          <button
            className={`btn ${activeTab === 'status' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('status')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: activeTab === 'status' ? 'var(--neon-blue)' : 'transparent' }}
          >
            <ActivitySquare size={16} /> System Health & Data Sources
          </button>
        </div>

        {activeTab === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(157, 78, 221, 0.15) 0%, rgba(0, 140, 255, 0.05) 100%)', border: '1px solid rgba(157, 78, 221, 0.3)', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ background: 'var(--neon-purple)', padding: 12, borderRadius: 12, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={28} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Welcome to CycloTrack</h2>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    CycloTrack is a next-generation tropical cyclone intelligence platform. It seamlessly unifies historical data ingestion, 
                    machine learning inference, and real-time live cyclone tracking into a single cohesive system. Follow the steps below to start 
                    generating insights from your data.
                  </p>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="card-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
                <span className="card-title flex-gap-sm" style={{ color: 'var(--neon-blue)', fontSize: 16 }}>
                  <Play size={18} /> End-to-End Workflow Guide
                </span>
              </div>
              <div className="card-body" style={{ padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                  
                  {/* Step 1 */}
                  <div style={{ background: 'var(--bg-tertiary)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 16 }}>
                    <div style={{ background: 'rgba(0,140,255,0.1)', color: 'var(--neon-blue)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 18, flexShrink: 0 }}>1</div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Database size={16} style={{ color: 'var(--neon-blue)'}}/> Upload Your CSV Data
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                        Navigate to the <strong>Dataset Manager</strong>. Here you can upload CSV files containing cyclone observation data (like IBTrACS). 
                        The system will automatically validate the schema, extract geographic coordinates, wind speeds, and pressures.
                      </p>
                      <div style={{ fontSize: 12, background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 6, color: 'var(--text-secondary)' }}>
                        <strong>Note:</strong> Uploaded datasets immediately populate the historical explorer and act as a simulated live feed.
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div style={{ background: 'var(--bg-tertiary)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 16 }}>
                    <div style={{ background: 'rgba(255,170,0,0.1)', color: 'var(--neon-amber)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 18, flexShrink: 0 }}>2</div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Target size={16} style={{ color: 'var(--neon-amber)'}}/> Run AI Predictions
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                        Go to the <strong>AI Prediction Center</strong> to analyze the data you just uploaded. You can instantly run the existing 
                        Machine Learning models to forecast +72h trajectories, predict intensity curves (wind/pressure), and calculate the cone of uncertainty for any historical storm.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div style={{ background: 'var(--bg-tertiary)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 16 }}>
                    <div style={{ background: 'rgba(0,230,118,0.1)', color: 'var(--neon-green)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 18, flexShrink: 0 }}>3</div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={16} style={{ color: 'var(--neon-green)'}}/> Live Tracking & Intelligence
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                        Open <strong>Live Tracking</strong> to see real-time observations. 
                        The Live module continuously pulls the latest active cyclones, providing interactive playbacks of the storm's path over high-resolution satellite basemaps.
                        You can trigger rolling AI predictions directly on the live map to assess landfall threats.
                      </p>
                      <div style={{ fontSize: 12, background: 'rgba(0,230,118,0.05)', padding: '8px 12px', borderRadius: 6, color: 'var(--neon-green)' }}>
                        <strong>Tip:</strong> Ensure you hit "Refresh Map" to pull the most recent observations.
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {sysStatus ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                 <div className="stat-card" style={{ background: 'var(--bg-tertiary)', padding: 20, borderRadius: 12, border: '1px solid var(--border-subtle)'}}>
                   <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>CPU USAGE</div>
                   <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{sysStatus.cpu_percent}%</div>
                 </div>
                 <div className="stat-card" style={{ background: 'var(--bg-tertiary)', padding: 20, borderRadius: 12, border: '1px solid var(--border-subtle)'}}>
                   <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>MEMORY USAGE</div>
                   <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{sysStatus.memory_used_gb.toFixed(1)} GB</div>
                   <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>of {sysStatus.memory_total_gb.toFixed(1)} GB</div>
                 </div>
                 <div className="stat-card" style={{ background: 'var(--bg-tertiary)', padding: 20, borderRadius: 12, border: '1px solid var(--border-subtle)'}}>
                   <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>DATABASE STORMS</div>
                   <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{sysStatus.storm_count}</div>
                 </div>
                 <div className="stat-card" style={{ background: 'var(--bg-tertiary)', padding: 20, borderRadius: 12, border: '1px solid var(--border-subtle)'}}>
                   <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>MODELS IN REGISTRY</div>
                   <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{sysStatus.model_count}</div>
                 </div>
              </div>
            ) : (
              <div>Loading system status...</div>
            )}
            
            <h3 style={{ fontSize: 16, marginTop: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>Live Data Sources Configuration</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {liveSources.length > 0 ? liveSources.map((src, idx) => (
                <div key={idx} style={{ background: 'var(--bg-tertiary)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                     <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{src.display_name}</h4>
                     <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interval: {src.poll_interval_seconds}s | Requests: {src.total_requests}</div>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <div style={{ fontSize: 12, textAlign: 'right', color: 'var(--text-muted)' }}>
                       <div style={{ marginBottom: 4 }}>Last Check: {src.last_success ? new Date(src.last_success).toLocaleTimeString() : 'Never'}</div>
                       <div>Ingested: <strong style={{ color: 'var(--text-primary)' }}>{src.total_observations}</strong> obs</div>
                     </div>
                     <span className="badge" style={{ 
                       background: src.state === 'connected' ? 'rgba(0,230,118,0.1)' : 'rgba(255,170,0,0.1)',
                       color: src.state === 'connected' ? 'var(--neon-green)' : 'var(--neon-amber)',
                       border: `1px solid ${src.state === 'connected' ? 'rgba(0,230,118,0.3)' : 'rgba(255,170,0,0.3)'}`
                     }}>
                       {src.state.toUpperCase()}
                     </span>
                   </div>
                </div>
              )) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No live sources initialized.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
