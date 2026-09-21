import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL, authHeaders, getUser, isLoggedIn, clearAuth } from '../lib/auth';
import ThemeToggle from '../components/ThemeToggle';
import Icon from '../components/Icon';

const categoryMeta = {
  pothole: {
    label: 'Pothole',
    icon: ['M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10z'],
    color: 'bg-amber-500/20 text-amber-300',
  },
  garbage: {
    label: 'Garbage',
    icon: ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6', 'M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2', 'M10 11v6', 'M14 11v6'],
    color: 'bg-lime-500/20 text-lime-300',
  },
  'water leakage': {
    label: 'Water Leakage',
    icon: ['M12 2.69l5.66 5.66a8 8 0 11-11.31 0z'],
    color: 'bg-cyan-500/20 text-cyan-300',
  },
  'broken streetlight': {
    label: 'Broken Light',
    icon: ['M9.663 17h4.673', 'M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'],
    color: 'bg-yellow-500/20 text-yellow-300',
  },
  'road obstruction': {
    label: 'Obstruction',
    icon: ['M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'],
    color: 'bg-orange-500/20 text-orange-300',
  },
  'drainage blockage': {
    label: 'Drainage Block',
    icon: ['M12 6v12', 'M17 13l-5 5-5-5', 'M5 21h14'],
    color: 'bg-blue-500/20 text-blue-300',
  },
  other: {
    label: 'Other',
    icon: ['M6 5a2 2 0 012-2h8a2 2 0 012 2v14l-6-4-6 4V5z'],
    color: 'bg-purple-500/20 text-purple-300',
  },
};

const severityMeta = {
  high: { label: 'High', color: 'bg-red-500/20 text-red-300' },
  medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  low: { label: 'Low', color: 'bg-emerald-500/20 text-emerald-300' },
};

const priorityMeta = {
  critical: { label: 'Critical', color: 'bg-purple-500/20 text-purple-300' },
  high: { label: 'High', color: 'bg-red-500/20 text-red-300' },
  medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  low: { label: 'Low', color: 'bg-emerald-500/20 text-emerald-300' },
};

const departmentList = ['Roads/Infrastructure', 'Sanitation', 'Electrical', 'Water Department', 'General', 'Unassigned'];

