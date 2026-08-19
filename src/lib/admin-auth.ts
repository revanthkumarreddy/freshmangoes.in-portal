/**
 * Admin session helpers (static-site best effort).
 * Real order ops belong in the Wix dashboard — this UI is gated and rate-limited.
 */

const SESSION_KEY = 'fm:admin_session';
const ATTEMPTS_KEY = 'fm:admin_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

type Session = { token: string; exp: number };
type Attempts = { count: number; lockedUntil: number };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readAttempts(): Attempts {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{"count":0,"lockedUntil":0}');
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function writeAttempts(a: Attempts) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a));
}

export function isAdminLocked(): { locked: boolean; retryAfterMs: number } {
  const a = readAttempts();
  const now = Date.now();
  if (a.lockedUntil > now) return { locked: true, retryAfterMs: a.lockedUntil - now };
  return { locked: false, retryAfterMs: 0 };
}

export function isAdminSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as Session;
    if (!s?.token || !s?.exp || Date.now() > s.exp) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return s.token.length >= 32;
  } catch {
    return false;
  }
}

export function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function tryAdminLogin(email: string, passcode: string): Promise<{ ok: boolean; error?: string }> {
  const lock = isAdminLocked();
  if (lock.locked) {
    const mins = Math.ceil(lock.retryAfterMs / 60000);
    return { ok: false, error: `Too many attempts. Try again in ${mins} min.` };
  }

  const expectedEmail = (import.meta.env.PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();
  const expectedHash = (import.meta.env.PUBLIC_ADMIN_PASS_HASH || '').trim().toLowerCase();

  if (!expectedEmail || !expectedHash) {
    return {
      ok: false,
      error: 'Admin login is disabled. Configure PUBLIC_ADMIN_EMAIL and PUBLIC_ADMIN_PASS_HASH.',
    };
  }

  const emailNorm = (email || '').trim().toLowerCase();
  const hash = await sha256Hex(passcode || '');

  // Constant-ish compare of hex strings
  let match = emailNorm === expectedEmail && hash === expectedHash && hash.length === 64;
  if (!match) {
    const a = readAttempts();
    a.count += 1;
    if (a.count >= MAX_ATTEMPTS) {
      a.lockedUntil = Date.now() + LOCKOUT_MS;
      a.count = 0;
    }
    writeAttempts(a);
    return { ok: false, error: 'Invalid credentials. Access denied.' };
  }

  writeAttempts({ count: 0, lockedUntil: 0 });
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const session: Session = { token, exp: Date.now() + SESSION_TTL_MS };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Remove legacy insecure flag if present
  localStorage.removeItem('fm:admin_auth');
  return { ok: true };
}
