import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

const features = [
  {
    icon: '📸',
    title: 'Snap & Report',
    description: 'Capture a photo of any civic issue and our AI instantly classifies and routes it.',
  },
  {
    icon: '🤖',
    title: 'AI Classification',
    description: 'Gemini-powered analysis identifies issue category, severity, and responsible department.',
  },
  {
    icon: '📍',
    title: 'Auto Location',
    description: 'GPS tagging ensures authorities know exactly where the problem is.',
  },
  {
    icon: '⚡',
    title: 'Duplicate Detection',
    description: 'Smart deduplication merges duplicate reports and boosts support scores.',
  },
  {
    icon: '📊',
    title: 'Live Dashboard',
    description: 'Track every complaint from submission to resolution in real-time.',
  },
  {
    icon: '🏛️',
    title: 'Dept Routing',
    description: 'Automatic assignment to the correct municipal department.',
  },
];

const stats = [
  { value: '30s', label: 'Report Time' },
  { value: 'AI', label: 'Classification' },
  { value: '24/7', label: 'Availability' },
  { value: '100%', label: 'Free' },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>CivicEye 2.0 — AI-Powered Civic Issue Reporting</title>
        <meta name="description" content="Report civic issues instantly with AI-powered classification and routing." />
      </Head>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-purple-500/3 blur-[80px]" />
      </div>

      <div className="relative min-h-screen">
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center px-6 py-4">
            <div className="grid grid-flow-col auto-cols-max items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
                CE
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                CivicEye <span className="text-cyan-400">2.0</span>
              </span>
            </div>
            <div className="grid grid-flow-col auto-cols-max items-center gap-3">
              <Link
                href="/assistant"
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/20"
              >
                AI Assistant
              </Link>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/report"
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:brightness-110"
              >
                Report Issue
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative grid min-h-screen place-content-center px-6 pt-20 text-center">
          <div className="mb-6 animate-fade-in">
            <span className="inline-grid grid-flow-col auto-cols-max items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse-slow" />
              AI-Powered Civic Intelligence
            </span>
          </div>

          <h1 className="mb-6 max-w-4xl animate-slide-up text-5xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl">
            <span className="text-white">Report. </span>
            <span className="gradient-text">Classify. </span>
            <span className="text-white">Resolve.</span>
          </h1>

          <p className="mb-10 max-w-2xl animate-slide-up text-lg leading-relaxed text-slate-400" style={{ animationDelay: '0.1s' }}>
            Snap a photo of any civic issue — potholes, garbage, broken lights — and our AI instantly
            classifies it, detects duplicates, and routes it to the right department.
          </p>

          <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-[auto_auto] sm:justify-center" style={{ animationDelay: '0.2s' }}>
            <Link
              href="/report"
              className="btn-primary grid grid-flow-col auto-cols-max items-center gap-2 text-base"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Report an Issue
            </Link>
            <Link
              href="/dashboard"
              className="grid grid-flow-col auto-cols-max items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-6 py-3.5 text-base font-semibold text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/50 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Dashboard
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 gap-6 sm:grid-cols-4" style={{ animationDelay: '0.3s' }}>
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card px-6 py-5 text-center">
                <div className="text-2xl font-bold text-cyan-400 glow-text">{stat.value}</div>
                <div className="mt-1 text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 animate-bounce">
            <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        {/* Features */}
        <section className="relative px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">How It Works</h2>
              <p className="mt-4 text-lg text-slate-500">From snap to solution in under 30 seconds</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <div
                  key={feature.title}
                  className="glass-card group p-6 transition-all duration-300 hover:border-cyan-500/20 hover:glow-cyan"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-slate-800 text-2xl transition-transform duration-300 group-hover:scale-110">
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="glass-card glow-cyan p-12">
              <h2 className="mb-4 text-3xl font-bold text-white">Ready to Make a Difference?</h2>
              <p className="mb-8 text-lg text-slate-400">
                Your report can fix real problems in your city. Take 30 seconds now.
              </p>
              <Link
                href="/report"
                className="btn-primary inline-grid grid-flow-col auto-cols-max items-center gap-2 text-lg"
              >
                Start Reporting
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800/50 px-6 py-8">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid grid-flow-col auto-cols-max items-center gap-2 text-sm text-slate-600">
              <div className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-cyan-500 to-blue-600 text-[10px] font-bold text-white">
                CE
              </div>
              CivicEye 2.0
            </div>
            <p className="text-xs text-slate-700">AI-Powered Civic Intelligence Platform</p>
          </div>
        </footer>
      </div>
    </>
  );
}
