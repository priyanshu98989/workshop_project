import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL, authHeaders, getUser, isLoggedIn, clearAuth } from '../lib/auth';
import ThemeToggle from '../components/ThemeToggle';

const categoryMeta = {
  pothole: { label: 'Pothole', icon: '🕳️', color: 'bg-amber-500/20 text-amber-300' },
  garbage: { label: 'Garbage', icon: '🗑️', color: 'bg-lime-500/20 text-lime-300' },
  'water leakage': { label: 'Water Leakage', icon: '💧', color: 'bg-cyan-500/20 text-cyan-300' },
  'broken streetlight': { label: 'Broken Light', icon: '💡', color: 'bg-yellow-500/20 text-yellow-300' },
  'road obstruction': { label: 'Obstruction', icon: '🚧', color: 'bg-orange-500/20 text-orange-300' },
  'drainage blockage': { label: 'Drainage Block', icon: '🌀', color: 'bg-blue-500/20 text-blue-300' },
  other: { label: 'Other', icon: '📌', color: 'bg-purple-500/20 text-purple-300' },
};

const severityMeta = {
  high: { label: 'High', color: 'bg-red-500/20 text-red-300' },
  medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  low: { label: 'Low', color: 'bg-emerald-500/20 text-emerald-300' },
};

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

export default function Dashboard() {
  const router = useRouter();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
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
    high: complaints.filter((c) => c.severity === 'high').length,
  };

  const filtered = complaints.filter((c) => {
    const catOk = filter === 'all' || c.category === filter;
    const term = search.toLowerCase().trim();
    const searchOk = !term || (c.title || '').toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term);
    return catOk && searchOk;
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
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Reports" value={stats.total} icon="📋" accent="text-cyan-400" />
            <StatCard label="Pending" value={stats.pending} icon="⏳" accent="text-amber-400" />
            <StatCard label="Resolved" value={stats.resolved} icon="✅" accent="text-emerald-400" />
            <StatCard label="High Severity" value={stats.high} icon="🚨" accent="text-red-400" />
          </div>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] gap-2">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
              {Object.entries(categoryMeta).map(([key, meta]) => (
                <FilterChip key={key} active={filter === key} onClick={() => setFilter(key)} label={meta.label} />
              ))}
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search complaints..."
                className="input-field pl-9"
                style={{ width: '220px' }}
              />
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
                <div className="text-3xl">📡</div>
                <p className="mt-3 text-sm font-medium text-red-300">Could not reach the server</p>
                <p className="mt-1 text-xs text-slate-500">{error}</p>
                <button onClick={fetchComplaints} className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white">
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="glass-card py-16 text-center">
                <div className="text-4xl">🎉</div>
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
                return (
                  <div
                    key={c._id || i}
                    className="glass-card group p-5 transition-all duration-300 hover:border-cyan-500/20 animate-slide-up"
                    style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
                      <div className="grid h-20 w-20 place-items-center rounded-xl bg-slate-800/50 text-4xl transition-transform duration-300 group-hover:scale-105">
                        {cat.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="grid grid-cols-[1fr_auto] items-start justify-between gap-2">
                          <h3 className="font-semibold text-white">{c.title || 'Untitled report'}</h3>
                          <span className="text-[10px] font-medium text-slate-600">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">
                          {c.description || 'No description provided.'}
                        </p>
                        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] items-center gap-2">
                          <span className={`badge ${cat.color}`}>{cat.icon} {cat.label}</span>
                          <span className={`badge ${sev.color}`}>Severity: {sev.label}</span>
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
                              ✅ {timeAgo(c.resolvedAt)}
                            </span>
                          )}
                          <span className="badge bg-slate-700/50 text-slate-300">
                            🤝 {c.supportScore || 1}
                          </span>
                          <span className="badge bg-slate-700/50 text-slate-300">
                            📍 {(c.location?.coordinates || []).map((n) => n.toFixed(4)).join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </main>
      </div>
    </>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className="glass-card grid grid-cols-[auto_1fr] items-center gap-4 p-5">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-800/50 text-2xl">{icon}</div>
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