import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const TOKEN_KEY = 'civiceye_token';
const USER_KEY = 'civiceye_user';
const GUEST_TRIED_KEY = 'civiceye_guest_tried';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function saveAuth({ token, user }) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export async function ensureGuestAuth() {
  if (typeof window === 'undefined') return getToken();
  if (isLoggedIn()) return getToken();
  if (window.localStorage.getItem(GUEST_TRIED_KEY)) return null;

  try {
    const sid = Math.random().toString(36).slice(2, 10);
    const email = `guest_${sid}@civiceye.local`;
    const password = `guest_${sid}`;
    const res = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Guest User',
      email,
      password,
    });
    if (res.data?.token) {
      saveAuth(res.data);
      return res.data.token;
    }
    return null;
  } catch {
    window.localStorage.setItem(GUEST_TRIED_KEY, '1');
    return null;
  }
}