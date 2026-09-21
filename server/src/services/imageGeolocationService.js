const gemini = require('./geminiService');
const { geocodePlace, reverseGeocode } = require('./geolocationService');
const logger = require('../utils/logger');

const SYSTEM_PROMPT =
  'You are a photo-location detective. Look at this image and use ONLY what is visible in it — landmarks, monuments, signboards and the text/language on them, shop/building names, architecture, geography, climate, vegetation, vehicles, number plates — to determine WHERE the photo was taken.\n' +
  'STRICT RULES:\n' +
  '- NEVER use a device\'s current location, GPS, EXIF metadata, or IP address. Base the answer ONLY on the image pixels.\n' +
  '- If the clues are too vague to name a place confidently, set found=false and do NOT invent coordinates.\n' +
  '- For famous landmarks give the known approximate latitude and longitude if you are fairly sure.\n' +
  '- Otherwise leave lat/lng null (you will be geocoded from the place name).\n' +
  'Return valid JSON ONLY with this exact shape:\n' +
  '{"found": boolean, "place_name": "best place name or empty string", "city": "city or null", "state": "state/province or null", "country": "country or null", "area_hint": "approximate neighbourhood hint such as roads/markets/known areas, or null", "landmarks": ["visible clues"], "lat": number or null, "lng": number or null, "confidence": number between 0 and 1, "evidence": "2-3 sentences explaining exactly which visible clues you used"}';

const OSV5M_URL = process.env.OSV5M_URL || 'http://127.0.0.1:8787';
const OSV5M_ENABLED = process.env.OSV5M_ENABLED === 'true';
const OSV5M_DEFAULT_CONFIDENCE = Number(process.env.OSV5M_DEFAULT_CONFIDENCE || 0.55);

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  return {
    mimeType: match[1] || 'image/jpeg',
    base64: match[3] || '',
  };
}

function sanitize(raw) {
  let text = (raw || '').trim();
  const fences = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fences) text = fences[1].trim();
  const start = Math.min(
    ...[text.indexOf('{'), text.indexOf('[')].map((i) => (i === -1 ? Infinity : i))
  );
  if (start !== Infinity) text = text.slice(start);
  return text;
}

async function inferWithOsv5m(imageDataUrl) {
  if (!OSV5M_ENABLED || !imageDataUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(`${OSV5M_URL}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageDataUrl }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OSV-5M service returned ${res.status}`);
    const parsed = await res.json();
    if (!parsed.success) throw new Error(parsed.error || 'OSV-5M inference failed');

    const { lat, lng, confidence } = parsed.data || {};
    if (![lat, lng].every((v) => Number.isFinite(Number(v)))) return null;

    const rev = await reverseGeocode(lat, lng);
    return {
      found: true,
      lat: Number(lat),
      lng: Number(lng),
      source: 'osv5m',
      place_name: rev?.displayName || 'OSV-5M estimated location',
      city: rev?.city || null,
      state: rev?.state || null,
      country: rev?.country || null,
      area_hint: null,
      landmarks: ['OSV-5M visual geolocation'],
      confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : OSV5M_DEFAULT_CONFIDENCE,
      evidence: 'OSV-5M (OpenStreetView-5M) model ne photo pixels se global location predict ki.',
      model: 'osv5m',
    };
  } catch (err) {
    logger.warn(`OSV-5M inference failed, falling back (${err.message})`);
    return null;
  }
}

async function inferLocationFromImage({ imageDataUrl, imageBase64, mimeType }) {
  const parsed = imageDataUrl ? parseDataUrl(imageDataUrl) : null;
  const base64 = parsed ? parsed.base64 : imageBase64 || '';
  const type = parsed ? parsed.mimeType : mimeType || 'image/jpeg';

  if (!base64) {
    return { found: false, place_name: '', error: 'No image provided.' };
  }

  if (imageDataUrl) {
    const osv5mResult = await inferWithOsv5m(imageDataUrl);
    if (osv5mResult) return osv5mResult;
  }

  try {
    const raw = await gemini.generate({
      systemPrompt: SYSTEM_PROMPT,
      userText: 'Where was this photo taken? Trace the location from the image itself.',
      imageBase64: base64,
      mimeType: type,
      json: true,
      temperature: 0.1,
    });

    const parsedResult = JSON.parse(sanitize(raw));
    const found = parsedResult.found === true;

    if (!found) {
      return {
        found: false,
        message: parsedResult.evidence || 'Model ko image me location ke clear clues nahi mile.',
        evidence: parsedResult.evidence || null,
      };
    }

    const placeQuery = [parsedResult.place_name, parsedResult.city, parsedResult.state, parsedResult.country]
      .filter((v) => v && typeof v === 'string')
      .join(', ')
      .trim();

    let lat = Number.isFinite(Number(parsedResult.lat)) ? Number(parsedResult.lat) : null;
    let lng = Number.isFinite(Number(parsedResult.lng)) ? Number(parsedResult.lng) : null;

    if ((lat == null || lng == null) && placeQuery) {
      const geocoded = await geocodePlace(placeQuery, 1);
      if (geocoded.length) {
        lat = geocoded[0].lat;
        lng = geocoded[0].lon;
        if (!parsedResult.place_name) parsedResult.place_name = geocoded[0].displayName;
      }
    }

    if (lat == null || lng == null) {
      return {
        found: false,
        message: 'Location `{place_name}` mila, lekin coordinates resolve nahi hua.',
        place_name: parsedResult.place_name || null,
        evidence: parsedResult.evidence || null,
      };
    }

    return {
      found: true,
      lat,
      lng,
      place_name: parsedResult.place_name || null,
      city: parsedResult.city || null,
      state: parsedResult.state || null,
      country: parsedResult.country || null,
      area_hint: parsedResult.area_hint || null,
      landmarks: Array.isArray(parsedResult.landmarks) ? parsedResult.landmarks : [],
      confidence: Math.max(0, Math.min(1, Number(parsedResult.confidence) || 0)),
      evidence: parsedResult.evidence || null,
    };
  } catch (err) {
    logger.warn(`Image location inference failed (${err.message})`);
    return { found: false, error: err.message };
  }
}

module.exports = { inferLocationFromImage };