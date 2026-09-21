import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import exifr from 'exifr';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL, authHeaders, getUser, isLoggedIn, clearAuth, ensureGuestAuth } from '../lib/auth';
import ThemeToggle from '../components/ThemeToggle';
import Icon from '../components/Icon';

export default function ReportIssue() {
  const router = useRouter();
  const [image, setImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationSource, setLocationSource] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const locationSourceRef = useRef(null);
  const watchIdRef = useRef(null);
  const timersRef = useRef([]);
  const gpsRetriesRef = useRef(0);
  const [photoSource, setPhotoSource] = useState(null);
  const [locationFromExif, setLocationFromExif] = useState(false);
  const [manualLocation, setManualLocation] = useState(null);
  const [needsLocationChoice, setNeedsLocationChoice] = useState(false);
  const [allowNoLocation, setAllowNoLocation] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [modelLocationLoading, setModelLocationLoading] = useState(false);
  const [cameraState, setCameraState] = useState('starting');
  const [facing, setFacing] = useState('environment');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const user = getUser();

  const clearLocationTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const stopWatching = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    clearLocationTimers();
  };

  const requestDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationLoading(false);
      return;
    }
    stopWatching();
    setLocationLoading(true);
    gpsRetriesRef.current += 1;

    const startedAt = Date.now();
    let best = null;
    let settleTimer = null;
    let finalized = false;

    const finalize = (allowRetry = true) => {
      if (finalized) return;
      finalized = true;
      stopWatching();
      if (best && locationSourceRef.current !== 'image') {
        locationSourceRef.current = 'device';
        setLocationSource('device');
        setLocationAccuracy(Math.round(best.accuracy));
        setLocation({ lat: best.latitude, lng: best.longitude });
        setLocationLoading(false);
        return;
      }
      // No fix yet and nothing better (image EXIF) supplied the location —
      // give the browser a couple of warm-up attempts before giving up.
      if (allowRetry && gpsRetriesRef.current < 3 && locationSourceRef.current !== 'image') {
        gpsRetriesRef.current += 1;
        const retryTimer = setTimeout(() => requestDeviceLocation(), 1200);
        timersRef.current.push(retryTimer);
        setLocationLoading(true);
        return;
      }
      setLocationLoading(false);
    };

    const onPosition = (pos) => {
      if (locationSourceRef.current === 'image' || finalized) {
        finalize();
        return;
      }
      const { latitude, longitude } = pos.coords;
      const accuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : Infinity;
      if (!best || accuracy < best.accuracy) {
        best = { latitude, longitude, accuracy };
      }
      // Good lock achieved — wait briefly for a stable fix, then finalize early.
      if (accuracy <= 15 && !settleTimer) {
        settleTimer = setTimeout(finalize, 1500);
        timersRef.current.push(settleTimer);
      }
      if (Date.now() - startedAt >= 9000) finalize();
    };

    const onError = (err) => {
      console.error('GPS error:', err);
      finalize(err?.code !== 1);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    // Absolute safety cap: works even if the browser never fires a callback (common on some laptops).
    const hardCap = setTimeout(finalize, 11000);
    timersRef.current.push(hardCap);
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      ensureGuestAuth().then((token) => {
        if (!token) router.replace('/login?next=/report');
      });
    }

    requestDeviceLocation();

    startCamera(facing);

    return () => stopWatching();
  }, []);

  const startCamera = (facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      return;
    }
    setCameraState('starting');
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode } })
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

  const toggleCamera = () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    setImage(null);
    setResult(null);
    startCamera(next);
  };

  const capturePhoto = () => {
    if (!videoRef.current || cameraState !== 'ready') return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    setImage(canvas.toDataURL('image/jpeg'));
    setPhotoSource('capture');
    setManualLocation(null);
    setNeedsLocationChoice(false);
    setAllowNoLocation(false);
  };

  const retakePhoto = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setManualLocation(null);
    setNeedsLocationChoice(false);
    setAllowNoLocation(false);
    setPhotoSource(null);
    setLocationFromExif(false);
    if (locationSourceRef.current === 'image') {
      locationSourceRef.current = null;
      setLocation(null);
      requestDeviceLocation();
    }
  };

  const retryLocation = () => {
    if (locationSourceRef.current === 'image' && location) return;
    locationSourceRef.current = null;
    setLocation(null);
    if (navigator.geolocation) gpsRetriesRef.current = 0;
    requestDeviceLocation();
  };

  const searchPlace = async (q) => {
    if (!q || q.trim().length < 2) {
      setPlaceResults([]);
      return;
    }
    setPlaceLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/geolocate/place`, {
        params: { query: q.trim() },
        headers: authHeaders(),
      });
      setPlaceResults(res.data?.data || []);
    } catch (err) {
      console.error('Place search error:', err);
      setPlaceResults([]);
    } finally {
      setPlaceLoading(false);
    }
  };

  const pickPlace = (result) => {
    setManualLocation({ lat: result.lat, lng: result.lon, label: result.displayName });
    setPlaceResults([]);
    setPlaceQuery('');
    setLocation(null);
    setAllowNoLocation(false);
    stopWatching();
  };

  const useCurrentAsLocation = () => {
    if (!location) {
      requestDeviceLocation();
      setError('GPS fix nahi mila abhi — thoda ruk kar dobara try karo.');
      return;
    }
    locationSourceRef.current = 'device';
    setManualLocation(null);
    setAllowNoLocation(false);
    setNeedsLocationChoice(false);
    stopWatching();
  };

  const skipLocation = () => {
    setAllowNoLocation(true);
    setManualLocation(null);
    setNeedsLocationChoice(false);
    stopWatching();
  };

  const runReverseSearch = async () => {
    if (!image) return;
    setReverseLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/geolocate/reverse`,
        { imageDataUrl: image },
        { headers: authHeaders() }
      );
      const found = res.data?.data;
      if (found?.lat && found?.lon) {
        setManualLocation({ lat: found.lat, lng: found.lon, label: found.label });
        setLocation(null);
        setAllowNoLocation(false);
        setNeedsLocationChoice(false);
      } else {
        setError('Reverse search se koi famous jagah nahi mili. Neeche pin karo ya naam likho.');
      }
    } catch (err) {
      console.error('Reverse search error:', err);
      setError('Reverse search kaam nahi kiya (API key chahiye). Pin karo ya naam likho.');
    } finally {
      setReverseLoading(false);
    }
  };

  const runModelLocationTrace = async () => {
    if (!image) return;
    setModelLocationLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/geolocate/model`,
        { imageDataUrl: image },
        { headers: authHeaders() }
      );
      const found = res.data?.data;
      if (found?.found && typeof found.lat === 'number' && typeof found.lng === 'number') {
        const labelParts = [found.place_name, found.city, found.state, found.country].filter(Boolean);
        const label = labelParts.length
          ? `${labelParts.join(', ')}${found.confidence ? ` (AI ~${Math.round(found.confidence * 100)}%)` : ''}`
          : 'AI-estimated location';
        setManualLocation({ lat: found.lat, lng: found.lng, label });
        setLocation(null);
        setAllowNoLocation(false);
        setNeedsLocationChoice(false);
      } else {
        setError(
          found?.evidence || found?.message ||
            'Model ko image se location ke clear clues nahi mile (no landmark/sign). Pin karo ya naam likho.'
        );
      }
    } catch (err) {
      console.error('Model location trace error:', err);
      setError('Model location trace kaam nahi kiya (AI geolocation service unavailable). Pin karo ya naam likho.');
    } finally {
      setModelLocationLoading(false);
    }
  };

  const resolvedLocation = () => {
    if (locationFromExif && location) {
      return { lat: location.lat, lng: location.lng, source: 'exif', trusted: true };
    }
    if (photoSource === 'capture' && location) {
      return { lat: location.lat, lng: location.lng, source: 'device', trusted: true };
    }
    if (manualLocation) {
      return {
        lat: manualLocation.lat,
        lng: manualLocation.lng,
        source: manualLocation.label ? 'geocode' : 'pinned',
        trusted: true,
      };
    }
    if (photoSource === 'gallery' && location && !needsLocationChoice) {
      return { lat: location.lat, lng: location.lng, source: 'device', trusted: true };
    }
    return null;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
    setPhotoSource('gallery');
    setManualLocation(null);

    const deviceLocked = !!location && locationSourceRef.current === 'device';
    // A GPS fix embedded in a previous upload cannot be trusted for this new
    // photo — drop it so it is re-derived from this file's EXIF or the device.
    if (locationSourceRef.current === 'image') {
      locationSourceRef.current = null;
      setLocation(null);
    }
    // Start/keep the GPS watch running WHILE the EXIF read happens, so a photo
    // without EXIF GPS can never leave the report without a device fix. Previously
    // the fallback only ran after `await exifr` resolved, so a slow/hanging EXIF
    // read (common with large phone photos in browsers) meant no location on upload.
    if (!deviceLocked) {
      if (navigator.geolocation) gpsRetriesRef.current = 0;
      requestDeviceLocation();
    } else {
      setLocationLoading(false);
    }

    let gpsFromImage = null;

    try {
      // Timeout guard: some large/odd photos make exifr hang in the browser.
      const gps = await Promise.race([
        exifr.gps(file),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('EXIF GPS read timed out')), 5000)
        ),
      ]);
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        gpsFromImage = { lat: gps.latitude, lng: gps.longitude };
        try {
          const meta = await exifr.parse(file, ['GPSHPositioningError']);
          gpsFromImage.accuracy =
            typeof meta?.GPSHPositioningError === 'number' ? Math.round(meta.GPSHPositioningError) : null;
        } catch {
          gpsFromImage.accuracy = null;
        }
      }
    } catch (err) {
      console.error('EXIF GPS read error:', err);
    }

    if (gpsFromImage) {
      stopWatching();
      locationSourceRef.current = 'image';
      setLocationSource('image');
      setLocationAccuracy(gpsFromImage.accuracy);
      setLocation({ lat: gpsFromImage.lat, lng: gpsFromImage.lng });
      setLocationFromExif(true);
      setNeedsLocationChoice(false);
      setAllowNoLocation(false);
      setLocationLoading(false);
    } else if (photoSource === 'gallery') {
      // Photo picked from the gallery has no embedded GPS — the device's
      // CURRENT location is NOT this photo's location. Ask the citizen to
      // pin the right spot, use current, or submit without a location.
      setLocationFromExif(false);
      setNeedsLocationChoice(true);
      if (!watchIdRef.current) requestDeviceLocation();
      setLocationLoading(watchIdRef.current != null);
    } else if (!location) {
      // No GPS embedded in the photo. The background `requestDeviceLocation`
      // picks up the device fix when it lands; make sure a watch is still running.
      if (!watchIdRef.current) requestDeviceLocation();
      setLocationLoading(watchIdRef.current != null);
    } else {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      setError('Camera/photo is required.');
      return;
    }
    const resolved = resolvedLocation();
    const canNoLocation = allowNoLocation;
    if (!resolved && !canNoLocation) {
      setError('Photo ki location set karo (pin) ya "Bina Location Submit" chuno.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        imageBase64: image.split(',')[1],
        mimeType: image.split(';')[0].split(':')[1] || 'image/jpeg',
        optionalNote: note,
      };
      if (resolved?.trusted) {
        payload.longitude = resolved.lng;
        payload.latitude = resolved.lat;
        payload.locationTrusted = true;
        payload.locationSource = resolved.source;
      } else {
        payload.locationTrusted = false;
        payload.locationSource = 'not-provided';
      }
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
              <ThemeToggle />
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

                  {cameraState === 'ready' && (
                    <button
                      onClick={toggleCamera}
                      className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-slate-950/60 text-white shadow-lg backdrop-blur transition-all active:scale-90"
                      title={facing === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
                      aria-label="Switch camera"
                    >
                      <Icon
                        paths={['M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4']}
                        className="h-5 w-5"
                      />
                    </button>
                  )}

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
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-800/60">
                        <Icon
                          paths={['M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', 'M15 13a3 3 0 11-6 0 3 3 0 016 0z']}
                          className="h-7 w-7 text-cyan-400"
                        />
                      </div>
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
                        {result.isDuplicate ? (
                          <Icon
                            paths={['M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z']}
                            className="mx-auto h-16 w-16 text-amber-400"
                          />
                        ) : (
                          <Icon
                            paths={['M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z']}
                            className="mx-auto h-16 w-16 text-emerald-400"
                          />
                        )}
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
            <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${location || manualLocation || allowNoLocation ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50 bg-slate-800/30 text-slate-400'}`}>
              {locationLoading ? (
                <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-slate-500 border-t-transparent" />
              ) : location || manualLocation ? (
                <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : allowNoLocation ? (
                <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-slate-600" />
              )}
              <div className="min-w-0 flex-1">
                <span className="block font-medium">
                  {locationLoading ? 'Locating...' : location || manualLocation ? 'Location Locked' : allowNoLocation ? 'Submitted without location' : 'Location Required'}
                </span>
                {location && !locationLoading && (
                  <span className="block text-[10px] text-slate-500">
                    {locationSource === 'image'
                      ? 'GPS from photo (EXIF)'
                      : locationSource === 'device' && locationAccuracy
                      ? `Device GPS \u00B1${locationAccuracy} m`
                      : 'Device GPS'}
                  </span>
                )}
                {manualLocation && (
                  <span className="block text-[10px] text-slate-500">
                    {manualLocation.label ? 'Place search (geocode)' : 'Manually pinned on map'}
                  </span>
                )}
                {allowNoLocation && (
                  <span className="block text-[10px] text-amber-400">No location saved</span>
                )}
                {!location && !locationLoading && !manualLocation && !allowNoLocation && (
                  <button
                    onClick={retryLocation}
                    className="mt-1 grid grid-flow-col auto-cols-max items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/20"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry for GPS
                  </button>
                )}
              </div>
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

          {/* Location coordinates card */}
          {location && !locationLoading && (
            <div className="mt-4 animate-slide-up rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="grid grid-cols-1 items-start justify-between gap-2 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                    Location Coordinates
                  </p>
                  <div className="mt-2 space-y-1 font-mono text-sm">
                    <p className="text-white">
                      Lat <span className="text-cyan-300">{location.lat.toFixed(6)}</span>&nbsp;
                      <span className="text-slate-500">|</span>&nbsp;
                      Lng <span className="text-cyan-300">{location.lng.toFixed(6)}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDMS(location.lat, 'lat')}, {formatDMS(location.lng, 'lng')}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid grid-flow-col auto-cols-max items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  View on Google Maps
                </a>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-700/40 pt-3 text-[11px] text-slate-400">
                <span className="badge bg-slate-700/50 text-slate-300">
                  Source: {locationSource === 'image' ? 'Photo EXIF GPS' : 'Device GPS'}
                </span>
                {locationAccuracy != null && (
                  <span className="badge bg-slate-700/50 text-slate-300">Accuracy ±{locationAccuracy} m</span>
                )}
              </div>
            </div>
          )}

          {/* Location choice for gallery photos without EXIF GPS */}
          {photoSource === 'gallery' && !locationFromExif && needsLocationChoice && !manualLocation && (
            <div className="mt-4 animate-slide-up rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-amber-300">
                    Photo me GPS data nahi hai
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Device ki current location (agar hai) is photo ki location NAHI hai. Neeche photo ki asli jagah batayein, current location use karein, ya bina location submit karein.
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Jagah ka naam likho (jaise "Taj Mahal, Agra")
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={placeQuery}
                    onChange={(e) => {
                      setPlaceQuery(e.target.value);
                      searchPlace(e.target.value);
                    }}
                    placeholder="Place ka naam dhundho..."
                    className="input-field flex-1"
                  />
                  <button
                    onClick={runReverseSearch}
                    disabled={reverseLoading}
                    className="grid grid-flow-col auto-cols-max items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    {reverseLoading ? (
                      <span className="grid grid-flow-col auto-cols-max items-center gap-2">
                        <div className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-cyan-300 border-t-transparent" />
                        Searching...
                      </span>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        AI Reverse Search
                      </>
                    )}
                  </button>
                </div>
                {placeLoading && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <div className="h-3 w-3 animate-spin-slow rounded-full border-2 border-slate-500 border-t-transparent" />
                    Searching places...
                  </div>
                )}
                {placeResults.length > 0 && (
                  <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-900/90">
                    {placeResults.map((r, i) => (
                      <li key={i}>
                        <button
                          onClick={() => pickPlace(r)}
                          className="w-full px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-cyan-500/10 hover:text-white"
                        >
                          <span className="block font-medium text-cyan-300">
                            {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
                          </span>
                          <span className="block truncate">{r.displayName}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3">
                <MapPicker
                  initial={location ? { lat: location.lat, lng: location.lng } : undefined}
                  onPick={(lat, lng) => {
                    setManualLocation({ lat, lng });
                    setLocation(null);
                    setAllowNoLocation(false);
                    stopWatching();
                  }}
                />
              </div>

              <div className="mt-3">
                <button
                  onClick={runModelLocationTrace}
                  disabled={modelLocationLoading}
                  className="grid w-full grid-flow-col auto-cols-max items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-2.5 text-xs font-bold text-purple-300 transition-colors hover:bg-purple-500/20 disabled:opacity-60"
                >
                  {modelLocationLoading ? (
                    <span className="grid grid-flow-col auto-cols-max items-center gap-2">
                      <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-purple-300 border-t-transparent" />
                      Photo analyze ho rahi hai...
                    </span>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      AI Model se location trace karo (photo se hi)
                    </>
                  )}
                </button>
                <p className="mt-1.5 text-center text-[10px] text-purple-200/50">
                  Model photo ke landmarks/signboards dekh kar location banata hai — device ki current location use NAHI karta.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={useCurrentAsLocation}
                  className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
                >
                  Current Location Use Karein
                </button>
                <button
                  onClick={skipLocation}
                  className="rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-300"
                >
                  Bina Location Submit
                </button>
              </div>
            </div>
          )}

          {/* Pinned location summary */}
          {manualLocation && !locationFromExif && (
            <div className="mt-4 animate-slide-up rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-emerald-300">Photo ki location set</p>
                  <p className="mt-0.5 font-mono text-xs text-emerald-200/80">
                    {manualLocation.lat.toFixed(6)}, {manualLocation.lng.toFixed(6)}
                  </p>
                  {manualLocation.label && (
                    <p className="mt-0.5 text-xs text-slate-400">{manualLocation.label}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setManualLocation(null);
                    setNeedsLocationChoice(true);
                  }}
                  className="text-xs font-medium text-amber-300 hover:underline"
                >
                  Change
                </button>
              </div>
            </div>
          )}

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
                  {result.isDuplicate ? (
                    <Icon
                      paths={['M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z']}
                      className="h-5 w-5"
                    />
                  ) : (
                    <Icon
                      paths={['M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z']}
                      className="h-5 w-5"
                    />
                  )}
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
                        <span className={`badge ${priorityColor(result.complaint.priority)}`}>
                          {result.complaint.priority || 'medium'} priority
                        </span>
                        {result.complaint.departmentName && (
                          <span className="badge bg-cyan-500/15 text-cyan-300">
                            {result.complaint.departmentName}
                          </span>
                        )}
                        <span className="badge bg-slate-700/50 text-slate-200">{result.complaint.status}</span>
                      </div>
                      {result.complaint.priorityReason && (
                        <p className="pt-1 text-slate-400">
                          Why <span className="font-semibold text-white">{result.complaint.priority}</span>?{' '}
                          <span dangerouslySetInnerHTML={{ __html: highlightReason(result.complaint.priorityReason) }} />
                        </p>
                      )}
                      {result.aiAnalysis?.executedAction && !result.isDuplicate && (
                        <p className="pt-1 text-slate-400">
                          AI action: <span className="font-semibold text-white">created</span> this complaint (routed to{' '}
                          <span className="text-cyan-300">{result.aiAnalysis.departmentName}</span>).
                        </p>
                      )}
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

              {result.isDuplicate && result.existingComplaint && (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-slate-950/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Existing complaint — your report was merged with it
                  </p>
                  <div className="mt-3 grid grid-cols-[auto_1fr] gap-3">
                    {result.existingComplaint.images?.[0]?.url && (
                      <img
                        src={result.existingComplaint.images[0].url}
                        alt="Existing complaint"
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 space-y-1.5 text-xs">
                      <p className="font-semibold text-slate-200">
                        {result.existingComplaint.title || 'Similar report'}
                      </p>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(auto,auto))] gap-2">
                        <span className="badge bg-slate-700/50 text-slate-200 capitalize">{result.existingComplaint.category}</span>
                        <span className="badge bg-slate-700/50 text-slate-200">{result.existingComplaint.status}</span>
                        <span className="badge bg-slate-700/50 text-slate-200">
                          Support {result.existingComplaint.supportScore || 1}
                        </span>
                        {result.existingComplaint.distanceMeters != null && (
                          <span className="badge bg-amber-500/15 text-amber-300">
                            ~{result.existingComplaint.distanceMeters}m away
                          </span>
                        )}
                      </div>
                      {result.existingComplaint.location?.coordinates && (
                        <p className="font-mono text-[10px] text-slate-500">
                          {result.existingComplaint.location.coordinates[1].toFixed(5)},{' '}
                          {result.existingComplaint.location.coordinates[0].toFixed(5)}
                        </p>
                      )}
                      <p className="text-slate-400">
                        Linking boosts the existing report&apos;s weight so authorities see more people are affected.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {result.complaint?.aiTimeline && result.complaint.aiTimeline.length > 0 && (
                <Timeline events={result.complaint.aiTimeline} className="mt-4" />
              )}

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
                  disabled={!image || (!resolvedLocation() && !allowNoLocation) || loading}
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

function MapPicker({ initial, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let L = null;

    const initMap = () => {
      if (cancelled || mapRef.current || !containerRef.current) return;
      L = window.L;
      const center = initial
        ? [initial.lat, initial.lng]
        : [21.0, 78.0];
      const zoom = initial ? 14 : 5;
      const map = L.map(containerRef.current, { center, zoom });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const marker = L.marker(center, { draggable: true }).addTo(map);
      const emit = (pos) => {
        onPick?.(pos.lat, pos.lng);
      };
      marker.on('dragend', () => emit(marker.getLatLng()));
      map.on('click', (e) => {
        const loc = { lat: e.latlng.lat, lng: e.latlng.lng };
        marker.setLatLng(loc);
        emit(loc);
      });
      mapRef.current = map;
    };

    let script = document.getElementById('leaflet-js');
    if (script) {
      initMap();
      return () => {
        cancelled = true;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }

    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      if (!window.L) return;
      setTimeout(initMap, 0);
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50">
      <div ref={containerRef} className="h-52 w-full" />
      <p className="border-t border-slate-700/50 bg-slate-900 px-3 py-1.5 text-[10px] text-slate-500">
        Map par click karo ya pin ko drag karo — wahi photo ki location banegi
      </p>
    </div>
  );
}

function formatDMS(value, type) {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  const cardinal = type === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${deg}°${min}'${sec}"${cardinal}`;
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

function priorityColor(priority) {
  switch (priority) {
    case 'critical':
      return 'bg-purple-500/20 text-purple-300';
    case 'high':
      return 'bg-red-500/20 text-red-300';
    case 'low':
      return 'bg-emerald-500/20 text-emerald-300';
    case 'medium':
    default:
      return 'bg-amber-500/20 text-amber-300';
  }
}

function highlightReason(reason) {
  return reason.replace(/(critical|high|medium|low) priority/, '<span class="font-semibold text-white">$1 priority</span>');
}

function Timeline({ events = [], className = '' }) {
  if (!events || events.length === 0) return null;
  return (
    <div className={`rounded-xl border border-slate-700/40 bg-slate-950/40 p-4 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">AI Action Timeline</p>
      <ol className="mt-3 space-y-2.5">
        {events.map((ev, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr] items-start gap-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-300">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200">{ev.step}</p>
              {ev.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{ev.detail}</p>}
              {ev.ts && <p className="mt-0.5 text-[10px] text-slate-600">{new Date(ev.ts).toLocaleTimeString()}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}