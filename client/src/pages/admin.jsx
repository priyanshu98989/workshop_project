import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL, authHeaders, getUser, clearAuth } from '../lib/auth';
import { loadLeaflet, addTileLayer, fitToMarkers, escapeHtml, hasCoordinates, DEFAULT_CENTER, DEFAULT_ZOOM } from '../lib/leaflet';
import {
  categoryMeta,
  priorityMeta,
  statusColor,
  STATUS_FILTERS,
  PRIORITY_FILTERS,
  DEFAULT_CATEGORY,
  DEFAULT_PRIORITY,
  DEFAULT_STATUS_COLOR,
} from '../lib/complaintMeta';
import ThemeToggle from '../components/ThemeToggle';
import Icon from '../components/Icon';

const ICON_DOCUMENT = ['M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'];
const ICON_DEPARTMENT = ['M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'];
const ICON_CATEGORY = ['M4 6h16M4 12h16M4 18h16'];
const ICON_CLOSE = ['M6 18L18 6M6 6l12 12'];

const timeframe = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getImage = (c) => {
  const img = c.images && c.images[0];
  if (!img || !img.url) return null;
  return img.url.startsWith('https://via.placeholder.com') ? null : img.url;
};

const byCountDesc = (a, b) => b[1] - a[1];

const popupHtml = (p) =>
  `<b>${escapeHtml(p.title || 'Complaint')}</b><br/>${escapeHtml(p.category)} · ${escapeHtml(p.status)}` +
  `<br/>Priority: <b>${escapeHtml(p.priority || DEFAULT_PRIORITY)}</b>` +
  (p.department ? `<br/>Dept: ${escapeHtml(p.department)}` : '');

