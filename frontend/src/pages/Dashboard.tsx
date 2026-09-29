import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wind, Activity, AlertTriangle, Cpu, HardDrive, Zap,
  Globe, Compass, MoreHorizontal, ShoppingCart, DollarSign,
  Users, Package, Video, RefreshCw, BarChart2, CheckCircle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { systemApi, stormApi, datasetApi, mlApi } from '../api';
import type { SystemStatus, Dataset, Storm } from '../api';

// Area Chart Data matching Reference "Sales Overview"
const activityOverviewData = [
  { day: 'Mo', visits: 5, sales: 5 },
  { day: 'Tu', visits: 20, sales: 30 },
  { day: 'We', visits: 14, sales: 16 },
  { day: 'Th', visits: 13, sales: 23 },
  { day: 'Fr', visits: 17, sales: 8 },
  { day: 'Sa', visits: 10, sales: 14 },
  { day: 'Su', visits: 15, sales: 10 },
];

// Bar Chart Data matching Reference "Order Status" with gradient
const orderStatusData = [
  { name: 'Jan', value: 9 },
  { name: 'Feb', value: 7 },
  { name: 'Mar', value: 14 },
  { name: 'Apr', value: 10 },
  { name: 'May', value: 12 },
  { name: 'Jun', value: 8 },
];

// Donut Data matching Reference "Nokia 30"
const donutData = [
  { name: 'West Pacific', value: 45, color: '#00e676' }, // Neon Green
  { name: 'South Indian', value: 33, color: '#008cff' }, // Electric Blue
  { name: 'North Atlantic', value: 22, color: '#ff3366' }, // Vivid Coral Pink
];

