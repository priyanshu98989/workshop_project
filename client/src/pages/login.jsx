import React, { useState } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL, saveAuth } from '../lib/auth';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { name, email, password }
          : { email, password };
      const res = await axios.post(`${API_URL}${endpoint}`, body);
      saveAuth(res.data);
      const next = router.query.next;
      router.push(typeof next === 'string' ? next : '/report');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>CivicEye 2.0 — {mode === 'login' ? 'Login' : 'Register'}</title>
      </Head>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative min-h-screen">
        <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
          <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto] items-center px-6 py-4">
            <Link href="/" className="grid grid-flow-col auto-cols-max items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
                CE
              </div>
              <div>
                <span className="block text-sm font-bold text-white">
                  CivicEye <span className="text-cyan-400">2.0</span>
                </span>
                <span className="block text-[10px] uppercase tracking-widest text-slate-500">Account Access</span>
              </div>
            </Link>
            <div className="grid grid-flow-col auto-cols-max items-center gap-3">
              <ThemeToggle />
              <Link href="/dashboard" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white">
                Dashboard
              </Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto grid max-w-md place-items-center px-4 pt-16 pb-24">
          <div className="glass-card w-full p-8 animate-slide-up">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-cyan-500/25">
                CE
              </div>
              <h1 className="text-2xl font-bold text-white">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {mode === 'login'
                  ? 'Sign in with your email and password'
                  : 'Register to start reporting civic issues'}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-1">
              {['login', 'register'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all duration-200 ${
                    mode === m
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                />
              </div>

              {error && (
                <div className="animate-slide-up rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary grid w-full grid-flow-col auto-cols-max items-center justify-center gap-2 py-3.5 disabled:opacity-60"
              >
                {loading ? (
                  <span className="grid grid-flow-col auto-cols-max items-center gap-2">
                    <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white border-t-transparent" />
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : mode === 'login' ? (
                  'Sign In'
                ) : (
                  'Register'
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            Your credentials are securely stored on the CivicEye server.
          </p>
        </main>
      </div>
    </>
  );
}