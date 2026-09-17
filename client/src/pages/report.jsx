import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL, authHeaders, getUser, isLoggedIn, clearAuth, ensureGuestAuth } from '../lib/auth';

export default function ReportIssue() {
  const router = useRouter();
  const [image, setImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [cameraState, setCameraState] = useState('starting');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const user = getUser();

  useEffect(() => {
    if (!isLoggedIn()) {
      ensureGuestAuth().then((token) => {
        if (!token) router.replace('/login?next=/report');
      });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        },
        (err) => {
          console.error('GPS error:', err);
          setLocationLoading(false);
        }
      );
    } else {
      setLocationLoading(false);
    }

    startCamera();
  }, []);

  const startCamera = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      return;
    }
    setCameraState('starting');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraState('ready');
        }
      })
      .catch((err) => {
        console.error('Camera error:', err);
        setCameraState('error');
      });
  };

  const capturePhoto = () => {
    if (!videoRef.current || cameraState !== 'ready') return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    setImage(canvas.toDataURL('image/jpeg'));
  };

  const retakePhoto = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!image || !location) {
      setError('Camera/photo and Location are both required.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        longitude: location.lng,
        latitude: location.lat,
        imageBase64: image.split(',')[1],
        mimeType: image.split(';')[0].split(':')[1] || 'image/jpeg',
        optionalNote: note,
      };
      const baseUrl = API_URL;
      const res = await axios.post(`${baseUrl}/api/complaints`, payload, { headers: authHeaders() });
      setResult(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        clearAuth();
        window.localStorage.removeItem('civiceye_guest_tried');
        const token = await ensureGuestAuth();
        if (!token) {
          router.replace('/login?next=/report');
          return;
        }
        setError('Session expire ho gaya tha — naya guest bana liya. Dobara submit karein.');
        setLoading(false);
        return;
      }
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>CivicEye 2.0 — Report an Issue</title>
      </Head>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      <div className="relative min-h-screen pb-24">
        {/* Navbar */}
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
                <span className="block text-[10px] uppercase tracking-widest text-slate-500">Instant Report</span>
              </div>
            </Link>
            <div className="grid grid-flow-col auto-cols-max items-center gap-2">
              <span className="hidden rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 sm:block">
                {user?.name || 'Citizen'}
              </span>
              <Link href="/assistant" className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/20">
                AI Assistant
              </Link>
              <Link href="/dashboard" className="grid grid-flow-col auto-cols-max items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </Link>
              <button
                onClick={() => {
                  clearAuth();
                  router.replace('/login');
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/40 hover:text-red-300"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-xl px-4 pt-8">
          {/* Step indicator */}
          <div className="mb-8 grid grid-flow-col auto-cols-max items-center justify-center gap-3">
            <Step active={!image} done={!!image} label="Capture" />
            <div className={`h-px w-12 ${image ? 'bg-cyan-500' : 'bg-slate-700'}`} />
            <Step active={!!image} done={false} label="Details" />
            <div className={`h-px w-12 ${result ? 'bg-cyan-500' : 'bg-slate-700'}`} />
            <Step active={!!result} done={false} label="Done" />
          </div>

          {/* Capture / Preview card */}
          <div className="animate-scale-in">
            {!image ? (
              <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-black shadow-2xl">
                <div className="relative aspect-[4/5] w-full">
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

                  {/* Scan overlay */}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="h-56 w-56 rounded-2xl border-2 border-cyan-400/40 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                      <div className="absolute inset-0 m-6 rounded-xl border border-cyan-400/20" />
                    </div>
                    <div className="absolute top-0 left-0 h-12 w-12 rounded-tl-2xl border-t-4 border-l-4 border-cyan-400" style={{ marginTop: '6rem', marginLeft: '6rem' }} />
                  </div>

                  {cameraState === 'starting' && (
                    <div className="absolute inset-0 grid grid-cols-1 place-content-center place-items-center gap-3 bg-slate-950/80">
                      <div className="h-10 w-10 animate-spin-slow rounded-full border-2 border-cyan-500 border-t-transparent" />
                      <span className="text-xs text-slate-400">Starting camera...</span>
                    </div>
                  )}

                  {cameraState === 'error' && (
                    <div className="absolute inset-0 grid grid-cols-1 place-content-center place-items-center gap-3 bg-slate-950/90 p-6 text-center">
                      <div className="text-4xl">📷</div>
                      <p className="text-sm text-slate-400">Camera unavailable. Upload a photo instead.</p>
                      <label className="btn-primary cursor-pointer text-sm">
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        Choose Photo
                      </label>
                    </div>
                  )}

                  {/* Capture button */}
                  <button
                    onClick={capturePhoto}
                    disabled={cameraState !== 'ready'}
                    className="absolute bottom-6 left-1/2 grid h-18 w-18 -translate-x-1/2 place-items-center rounded-full border-4 border-white/90 transition-transform active:scale-90 disabled:opacity-40"
                    style={{ height: '4.5rem', width: '4.5rem', background: 'radial-gradient(circle, #22d3ee, #0891b2)' }}
                  >
                    <div className="h-12 w-12 rounded-full border-2 border-white/60" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card overflow-hidden animate-scale-in">
                <div className="relative">
                  <img src={image} alt="Preview" className="h-64 w-full object-cover" />
                  {result && (
                    <div className={`absolute inset-0 grid place-items-center bg-slate-950/60 backdrop-blur-sm`}>
                      <div className="text-center">
                        <div className="animate-scale-in text-5xl">{result.isDuplicate ? '⚠️' : '✅'}</div>
                        <p className="mt-3 text-sm font-semibold text-white">
                          {result.isDuplicate ? 'Duplicate Detected' : 'Complaint Registered'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-[1fr_auto] items-center justify-between">
                    <p className="text-sm font-semibold text-white">Photo Captured</p>
                    <button
                      onClick={retakePhoto}
                      className="grid grid-flow-col auto-cols-max items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retake
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Upload alternative */}
          {!image && cameraState === 'ready' && (
            <div className="mt-4 grid grid-flow-col auto-cols-max items-center justify-center">
              <label className="cursor-pointer text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                <svg className="mr-1 inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                Upload a photo instead
              </label>
            </div>
          )}

          {/* Status chips */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className={`grid grid-flow-col auto-cols-max items-center gap-2 rounded-xl border p-3 text-sm ${location && !locationLoading ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50 bg-slate-800/30 text-slate-400'}`}>
              {locationLoading ? (
                <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-slate-500 border-t-transparent" />
              ) : location ? (
                <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-slate-600" />
              )}
              <span className="font-medium">
                {locationLoading ? 'Locating...' : location ? 'Location Locked' : 'Location Offline'}
              </span>
            </div>
            <div className={`grid grid-flow-col auto-cols-max items-center gap-2 rounded-xl border p-3 text-sm ${image ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50 bg-slate-800/30 text-slate-400'}`}>
              {image ? (
                <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              )}
              <span className="font-medium">{image ? 'Photo Ready' : 'No Photo'}</span>
            </div>
          </div>

          {/* Note */}
          {image && !result && (
            <div className="mt-6 animate-slide-up">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Additional Details <span className="text-slate-600">(optional)</span>
              </label>
              <textarea
                placeholder="Add any details — nearby landmarks, severity, timings..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="input-field resize-none"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 animate-slide-up rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1 text-red-400">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`mt-6 animate-slide-up rounded-xl border p-5 ${result.isDuplicate ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
              <div className="grid grid-flow-col auto-cols-max items-start gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-full text-lg ${result.isDuplicate ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                  {result.isDuplicate ? '⚠️' : '✅'}
                </div>
                <div className="min-w-0">
                  <p className={`font-bold ${result.isDuplicate ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {result.message}
                  </p>
                  {result.complaint && (
                    <div className="mt-3 space-y-2 text-xs text-slate-300">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] gap-2">
                        <span className="badge bg-slate-700/50 text-slate-200 capitalize">{result.complaint.category}</span>
                        <span className={`badge ${
                          result.complaint.severity === 'high' ? 'bg-red-500/20 text-red-300' :
                          result.complaint.severity === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-emerald-500/20 text-emerald-300'
                        } capitalize`}>{result.complaint.severity}</span>
                        <span className="badge bg-slate-700/50 text-slate-200">{result.complaint.status}</span>
                      </div>
                      <p className="pt-1 text-slate-400">
                        Support score: <span className="font-semibold text-white">{result.complaint.supportScore}</span>
                      </p>
                      <p className="text-slate-500">
                        Complaint ID: <span className="font-mono text-slate-400">{(result.complaint._id || '').slice(-8)}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {result.isDuplicate && (
                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] gap-2">
                  <Link href="/dashboard" className="text-xs font-medium text-cyan-400 hover:underline">
                    View all reports →
                  </Link>
                </div>
              )}
              {!result.isDuplicate && (
                <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                  <Link href="/dashboard" className="btn-primary text-xs">
                    View Dashboard
                  </Link>
                  <button onClick={retakePhoto} className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white">
                    Report Another
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          {image && !result && (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/60 bg-slate-950/90 p-4 backdrop-blur-xl">
              <div className="mx-auto grid max-w-xl grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto]">
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-white">Ready to submit?</p>
                  <p className="text-[10px] text-slate-500">AI processes in under 30 seconds</p>
                </div>
                <button
                  disabled={!image || !location || loading}
                  onClick={handleSubmit}
                  className="btn-primary sm:min-w-56"
                >
                  {loading ? (
                    <span className="grid grid-flow-col auto-cols-max items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white border-t-transparent" />
                      AI Processing...
                    </span>
                  ) : (
                    <span className="grid grid-flow-col auto-cols-max items-center justify-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Submit Report
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function Step({ active, done, label }) {
  return (
    <div className="grid grid-flow-col auto-cols-max items-center gap-2">
      <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-all duration-300 ${
        done
          ? 'bg-cyan-500 text-white'
          : active
          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
          : 'bg-slate-800 text-slate-500'
      }`}>
        {done ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          label[0]
        )}
      </div>
      <span className={`text-xs font-medium ${active || done ? 'text-white' : 'text-slate-600'}`}>{label}</span>
    </div>
  );
}