const statusColor = {
  Pending: 'bg-slate-700/50 text-slate-200',
  Acknowledged: 'bg-blue-500/20 text-blue-300',
  'In Progress': 'bg-amber-500/20 text-amber-300',
  Resolved: 'bg-emerald-500/20 text-emerald-300',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getImageUrl(c) {
  const img = c.images && c.images[0];
  if (!img || !img.url) return null;
  return img.url.startsWith('https://via.placeholder.com') ? null : img.url;
}

export default function Dashboard() {
  const router = useRouter();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewingImage, setViewingImage] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const user = getUser();

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/complaints`);
      setComplaints(res.data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`${API_URL}/api/complaints/${id}`, { status }, { headers: authHeaders() });
      setComplaints((prev) =>
        prev.map((c) => (c._id === id ? { ...c, status } : c))
      );
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const stats = {
    total: complaints.length,
    resolved: complaints.filter((c) => c.status === 'Resolved').length,
    pending: complaints.filter((c) => c.status === 'Pending').length,
    inProgress: complaints.filter((c) => c.status === 'In Progress').length,
    high: complaints.filter((c) => c.severity === 'high').length,
    critical: complaints.filter((c) => c.priority === 'critical').length,
  };

  const filtered = complaints.filter((c) => {
    const catOk = filter === 'all' || c.category === filter;
    const statusOk = statusFilter === 'all' || c.status === statusFilter;
    const deptOk = departmentFilter === 'all' || (c.departmentName || 'Unassigned') === departmentFilter;
    const priorityOk = priorityFilter === 'all' || (c.priority || 'medium') === priorityFilter;
    const term = search.toLowerCase().trim();
    const searchOk = !term || (c.title || '').toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term);
    return catOk && statusOk && deptOk && priorityOk && searchOk;
  });

  return (
    <>
      <Head>
        <title>CivicEye 2.0 — Dashboard</title>
      </Head>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
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
                <span className="block text-[10px] uppercase tracking-widest text-slate-500">Live Dashboard</span>
              </div>
            </Link>
            <div className="grid grid-flow-col auto-cols-max items-center gap-3">
              <ThemeToggle />
              <button
                onClick={fetchComplaints}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
              >
                Refresh
              </button>
              <Link
                href="/assistant"
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/20"
              >
                AI Assistant
              </Link>
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
              >
                Admin
              </Link>
              {user ? (
                <button
                  onClick={() => {
                    clearAuth();
                    router.replace('/login');
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/40 hover:text-red-300"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/20"
                >
                  Login
                </Link>
              )}
              <Link href="/report" className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:brightness-110">
                Report Issue
              </Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-6xl px-4 pt-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Live Complaints</h1>
            <p className="mt-2 text-sm text-slate-500">Real-time civic issue tracker</p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Total Reports"
              value={stats.total}
              icon={['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4']}
              accent="text-cyan-400"
            />
            <StatCard
              label="Pending"
              value={stats.pending}
              icon={['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z']}
              accent="text-amber-400"
            />
            <StatCard
              label="In Progress"
              value={stats.inProgress}
              icon={['M13 5l7 7-7 7M5 5l7 7-7 7']}
              accent="text-sky-400"
            />
            <StatCard
              label="Resolved"
              value={stats.resolved}
              icon={['M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z']}
              accent="text-emerald-400"
            />
            <StatCard
              label="High Severity"
              value={stats.high}
              icon={['M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z']}
              accent="text-red-400"
            />
            <StatCard
              label="Critical Priority"
              value={stats.critical}
              icon={['M12 11v5m0 5a9 9 0 110-18 9 9 0 010 18zm0-17v2']}
              accent="text-purple-400"
            />
          </div>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:items-center">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] gap-2">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
              {Object.entries(categoryMeta).map(([key, meta]) => (
                <FilterChip key={key} active={filter === key} onClick={() => setFilter(key)} label={meta.label} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-2 py-1 text-xs font-medium text-slate-300 outline-none focus:border-cyan-500"
                >
                  <option value="all">All</option>
                  {Object.entries(statusColor).map(([s]) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dept</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-2 py-1 text-xs font-medium text-slate-300 outline-none focus:border-cyan-500"
                >
                  <option value="all">All</option>
                  {departmentList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Priority</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-2 py-1 text-xs font-medium text-slate-300 outline-none focus:border-cyan-500"
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search complaints..."
                  className="input-field pl-9"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4">
            {loading && (
              <div className="glass-card grid grid-cols-1 place-content-center place-items-center gap-3 py-16">
                <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-cyan-500 border-t-transparent" />
                <p className="text-sm text-slate-500">Loading complaints...</p>
              </div>
            )}

            {error && (
              <div className="glass-card border-red-500/30 py-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-500/10">
                  <Icon
                    paths={['M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z']}
                    className="h-6 w-6 text-red-400"
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-red-300">Could not reach the server</p>
                <p className="mt-1 text-xs text-slate-500">{error}</p>
                <button onClick={fetchComplaints} className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white">
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="glass-card py-16 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-800/50">
                  <Icon
                    paths={['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z']}
                    className="h-7 w-7 text-slate-400"
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-400">No complaints found</p>
                <Link href="/report" className="mt-4 inline-block text-sm font-semibold text-cyan-400 hover:text-cyan-300">
                  Report the first one →
                </Link>
              </div>
            )}

            {!loading &&
              !error &&
              filtered.map((c, i) => {
                const cat = categoryMeta[c.category] || categoryMeta.other;
                const sev = severityMeta[c.severity] || severityMeta.medium;
                const photo = getImageUrl(c);
                return (
                  <div
                    key={c._id || i}
                    className="glass-card group p-5 transition-all duration-300 hover:border-cyan-500/20 animate-slide-up"
                    style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
                      {photo ? (
                        <button
                          onClick={() => setViewingImage(photo)}
                          className="group/photo relative h-20 w-20 overflow-hidden rounded-xl bg-slate-800/50 focus:outline-none"
                          title="Click to view full photo"
                        >
                          <img src={photo} alt={c.title || 'Complaint photo'} className="h-full w-full object-cover transition-transform duration-300 group-hover/photo:scale-110" />
                          <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover/photo:opacity-100">
                            <Icon paths={['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z']} className="h-5 w-5 text-white" />
                          </span>
                        </button>
                      ) : (
                        <div className="grid h-20 w-20 place-items-center rounded-xl bg-slate-800/50 transition-transform duration-300 group-hover:scale-105">
                          <Icon paths={cat.icon} className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="grid grid-cols-[1fr_auto] items-start justify-between gap-2">
                          <h3 className="font-semibold text-white">{c.title || 'Untitled report'}</h3>
                          <span className="text-[10px] font-medium text-slate-600">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">
                          {c.description || 'No description provided.'}
                        </p>
                        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] items-center gap-2">
                          <span className={`badge ${cat.color}`}>
                          <Icon paths={cat.icon} className="h-3 w-3" /> {cat.label}
                        </span>
                          <span className={`badge ${sev.color}`}>Severity: {sev.label}</span>
                          {(c.priority && c.priority !== 'medium') || c.priority === 'critical' ? (
                            <span className={`badge ${(priorityMeta[c.priority] || priorityMeta.medium).color}`}>
                              {(priorityMeta[c.priority] || priorityMeta.medium).label} priority
                            </span>
                          ) : null}
                          {c.departmentName && c.departmentName !== 'Unassigned' && (
                            <span className="badge bg-cyan-500/15 text-cyan-300">
                              <Icon
                                paths={['M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4']}
                                className="h-3 w-3"
                              /> {c.departmentName}
                            </span>
                          )}
                          <span className={`badge ${statusColor[c.status] || statusColor.Pending}`}>
                            <span className={`mr-1 h-1.5 w-1.5 rounded-full ${
                              c.status === 'Resolved' ? 'bg-emerald-400' :
                              c.status === 'In Progress' ? 'bg-amber-400' :
                              c.status === 'Acknowledged' ? 'bg-blue-400' : 'bg-slate-400'
                            }`} />
                            {c.status}
                          </span>
                          <select
                            value={c.status}
                            onChange={(e) => handleStatusChange(c._id, e.target.value)}
                            className="rounded-lg border border-slate-700/50 bg-slate-800/60 px-2 py-1 text-xs font-medium text-slate-300 outline-none transition-colors hover:border-slate-600 focus:border-cyan-500"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Acknowledged">Acknowledged</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                          {c.status === 'Resolved' && c.resolvedAt && (
                            <span className="badge bg-emerald-500/10 text-emerald-300">
                              <Icon paths={['M5 13l4 4L19 7']} className="h-3 w-3" /> {timeAgo(c.resolvedAt)}
                            </span>
                          )}
                          <span className="badge bg-slate-700/50 text-slate-300" title="Support score from linked/merged reports">
                            <Icon
                              paths={['M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z']}
                              className="h-3 w-3"
                            />
                            Support {c.supportScore || 1}
                          </span>
                          {c.mergedUsers && c.mergedUsers.length > 1 && (
                            <span className="badge bg-amber-500/15 text-amber-300" title="Multiple citizens reported/linked this issue">
                              <Icon paths={['M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z']} className="h-3 w-3" />
                              Merged x{c.mergedUsers.length}
                            </span>
                          )}
                          <span className="badge bg-slate-700/50 text-slate-300">
                            <Icon
                              paths={['M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z', 'M15 11a3 3 0 11-6 0 3 3 0 016 0z']}
                              className="h-3 w-3"
                            />
                            {c.location?.coordinates
                              ? [c.location.coordinates[1], c.location.coordinates[0]]
                                  .map((n) => n.toFixed(4))
                                  .join(', ')
                              : ''}
                          </span>
                        </div>
                        {(c.aiTimeline && c.aiTimeline.length > 0) || c.priorityReason ? (
                          <button
                            onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}
                            className="mt-3 grid grid-flow-col auto-cols-max items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-slate-800/60"
                          >
                            <svg className={`h-3.5 w-3.5 transition-transform ${expandedId === c._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                            AI Action Timeline
                          </button>
                        ) : null}
                        {expandedId === c._id && (c.aiTimeline?.length > 0 || c.priorityReason) && (
                          <div className="mt-3 rounded-xl border border-cyan-500/15 bg-slate-950/40 p-4">
                            {c.priorityReason && (
                              <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                                <span className="font-semibold text-slate-200">Priority:</span>{' '}
                                <span className={`badge mr-1 ${(priorityMeta[c.priority] || priorityMeta.medium).color}`}>
                                  {(priorityMeta[c.priority] || priorityMeta.medium).label}
                                </span>{' '}
                                {c.priorityReason}
                              </p>
                            )}
                            <ol className="space-y-2">
                              {(c.aiTimeline || []).map((ev, i) => (
                                <li key={i} className="grid grid-cols-[auto_1fr] items-start gap-3">
                                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-300">
                                    {i + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-200">{ev.step}</p>
                                    {ev.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{ev.detail}</p>}
                                    {ev.ts && <p className="mt-0.5 text-[10px] text-slate-600">{new Date(ev.ts).toLocaleString()}</p>}
                                  </div>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
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
              className="absolute -top-3 -right-3 grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-slate-300 shadow-lg transition-colors hover:bg-red-500/20 hover:text-red-300"
              title="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img src={viewingImage} alt="Complaint" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className="glass-card grid grid-cols-[auto_1fr] items-center gap-4 p-5">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-800/50">
        <Icon paths={icon} className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <div className={`text-2xl font-bold ${accent}`}>{value}</div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
          : 'border border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}