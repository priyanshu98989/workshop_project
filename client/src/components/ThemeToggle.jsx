import React, { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [light, setLight] = useState(false);

  useEffect(() => {
    let stored = null;
    try {
      stored = window.localStorage.getItem('civiceye_theme');
    } catch {}
    const prefersLight =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    setLight(stored === 'light' || (!stored && prefersLight));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle('light', light);
    try {
      window.localStorage.setItem('civiceye_theme', light ? 'light' : 'dark');
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f4f6fb' : '#020617');
  }, [light, mounted]);

  return (
    <button
      type="button"
      onClick={() => setLight((l) => !l)}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      title={light ? 'Dark mode' : 'Light mode'}
      className={`grid h-10 w-10 place-items-center rounded-xl border transition-all duration-200 ${
        light
          ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100'
          : 'border-slate-700 bg-slate-800/50 text-amber-300 hover:bg-slate-800'
      }`}
    >
      {light || !mounted ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M6.05 6.05L4.636 4.636m12.728 0l-1.414 1.414M6.05 17.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      )}
    </button>
  );
}