export default function AdminDashboard() {
  const router = useRouter();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewingImage, setViewingImage] = useState(null);
  const user = getUser();
  const fetchTokenRef = useRef(0);

  const fetchAll = async () => {
    // Rapid Refresh clicks fire overlapping requests; without a token the slower
    // earlier one can resolve last and overwrite the fresher data.
    const token = (fetchTokenRef.current += 1);
    setLoading(true);
    setError(null);
    try {
      const [complaintsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/complaints`, { headers: authHeaders() }),
        axios.get(`${API_URL}/api/complaints/stats`, { headers: authHeaders() }),
      ]);
      if (token !== fetchTokenRef.current) return;
      setComplaints(complaintsRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (err) {
      if (token !== fetchTokenRef.current) return;
      setError(err.response?.data?.error || err.message);
    } finally {
      if (token === fetchTokenRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    return () => {
      fetchTokenRef.current += 1;
    };
  }, []);

  const departments = useMemo(
    () => (stats?.byDepartment ? Object.entries(stats.byDepartment).sort(byCountDesc) : []),
    [stats]
  );

  const categories = useMemo(
    () => Object.entries(stats?.byCategory || {}).sort(byCountDesc),
    [stats]
  );

  const filtered = useMemo(
    () =>
      complaints.filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
        if (departmentFilter !== 'all' && (c.departmentName || 'Unassigned') !== departmentFilter) return false;
        if (priorityFilter !== 'all' && (c.priority || DEFAULT_PRIORITY) !== priorityFilter) return false;
        return true;
      }),
    [complaints, statusFilter, categoryFilter, departmentFilter, priorityFilter]
  );

  // Memoized so ComplaintMap's [points] effect only re-paints on real changes.
  const points = useMemo(
    () =>
      filtered
        .filter((c) => hasCoordinates(c.location))
        .map((c) => ({
          id: c._id,
          lat: c.location.coordinates[1],
          lng: c.location.coordinates[0],
          title: c.title,
          category: c.category,
          severity: c.severity,
          priority: c.priority,
          status: c.status,
          department: c.departmentName,
        })),
    [filtered]
  );

  return (
    <>
      <Head>
        <title>CivicEye 2.0 — Authority Dashboard</title>
      </Head>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <div className="relative min-h-screen pb-24">
        <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center px-6 py-4">
            <Link href="/" className="grid grid-flow-col auto-cols-max items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
                CE
              </div>
              <div>
                <span className="block text-sm font-bold text-white">
                  CivicEye <span className="text-cyan-400">2.0</span>
                </span>
                <span className="block text-[10px] uppercase tracking-widest text-slate-500">Authority Dashboard</span>
              </div>
            </Link>
            <div className="grid grid-flow-col auto-cols-max items-center gap-3">
              <ThemeToggle />
              <button
                onClick={fetchAll}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
              >
                Refresh
              </button>
              <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white">
                Citizen View
              </Link>
              {user && (
                <button
                  onClick={() => {
                    clearAuth();
                    router.replace('/login');
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/40 hover:text-red-300"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-6xl px-4 pt-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Authority Dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">Total, pending, in-progress and resolved complaints across departments</p>
          </div>

          {error && (
            <div className="glass-card border-red-500/30 py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-500/10">
                <Icon paths={ICON_DOCUMENT} className="h-6 w-6 text-red-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-red-300">Could not reach the server</p>
              <p className="mt-1 text-xs text-slate-500">{error}</p>
              <button onClick={fetchAll} className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white">
                Try Again
              </button>
            </div>
          )}

          {loading ? (
            <div className="glass-card grid grid-cols-1 place-content-center place-items-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-cyan-500 border-t-transparent" />
              <p className="text-sm text-slate-500">Loading authority data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total Complaints" value={stats?.total ?? 0} accent="text-cyan-400" />
                <StatCard label="Pending" value={stats?.byStatus?.Pending ?? 0} accent="text-amber-400" />
                <StatCard label="In Progress" value={stats?.byStatus?.['In Progress'] ?? 0} accent="text-sky-400" />
                <StatCard label="Resolved" value={stats?.byStatus?.Resolved ?? 0} accent="text-emerald-400" />
                <StatCard label="High Issues" value={stats?.bySeverity?.high ?? 0} accent="text-red-400" />
                <StatCard label="Critical Priority" value={stats?.byPriority?.critical ?? 0} accent="text-purple-400" />
              </div>

              {/* Department + category breakdowns */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BreakdownCard
                  title="By Department"
                  icon={ICON_DEPARTMENT}
                  rows={departments}
                  onFilter={(name) => {
                    setDepartmentFilter((prev) => (prev === name ? 'all' : name));
                  }}
                  active={departmentFilter}
                />
                <BreakdownCard
                  title="By Category"
                  icon={ICON_CATEGORY}
                  rows={categories}
                  onFilter={(name) => {
                    setCategoryFilter((prev) => (prev === name ? 'all' : name));
                  }}
                  active={categoryFilter}
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
                  <option value="all">All</option>
                  {STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </FilterSelect>
                <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter}>
                  <option value="all">All</option>
                  {Object.entries(categoryMeta).map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </FilterSelect>
                <FilterSelect label="Department" value={departmentFilter} onChange={setDepartmentFilter}>
                  <option value="all">All</option>
                  {departments.map(([name]) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </FilterSelect>
                <FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter}>
                  <option value="all">All</option>
                  {PRIORITY_FILTERS.map((p) => (
                    <option key={p} value={p}>{priorityMeta[p].label}</option>
                  ))}
                </FilterSelect>
              </div>

              {/* Map */}
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800/50 px-5 py-3.5">
                  <p className="text-sm font-semibold text-white">Complaint Map — {points.length} location{points.length === 1 ? '' : 's'}</p>
                  <span className="badge bg-cyan-500/15 text-cyan-300">
                    {filtered.length} matching
                  </span>
                </div>
                <ComplaintMap points={points} />
              </div>

              {/* List */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-white">Complaints ({filtered.length})</p>
                {filtered.length === 0 && (
                  <div className="glass-card py-12 text-center text-sm text-slate-500">
                    No complaints match the selected filters.
                  </div>
                )}
                {filtered.map((c) => {
                  const cat = categoryMeta[c.category] || DEFAULT_CATEGORY;
                  const pr = priorityMeta[c.priority] || priorityMeta[DEFAULT_PRIORITY];
                  const photo = getImage(c);
                  return (
                    <div key={c._id} className="glass-card flex gap-4 p-4">
                      {photo ? (
                        <button
                          onClick={() => setViewingImage(photo)}
                          className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-800/50"
                          title="View photo"
                        >
                          <img src={photo} alt={c.title || 'Complaint'} className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-800/50">
                          <Icon paths={cat.icon} className="h-7 w-7 text-slate-400" strokeWidth={2} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-[1fr_auto] items-start justify-between gap-2">
                          <h3 className="truncate font-semibold text-white">{c.title || 'Untitled report'}</h3>
                          <span className="text-[10px] text-slate-600">{timeframe(c.createdAt)}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] gap-2">
                          <span className={`badge ${cat.color}`}>{cat.label}</span>
                          <span className={`badge ${pr.color}`}>{pr.label} priority</span>
                          <span className={`badge ${statusColor[c.status] || DEFAULT_STATUS_COLOR}`}>{c.status}</span>
                          {c.departmentName && c.departmentName !== 'Unassigned' && (
                            <span className="badge bg-cyan-500/15 text-cyan-300">{c.departmentName}</span>
                          )}
                          <span className="badge bg-slate-700/50 text-slate-300">
                            Support {c.supportScore || 1}
                          </span>
                          {hasCoordinates(c.location) && (
                            <span className="badge bg-slate-700/50 text-slate-300">
                              {[c.location.coordinates[1], c.location.coordinates[0]].map((n) => n.toFixed(4)).join(', ')}
                            </span>
                          )}
                        </div>
                        {c.priorityReason && (
                          <p className="mt-2 text-[11px] text-slate-500">{c.priorityReason}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {viewingImage && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-3 -right-3 grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-slate-300 shadow-lg hover:bg-red-500/20 hover:text-red-300"
            >
              <Icon paths={ICON_CLOSE} className="h-5 w-5" strokeWidth={2} />
            </button>
            <img src={viewingImage} alt="Complaint" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="glass-card p-5">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, icon, rows, onFilter, active }) {
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div className="glass-card p-5">
      <div className="mb-3 grid grid-flow-col auto-cols-max items-center gap-2">
        <Icon paths={icon} className="h-4 w-4 text-cyan-400" />
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(([name, count]) => (
            <button
              key={name}
              onClick={() => onFilter(name)}
              className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-800/50"
            >
              <span className={`truncate text-xs ${active === name ? 'font-semibold text-cyan-300' : 'text-slate-300'}`}>
                {name}
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600"
                  style={{ width: `${total ? Math.round((count / total) * 100) : 0}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs font-semibold text-slate-400">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-2 py-1 text-xs font-medium text-slate-300 outline-none focus:border-cyan-500"
      >
        {children}
      </select>
    </label>
  );
}

function renderMarkers(L, map, points, markersRef) {
  markersRef.current.forEach((m) => m.remove());
  markersRef.current = points.map((p) =>
    L.marker([p.lat, p.lng]).addTo(map).bindPopup(popupHtml(p))
  );
  fitToMarkers(L, map, markersRef.current);
}

function ComplaintMap({ points }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  // Read inside the async Leaflet callback so a late script load paints the
  // latest points rather than the ones captured on first render.
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const createMap = useCallback((L) => {
    if (mapRef.current || !containerRef.current) return;
    const current = pointsRef.current;
    const center = current.length ? [current[0].lat, current[0].lng] : DEFAULT_CENTER;
    const map = L.map(containerRef.current, { center, zoom: current.length ? 13 : DEFAULT_ZOOM });
    addTileLayer(L, map);
    mapRef.current = map;
    renderMarkers(L, map, current, markersRef);
  }, []);

  useEffect(() => {
    const cancel = loadLeaflet(createMap);
    return () => {
      cancel();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, [createMap]);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return; // createMap paints the first batch on load.
    renderMarkers(L, mapRef.current, points, markersRef);
  }, [points]);

  return (
    <div className="relative" style={{ minHeight: '320px' }}>
      <div ref={containerRef} className="h-80 w-full" />
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/60">
          <p className="text-sm text-slate-500">No pinned complaint locations match the filters.</p>
        </div>
      )}
    </div>
  );
}