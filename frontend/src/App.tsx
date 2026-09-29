import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MapPin, History, Database,
  Box, Target, Settings, Wind, Search, Sun,
  Grid, Bell, Inbox, Globe, ChevronLeft, ChevronRight,
  Activity, BarChart2
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LiveTracking from './pages/LiveTracking';
import HistoricalExplorer from './pages/HistoricalExplorer';
import StormDetail from './pages/StormDetail';
import SatelliteReplay from './pages/SatelliteReplay';
import DatasetManager from './pages/DatasetManager';
import DatasetDetail from './pages/DatasetDetail';
import DataQuality from './pages/DataQuality';
import FeatureEngineering from './pages/FeatureEngineering';
import TrainingCenter from './pages/TrainingCenter';
import ModelRegistry from './pages/ModelRegistry';
import PredictionCenter from './pages/PredictionCenter';
import ForecastComparison from './pages/ForecastComparison';
import HistoricalValidation from './pages/HistoricalValidation';
import Analytics from './pages/Analytics';
import SystemMonitor from './pages/SystemMonitor';
import SettingsPage from './pages/SettingsPage';
import './index.css';

const navSections = [
  {
    label: 'DASHBOARD',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Overview' },
      { to: '/analytics', icon: BarChart2, label: 'Alternate Analytics' },
    ],
  },
  {
    label: 'CYCLONE OPERATIONS',
    items: [
      { to: '/live', icon: MapPin, label: 'Live Tracking & Satellite', badge: 'LIVE', badgeType: 'live' },
      { to: '/predict', icon: Target, label: 'AI Prediction Center', badge: 'AI', badgeType: 'ai' },
      { to: '/explorer', icon: History, label: 'Historical Cyclones' },
    ],
  },
  {
    label: 'DATA & INTELLIGENCE',
    items: [
      { to: '/datasets', icon: Database, label: 'Dataset Manager' },
      { to: '/models', icon: Box, label: 'Model Registry' },
    ],
  },
  {
    label: 'SYSTEM & MANUAL',
    items: [
      { to: '/settings', icon: Settings, label: 'System Manual & Settings' },
      { to: '/monitor', icon: Activity, label: 'System Monitor' },
    ],
  },
];

function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  return (
    <aside className="sidebar" style={{ width: collapsed ? '72px' : '250px', minWidth: collapsed ? '72px' : '250px' }}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Wind size={20} />
          </div>
          {!collapsed && (
            <div>
              <div className="sidebar-title">CycloTrack</div>
            </div>
          )}
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div className="nav-section" key={section.label}>
            {!collapsed && <div className="nav-section-label">{section.label}</div>}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="nav-icon" size={17} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className={`nav-badge ${item.badgeType || ''}`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function TopNavbar() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="top-navbar">
      {/* Search Input Bar matching Reference UI */}
      <div className="top-search-container">
        <Search className="top-search-icon" size={15} />
        <input
          type="text"
          placeholder="Search cyclones, datasets, models..."
          className="top-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Right Action Icons & User Profile */}
      <div className="top-actions">
        {/* Basin Selector Pill */}
        <div className="top-basin-badge">
          <Globe size={13} style={{ color: 'var(--neon-cyan)' }} />
          <span>Global Basins</span>
        </div>

        {/* Light/Dark Mode Icon */}
        <button className="top-icon-btn" title="Toggle Theme (Dark Mode Active)">
          <Sun size={16} />
        </button>

        {/* App Grid Icon */}
        <button className="top-icon-btn" title="Quick Tools">
          <Grid size={16} />
        </button>

        {/* Alert Bell with Counter Badge */}
        <div className="top-icon-wrapper">
          <button className="top-icon-btn" title="Active Storm Warnings">
            <Bell size={16} />
          </button>
          <span className="top-counter-badge red">7</span>
        </div>

        {/* Dataset/Data Inbox with Counter Badge */}
        <div className="top-icon-wrapper">
          <button className="top-icon-btn" title="Ingested Datasets & Models">
            <Inbox size={16} />
          </button>
          <span className="top-counter-badge orange">8</span>
        </div>

        {/* User Profile */}
        <div className="top-user-profile">
          <div className="user-avatar-wrap">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80"
              alt="Avatar"
              className="user-avatar"
            />
            <span className="online-dot" />
          </div>
          <div className="user-info">
            <div className="user-name">Dr. Elena Vance</div>
            <div className="user-role">Lead Meteorologist</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="main-content">
          <TopNavbar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/live" element={<LiveTracking />} />
            <Route path="/explorer" element={<HistoricalExplorer />} />
            <Route path="/explorer/:stormId" element={<StormDetail />} />
            <Route path="/satellite" element={<SatelliteReplay />} />
            <Route path="/datasets" element={<DatasetManager />} />
            <Route path="/datasets/:versionId" element={<DatasetDetail />} />
            <Route path="/quality" element={<DataQuality />} />
            <Route path="/features" element={<FeatureEngineering />} />
            <Route path="/training" element={<TrainingCenter />} />
            <Route path="/models" element={<ModelRegistry />} />
            <Route path="/predict" element={<PredictionCenter />} />
            <Route path="/compare" element={<ForecastComparison />} />
            <Route path="/validation" element={<HistoricalValidation />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/monitor" element={<SystemMonitor />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
