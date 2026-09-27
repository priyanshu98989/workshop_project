const LEAFLET_VERSION = '1.9.4';
const CSS_ID = 'leaflet-css';
const JS_ID = 'leaflet-js';
const CSS_HREF = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const JS_SRC = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

export const TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
export const DEFAULT_CENTER = [21.0, 78.0];
export const DEFAULT_ZOOM = 5;

let subscribers = [];
let loaderStarted = false;

function ensureStylesheet() {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement('link');
  link.id = CSS_ID;
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  document.head.appendChild(link);
}

function ensureScript() {
  const existing = document.getElementById(JS_ID);
  if (existing) return existing;
  const script = document.createElement('script');
  script.id = JS_ID;
  script.src = JS_SRC;
  document.body.appendChild(script);
  return script;
}

function flush(L) {
  const waiting = subscribers;
  subscribers = [];
  waiting.forEach((fn) => fn(L));
}

/**
 * Injects Leaflet once per document and invokes `onReady(L)` on a macrotask, so
 * the map still builds when the tab is backgrounded (rAF is suspended there).
 * Returns a cancel function that detaches the caller if it unmounted first.
 */
export function loadLeaflet(onReady) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let timer = null;
  const deliver = (L) => {
    timer = setTimeout(() => onReady(L), 0);
  };

  if (window.L) {
    deliver(window.L);
    return () => clearTimeout(timer);
  }

  subscribers.push(deliver);
  ensureStylesheet();
  const script = ensureScript();
  script.addEventListener('load', () => {
    if (window.L) flush(window.L);
  });
  script.addEventListener('error', () => {
    subscribers = [];
  });

  if (!loaderStarted) {
    loaderStarted = true;
    if (window.L) flush(window.L);
  }

  return () => {
    clearTimeout(timer);
    subscribers = subscribers.filter((fn) => fn !== deliver);
  };
}

export function addTileLayer(L, map) {
  return L.tileLayer(TILE_LAYER_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
}

export function fitToMarkers(L, map, markers) {
  if (!markers || markers.length < 2) return;
  try {
    map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [40, 40] });
  } catch {
    // Single-cluster bounds can be invalid — keep the current view.
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
