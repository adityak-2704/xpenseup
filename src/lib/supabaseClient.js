// ── SUPABASE CLIENT (dependency-free) ─────────────────────────────────────────
// Talks to Supabase's REST (PostgREST) and Auth (GoTrue) endpoints with plain
// fetch. No SDK, so the bundle stays small and `npm install` stays untouched.
//
// Both values below are meant to be public: the anon key only grants what the
// row-level-security policies in supabase/schema.sql allow. The real protection
// is in the database, not in this file.

const URL_RAW = import.meta.env.VITE_SUPABASE_URL || "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const BASE = URL_RAW.replace(/\/+$/, "");

export const isConfigured = Boolean(BASE && ANON);

const SESSION_KEY = "xpenseup_session_v2";

// ── SESSION ──────────────────────────────────────────────────────────────────
let session = null;

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private browsing — session simply won't survive a reload */
  }
}

function storeTokens(payload) {
  if (!payload?.access_token) return null;
  const next = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    // expires_at is seconds since epoch; keep 60s of slack.
    expires_at: Math.floor(Date.now() / 1000) + (payload.expires_in || 3600),
    user: payload.user || session?.user || null,
  };
  writeSession(next);
  return next;
}

export function getSession() {
  if (!session) session = readStoredSession();
  return session;
}

export function currentUserId() {
  return getSession()?.user?.id || null;
}

// ── LOW-LEVEL REQUEST ────────────────────────────────────────────────────────
function authHeaders(token) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token || ANON}`,
  };
}

async function readError(res) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body.message || body.error_description || body.error || body.msg
      || body.hint || "";
  } catch {
    detail = await res.text().catch(() => "");
  }
  return detail || `Request failed (${res.status})`;
}

// ── TOKEN REFRESH ────────────────────────────────────────────────────────────
// One in-flight refresh at a time, so a burst of parallel reads on page load
// can't fire six refreshes and invalidate each other's rotating token.
let refreshing = null;

async function refreshSession() {
  const current = getSession();
  if (!current?.refresh_token) return null;

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        if (!res.ok) {
          writeSession(null);
          return null;
        }
        return storeTokens(await res.json());
      } catch {
        // Offline: keep the session so the app recovers when the network does.
        return getSession();
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function validToken() {
  const current = getSession();
  if (!current) return null;
  const nearExpiry = current.expires_at - 60 <= Math.floor(Date.now() / 1000);
  if (nearExpiry) {
    const next = await refreshSession();
    return next?.access_token || null;
  }
  return current.access_token;
}

// ── REST (PostgREST) ─────────────────────────────────────────────────────────
export async function rest(path, options = {}) {
  if (!isConfigured) throw new Error("Cloud database is not configured.");

  const { method = "GET", body, prefer, retried } = options;
  const token = await validToken();
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const headers = { ...authHeaders(token) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${BASE}/rest/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // An expired token that slipped past the clock check: refresh once, retry once.
  if (res.status === 401 && !retried) {
    const next = await refreshSession();
    if (next?.access_token) return rest(path, { ...options, retried: true });
  }

  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function rpc(fn, args = {}) {
  return rest(`/rpc/${fn}`, { method: "POST", body: args });
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  if (!isConfigured) throw new Error("Cloud database is not configured.");

  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  if (!res.ok) {
    const detail = await readError(res);
    if (/invalid login credentials/i.test(detail)) {
      throw new Error("Wrong email or password.");
    }
    if (/email not confirmed/i.test(detail)) {
      throw new Error("Check your inbox and confirm your email first.");
    }
    throw new Error(detail);
  }

  return storeTokens(await res.json());
}

// Returns { session } when the project has email confirmation off (the setup
// this app documents), or { needsConfirmation: true } when it is on.
export async function signUp(email, password, meta = {}) {
  if (!isConfigured) throw new Error("Cloud database is not configured.");

  const res = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      data: meta,
    }),
  });

  if (!res.ok) {
    const detail = await readError(res);
    if (/already registered|already exists|duplicate/i.test(detail)) {
      throw new Error("That email is already registered. Sign in instead.");
    }
    if (/password/i.test(detail) && /least|short/i.test(detail)) {
      throw new Error("Password must be at least 6 characters.");
    }
    throw new Error(detail);
  }

  const payload = await res.json();
  if (payload.access_token) return { session: storeTokens(payload) };
  return { needsConfirmation: true };
}

export async function signOut() {
  const current = getSession();
  writeSession(null);
  if (!current?.access_token || !isConfigured) return;
  // Best effort: revoke server-side, but never block the UI on it.
  try {
    await fetch(`${BASE}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(current.access_token),
    });
  } catch {
    /* already signed out locally */
  }
}

// Confirms the stored token is still good and returns the auth user, or null.
export async function restoreSession() {
  if (!isConfigured) return null;
  const token = await validToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BASE}/auth/v1/user`, { headers: authHeaders(token) });
    if (!res.ok) {
      writeSession(null);
      return null;
    }
    const user = await res.json();
    writeSession({ ...getSession(), user });
    return user;
  } catch {
    // Offline but holding a token that has not expired: trust it.
    return getSession()?.user || null;
  }
}
