import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, History, Wind, Gauge, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { stormApi } from '../api';
import type { Storm } from '../api';

export default function HistoricalExplorer() {
  const [storms, setStorms] = useState<Storm[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [basins, setBasins] = useState<{ basin: string; count: number }[]>([]);
  const [seasons, setSeasons] = useState<{ season: number; count: number }[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterBasin, setFilterBasin] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [sortBy, setSortBy] = useState('season');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadStorms();
  }, [page, filterBasin, filterSeason, sortBy, sortDir]);

  async function loadFilters() {
    try {
      const [b, s, st] = await Promise.all([
        stormApi.basins(),
        stormApi.seasons(),
        stormApi.stats(),
      ]);
      setBasins(b.data || []);
      setSeasons(s.data || []);
      setStats(st.data);
    } catch {}
  }

  async function loadStorms() {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: 50,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (filterBasin) params.basin = filterBasin;
      if (filterSeason) params.season = parseInt(filterSeason);
      if (search) params.search = search;

      const res = await stormApi.list(params);
      const data = res.data;
      setStorms(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch {
      setStorms([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPage(1);
    loadStorms();
  }

  function getCategoryColor(wind: number | null): string {
    if (!wind) return 'var(--text-dim)';
    if (wind >= 137) return '#ff3860';
    if (wind >= 113) return '#ff6b35';
    if (wind >= 96) return '#ffa600';
    if (wind >= 83) return '#ffe066';
    if (wind >= 64) return '#93e7b8';
    if (wind >= 34) return '#7ec8e3';
    return 'var(--text-muted)';
  }

  function getCategory(wind: number | null): string {
    if (!wind) return '—';
    if (wind >= 137) return 'Cat 5';
    if (wind >= 113) return 'Cat 4';
    if (wind >= 96) return 'Cat 3';
    if (wind >= 83) return 'Cat 2';
    if (wind >= 64) return 'Cat 1';
    if (wind >= 34) return 'TS';
    return 'TD';
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historical Cyclone Explorer</h1>
          <p className="page-subtitle">
            Search and analyze {total.toLocaleString()} historical tropical cyclones
          </p>
        </div>
      </div>

      <div className="page-body animate-in">
        {/* ── Stats ───────────────────────────────────────── */}
        {stats && (
          <div className="stat-grid">
            <div className="stat-card primary">
              <div className="stat-label">Total Storms</div>
              <div className="stat-value">{stats.total_storms?.toLocaleString()}</div>
              <div className="stat-detail">{stats.season_range?.[0]}–{stats.season_range?.[1]}</div>
            </div>
            <div className="stat-card info">
              <div className="stat-label">Observations</div>
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

        {/* ── Filters ─────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
                <label className="form-label">Search</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Storm name, ID, or basin..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSearch}>
                    <Search size={14} />
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Basin</label>
                <select
                  className="form-select"
                  value={filterBasin}
                  onChange={(e) => { setFilterBasin(e.target.value); setPage(1); }}
                  style={{ width: 140 }}
                >
                  <option value="">All Basins</option>
                  {basins.map((b) => (
                    <option key={b.basin} value={b.basin}>{b.basin} ({b.count})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Season</label>
                <select
                  className="form-select"
                  value={filterSeason}
                  onChange={(e) => { setFilterSeason(e.target.value); setPage(1); }}
                  style={{ width: 120 }}
                >
                  <option value="">All Seasons</option>
                  {seasons.slice(0, 50).map((s) => (
                    <option key={s.season} value={s.season}>{s.season} ({s.count})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Sort By</label>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ width: 130 }}
                >
                  <option value="season">Season</option>
                  <option value="max_wind">Max Wind</option>
                  <option value="min_pressure">Min Pressure</option>
                  <option value="duration_hours">Duration</option>
                  <option value="name">Name</option>
                </select>
              </div>

              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              >
                {sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Results ─────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex-gap-sm">
              <History size={14} /> Storm Records
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {storms.length} of {total.toLocaleString()}
            </span>
          </div>

          {loading ? (
            <div className="loading-overlay"><div className="spinner" /> Searching storms...</div>
          ) : storms.length === 0 ? (
            <div className="empty-state">
              <Globe className="empty-state-icon" />
              <div className="empty-state-title">No Storms Found</div>
              <div className="empty-state-text">
                {total === 0
                  ? 'Upload and process a cyclone dataset to populate storm records.'
                  : 'Try adjusting your filters or search terms.'}
              </div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Storm ID</th>
                      <th>Name</th>
                      <th>Season</th>
                      <th>Basin</th>
                      <th>Category</th>
                      <th>Max Wind (kt)</th>
                      <th>Min Pres (hPa)</th>
                      <th>Duration (h)</th>
                      <th>Track (km)</th>
                      <th>Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storms.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/explorer/${s.id}`} className="mono" style={{ fontWeight: 600 }}>
                            {s.storm_id}
                          </Link>
                        </td>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td className="mono">{s.season ?? '—'}</td>
                        <td><span className="badge processing">{s.basin ?? '—'}</span></td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 700,
                            color: getCategoryColor(s.max_wind),
                            background: `${getCategoryColor(s.max_wind)}15`,
                          }}>
                            {getCategory(s.max_wind)}
                          </span>
                        </td>
                        <td className="mono" style={{ color: getCategoryColor(s.max_wind), fontWeight: 600 }}>
                          {s.max_wind ?? '—'}
                        </td>
                        <td className="mono">{s.min_pressure ?? '—'}</td>
                        <td className="mono">{s.duration_hours?.toFixed(0) ?? '—'}</td>
                        <td className="mono">{s.track_length_km?.toFixed(0) ?? '—'}</td>
                        <td className="mono">{s.num_observations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="card-footer">
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
