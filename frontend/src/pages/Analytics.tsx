import { useEffect, useState } from 'react';
import { BarChart3, Wind, Gauge, Globe } from 'lucide-react';
import { stormApi } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#4299e1', '#48bb78', '#ed8936', '#f56565', '#0bc5ea', '#a78bfa', '#f6ad55', '#68d391'];

export default function Analytics() {
  const [basins, setBasins] = useState<{ basin: string; count: number }[]>([]);
  const [seasons, setSeasons] = useState<{ season: number; count: number }[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [b, s, st] = await Promise.all([
        stormApi.basins(),
        stormApi.seasons(),
        stormApi.stats(),
      ]);
      setBasins(b.data || []);
      setSeasons((s.data || []).slice(0, 30));
      setStats(st.data);
    } catch {} finally { setLoading(false); }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Visualize storm distributions, patterns, and trends</p>
        </div>
      </div>
      <div className="page-body animate-in">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : (
          <>
            {stats && (
              <div className="stat-grid">
                <div className="stat-card primary">
                  <div className="stat-label">Total Storms</div>
                  <div className="stat-value">{stats.total_storms?.toLocaleString()}</div>
                </div>
                <div className="stat-card info">
                  <div className="stat-label">Total Observations</div>
                  <div className="stat-value">{stats.total_observations?.toLocaleString()}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">Avg Max Wind</div>
                  <div className="stat-value">{stats.avg_max_wind ?? '—'} kt</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-label">Lowest Pressure</div>
                  <div className="stat-value">{stats.lowest_pressure ?? '—'} hPa</div>
                </div>
              </div>
            )}

            <div className="grid-2" style={{ marginBottom: 24 }}>
              <div className="card">
                <div className="card-header"><span className="card-title flex-gap-sm"><Globe size={14} /> Storms by Basin</span></div>
                <div className="card-body" style={{ height: 300 }}>
                  {basins.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={basins} dataKey="count" nameKey="basin" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} label={(entry: any) => `${entry.basin || entry.name || ''} (${entry.count || entry.value || 0})`}>
                          {basins.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state"><div className="empty-state-text">No basin data</div></div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title flex-gap-sm"><BarChart3 size={14} /> Storms by Season (Recent)</span></div>
                <div className="card-body" style={{ height: 300 }}>
                  {seasons.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...seasons].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="season" tick={{ fill: '#718096', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#718096', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="count" fill="#4299e1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state"><div className="empty-state-text">No season data</div></div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