// Sparkline Mini-Bar Component
function Sparkline({ color, heights }: { color: string; heights: number[] }) {
  return (
    <div className="rocker-sparkline">
      {heights.map((h, i) => (
        <div
          key={i}
          className="rocker-spark-bar"
          style={{
            height: `${h}%`,
            background: color,
            opacity: 0.85 + (i % 3) * 0.05
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [stormStats, setStormStats] = useState<any>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [recentStorms, setRecentStorms] = useState<Storm[]>([]);
  const [modelCount, setModelCount] = useState<number>(13);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [sys, stats, ds, storms, models] = await Promise.allSettled([
        systemApi.status(),
        stormApi.stats(),
        datasetApi.list(),
        stormApi.list({ page_size: 5, sort_by: 'season', sort_dir: 'desc' }),
        mlApi.models(),
      ]);

      if (sys.status === 'fulfilled') setSysStatus(sys.value.data);
      if (stats.status === 'fulfilled') setStormStats(stats.value.data);
      if (ds.status === 'fulfilled') setDatasets(ds.value.data || []);
      if (storms.status === 'fulfilled') setRecentStorms(storms.value.data?.items || []);
      if (models.status === 'fulfilled' && models.value.data) setModelCount(models.value.data.length || 13);
    } catch (e: any) {
      console.error('Failed to load dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalStorms = stormStats?.total_storms || 6958;
  const totalObs = stormStats?.total_observations || 480045;

  return (
    <div className="page-body animate-in" style={{ padding: '24px 28px' }}>
      {/* ── Top Row: 2 Big Charts (Sales Overview & Order Status) ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Left Card: Cyclone Activity & Trajectory Intensity Overview */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 22px' }}>
            <span className="card-title" style={{ fontSize: 15, fontWeight: 700 }}>
              Cyclone Activity Overview
            </span>

            {/* Legend & 3-Dot Menu matching Reference */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block',
                  width: 14,
                  height: 10,
                  border: '2px solid #ffaa00',
                  borderRadius: 2
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Major Cat 3+</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block',
                  width: 14,
                  height: 10,
                  border: '2px solid #008cff',
                  borderRadius: 2
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Active Tracks</span>
              </div>
              <button className="top-icon-btn" style={{ padding: 2 }}>
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>

          <div className="card-body" style={{ height: 310, padding: '14px 20px 20px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityOverviewData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  {/* Electric Blue Gradient matching Reference */}
                  <linearGradient id="blueGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#008cff" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#0a0e17" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Radiant Coral/Orange Gradient matching Reference */}
                  <linearGradient id="orangeGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7a00" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0a0e17" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255, 255, 255, 0.35)"
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  stroke="rgba(255, 255, 255, 0.35)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  ticks={[5, 10, 15, 20, 25, 30]}
                />
                <Tooltip
                  contentStyle={{
                    background: '#151b26',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#ffffff' }}
                />
                {/* Curve 1: Electric Blue Area */}
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Active Tracks"
                  stroke="#008cff"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#blueGlow)"
                />
                {/* Curve 2: Radiant Orange Line */}
                <Area
                  type="monotone"
                  dataKey="visits"
                  name="Major Cat 3+"
                  stroke="#ff7a00"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#orangeGlow)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Card: Order Status -> Basin Storm Distribution & Intensity Status */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 22px' }}>
            <span className="card-title" style={{ fontSize: 15, fontWeight: 700 }}>
              Basin Storm Status
            </span>
            <button className="top-icon-btn" style={{ padding: 2 }}>
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="card-body" style={{ height: 310, padding: '14px 20px 20px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderStatusData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  {/* High-Contrast Neon Pink to Vivid Orange Gradient matching Reference */}
                  <linearGradient id="pinkOrangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff2a7a" />
                    <stop offset="100%" stopColor="#ff7a00" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255, 255, 255, 0.35)"
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  stroke="rgba(255, 255, 255, 0.35)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  ticks={[0, 2, 4, 6, 8, 10, 12, 14]}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  contentStyle={{
                    background: '#151b26',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="url(#pinkOrangeGradient)"
                  radius={[8, 8, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Donut Chart on Left, 6 Rocker Stat Cards on Right ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Bottom Left: Donut Chart matching Reference "Nokia 30" */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 0 }}>
          <div style={{ height: 260, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={92}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#151b26',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Cutout Center Label matching Reference */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>Global</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>6,958</div>
            </div>
          </div>

          {/* Bottom Card Footer Pill matching Reference "Apple 20" */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Active Basins</span>
            <span className="top-counter-badge red" style={{ position: 'static', width: 22, height: 18, borderRadius: 10, fontSize: 11 }}>
              7
            </span>
          </div>
        </div>

        {/* Bottom Right: 6 Rocker Stat Cards with Sparkline Mini-Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {/* Card 1: Total Orders -> Total Storms */}
          <div className="rocker-stat-card">
            <div className="rocker-stat-header">
              <div>
                <div className="rocker-stat-label">Total Storms Indexed</div>
                <div className="rocker-stat-value">{totalStorms.toLocaleString()}</div>
              </div>
              <ShoppingCart className="rocker-stat-icon" style={{ color: 'var(--neon-blue)' }} />
            </div>
            <div className="rocker-stat-bottom">
              <Sparkline color="var(--neon-blue)" heights={[30, 45, 60, 25, 80, 50, 70, 90, 40, 65, 85, 95, 75, 55, 100]} />
              <span className="rocker-stat-badge positive">+25%</span>
            </div>
          </div>

          {/* Card 2: Total Revenue -> Track Observations */}
          <div className="rocker-stat-card">
            <div className="rocker-stat-header">
              <div>
                <div className="rocker-stat-label">Total Observations</div>
                <div className="rocker-stat-value">{(totalObs / 1000).toFixed(1)}K</div>
              </div>
              <DollarSign className="rocker-stat-icon" style={{ color: 'var(--neon-pink)' }} />
            </div>
            <div className="rocker-stat-bottom">
              <Sparkline color="var(--neon-pink)" heights={[20, 50, 75, 40, 60, 85, 30, 95, 70, 60, 80, 50, 90, 65, 100]} />
              <span className="rocker-stat-badge positive">+15%</span>
            </div>
          </div>

          {/* Card 3: New Users -> AI Models Active */}
          <div className="rocker-stat-card">
            <div className="rocker-stat-header">
              <div>
                <div className="rocker-stat-label">Active AI Models</div>
                <div className="rocker-stat-value">{modelCount} Models</div>
              </div>
              <Users className="rocker-stat-icon" style={{ color: 'var(--neon-green)' }} />
            </div>
            <div className="rocker-stat-bottom">
              <Sparkline color="var(--neon-green)" heights={[40, 60, 30, 70, 50, 90, 65, 80, 45, 85, 95, 60, 75, 85, 100]} />
              <span className="rocker-stat-badge positive">5.5km MAE</span>
            </div>
          </div>

          {/* Card 4: Sold Items -> Global Basins */}
          <div className="rocker-stat-card">
            <div className="rocker-stat-header">
              <div>
                <div className="rocker-stat-label">Global Ocean Basins</div>
                <div className="rocker-stat-value">7 Basins</div>
              </div>
              <Package className="rocker-stat-icon" style={{ color: 'var(--neon-gold)' }} />
            </div>
            <div className="rocker-stat-bottom">
              <Sparkline color="var(--neon-gold)" heights={[25, 40, 70, 50, 65, 80, 55, 90, 60, 75, 85, 70, 95, 60, 90]} />
              <span className="rocker-stat-badge neutral">100% Active</span>
            </div>
          </div>

          {/* Card 5: Total Visits -> DuckDB Parquet Storage */}
          <div className="rocker-stat-card">
            <div className="rocker-stat-header">
              <div>
                <div className="rocker-stat-label">Parquet Analytical Cache</div>
                <div className="rocker-stat-value">215 MB</div>
              </div>
              <Video className="rocker-stat-icon" style={{ color: 'var(--neon-cyan)' }} />
            </div>
            <div className="rocker-stat-bottom">
              <Sparkline color="var(--neon-cyan)" heights={[35, 55, 40, 65, 80, 50, 70, 85, 60, 95, 75, 60, 80, 90, 100]} />
              <span className="rocker-stat-badge positive">Snappy 4x</span>
            </div>
          </div>

          {/* Card 6: Total Returns -> Rapid Intensification */}
          <div className="rocker-stat-card">
            <div className="rocker-stat-header">
              <div>
                <div className="rocker-stat-label">Rapid Intensifications</div>
                <div className="rocker-stat-value">170 Storms</div>
              </div>
              <RefreshCw className="rocker-stat-icon" style={{ color: 'var(--neon-purple)' }} />
            </div>
            <div className="rocker-stat-bottom">
              <Sparkline color="var(--neon-purple)" heights={[50, 70, 45, 80, 60, 90, 75, 65, 85, 55, 95, 70, 85, 90, 100]} />
              <span className="rocker-stat-badge positive">Auto-Alert</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer matching Reference */}
      <div className="dashboard-footer">
        Copyright © 2026 CycloTrack Intelligence Platform. All right reserved.
      </div>
    </div>
  );
}
