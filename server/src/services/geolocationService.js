const logger = require('../utils/logger');
require('dotenv').config();

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const SERPAPI_URL = 'https://serpapi.com/search.json';
const UA_STRING =
  'CivicEye/2.0 (complaint-location-lookup; contact: admin@civiceye.local)';

// Nominatim's usage policy allows at most one request per second per client and
// answers 403/429 to clients that exceed it, which takes location search down
// for everyone behind the same IP. Calls are queued to a minimum interval, and
// repeat lookups inside the cache window never leave the process.
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_QUERY_LENGTH = 200;

const cache = new Map();
let lastRequestAt = 0;
let queue = Promise.resolve();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Number(null) and Number('') are 0 and pass an isFinite check, so null has to
// be rejected explicitly or a missing coordinate becomes 0,0.
function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function nominatimGet(url, label) {
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA_STRING,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${label} returned ${res.status}`);
    return res.json();
  });
  // Keep the chain alive when this call rejects, so one failure cannot stall
  // every queued lookup behind it.
  queue = run.then(
    () => {},
    () => {}
  );

  const data = await run;
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function geocodePlace(query, maxResults = 5) {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (trimmed.length < 2 || trimmed.length > MAX_QUERY_LENGTH) {
    return [];
  }
  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(maxResults));
    url.searchParams.set('addressdetails', '1');

    const data = await nominatimGet(url, 'Nominatim');
    return (Array.isArray(data) ? data : []).map((item) => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName:
        item.display_name ||
        [item.name, item.get('city'), item.get('state'), item.get('country')]
          .filter(Boolean)
          .join(', '),
    }));
  } catch (err) {
    logger.warn(`Geocode failed (${err.message})`);
    return [];
  }
}

async function reverseGeocode(lat, lng) {
  const latNum = toFiniteNumber(lat);
  const lngNum = toFiniteNumber(lng);
  if (latNum === null || lngNum === null) return null;
  if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) return null;
  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set('lat', String(latNum));
    url.searchParams.set('lon', String(lngNum));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');

    const data = await nominatimGet(url, 'Nominatim reverse');
    const latOut = toFiniteNumber(data?.lat);
    const lonOut = toFiniteNumber(data?.lon);
    if (latOut === null || lonOut === null) return null;
    return {
      lat: latOut,
      lon: lonOut,
      displayName: data.display_name || null,
      city: data.address?.city || data.address?.town || data.address?.village || null,
      state: data.address?.state || null,
      country: data.address?.country || null,
    };
  } catch (err) {
    logger.warn(`Reverse geocode failed (${err.message})`);
    return null;
  }
}

async function reverseSearchLandmark(imageDataUrl) {
  const key = process.env.SERPAPI_KEY;
  if (!key || key.includes('your_')) {
    logger.info('Reverse image search skipped: SERPAPI_KEY not configured.');
    return null;
  }
  try {
    // Google Lens reverse image search requires a public image URL.
    const res = await fetch(`${SERPAPI_URL}?engine=google_lens&api_key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageDataUrl }),
    });
    if (!res.ok) {
      throw new Error(`SerpAPI returned ${res.status}`);
    }
    const data = await res.json();
    const best =
      data?.visual_matches?.[0] ||
      data?.knowledge_graph ||
      data?.suggested_searches?.[0] ||
      null;
    if (!best) return null;
    if (best.latitude && best.longitude) {
      return {
        lat: best.latitude,
        lon: best.longitude,
        label: best.title || best.name || 'Reverse image search result',
        source: 'reverse-search',
      };
    }
    const title = best.title || best.name || best.query || '';
    if (!title) return null;
    const geocoded = await geocodePlace(title, 1);
    if (!geocoded.length) return null;
    return { ...geocoded[0], label: title, source: 'reverse-search' };
  } catch (err) {
    logger.warn(`Reverse image search failed (${err.message})`);
    return null;
  }
}

module.exports = { geocodePlace, reverseGeocode, reverseSearchLandmark };