// Small shared helpers for the API.

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function fail(message, status = 400) {
  return json({ error: message }, status);
}

// Trim, strip control characters, and cap length. Non-strings become ''.
export function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;

export function isEmail(value) {
  return typeof value === 'string' && value.length <= 200 && EMAIL_RE.test(value);
}

export function nowIso() {
  return new Date().toISOString();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// A one-way fingerprint of the visitor's IP, used only for spam limits and
// one-vote-per-person. The raw IP address is never stored.
export async function visitorHash(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
  const salt = env.ADMIN_PASSWORD || 'local-dev-salt';
  return (await sha256(`${ip}|${salt}`)).slice(0, 32);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function intParam(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Cloudflare Turnstile spam check. If no secret key is configured (local
// development), the check is skipped so the site still works.
export async function verifyTurnstile(env, token, request) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token || typeof token !== 'string') return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// Fixed-window rate limit stored in the database. Returns true if allowed.
export async function rateLimit(db, key, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  if (Math.random() < 0.02) {
    // Occasionally clear out expired counters so the table stays small.
    await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 2 * 86400).run();
  }
  const row = await db.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').bind(key).first();
  if (!row || now - row.window_start >= windowSeconds) {
    await db
      .prepare(
        'INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start'
      )
      .bind(key, now)
      .run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export function reportThreshold(env) {
  const n = Number.parseInt(env.REPORT_HIDE_THRESHOLD || '3', 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export function methodNotAllowed() {
  return fail('Method not allowed', 405);
}
