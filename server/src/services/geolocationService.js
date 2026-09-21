const logger = require('../utils/logger');
require('dotenv').config();

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const SERPAPI_URL = 'https://serpapi.com/search.json';
const UA_STRING =
  'CivicEye/2.0 (complaint-location-lookup; contact: admin@civiceye.local)';

async function geocodePlace(query, maxResults = 5) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return [];
  }
  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(maxResults));
    url.searchParams.set('addressdetails', '1');

    const res = await fetch(url, {
      headers: {
        'User-Agent': UA_STRING,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Nominatim returned ${res.status}`);
    }
    const data = await res.json();
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
  if (![lat, lng].every((v) => Number.isFinite(Number(v)))) {
    return null;
  }
  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');

    const res = await fetch(url, {
      headers: {
        'User-Agent': UA_STRING,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Nominatim reverse returned ${res.status}`);
    }
    const data = await res.json();
    if (!data || !data.lat || !data.lon) return null;
    return {
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
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