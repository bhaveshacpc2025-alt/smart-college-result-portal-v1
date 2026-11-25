const TOKEN_KEY = 'scrp_auth_token';
const USER_KEY = 'scrp_auth_user';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function extractCodeFromInput(input) {
  const str = String(input || '').trim();
  const match = str.match(/CLS-[A-Z0-9]{4,12}/i);
  if (match) return match[0].toUpperCase();
  try {
    const u = new URL(str);
    const c = u.searchParams.get('code') || u.searchParams.get('join') || u.searchParams.get('invite');
    if (c) return c.trim().toUpperCase();
  } catch {
    // ignore
  }
  return str.toUpperCase();
}
