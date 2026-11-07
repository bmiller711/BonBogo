// Admin sign-in: a single password (the ADMIN_PASSWORD setting) and a signed,
// HttpOnly session cookie. Changing ADMIN_PASSWORD signs everyone out.

const COOKIE = 'jbb_admin';
const SESSION_HOURS = 24 * 7;

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text) {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(env) {
  const raw = new TextEncoder().encode(`jbb-session|${env.ADMIN_PASSWORD}`);
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function makeSessionCookie(env, request) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = new TextEncoder().encode(JSON.stringify({ exp }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), payload);
  const token = `${b64url(payload)}.${b64url(new Uint8Array(sig))}`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return false;
  const [p, s] = match[1].split('.');
  if (!p || !s) return false;
  try {
    const payload = fromB64url(p);
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(s), payload);
    if (!ok) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(payload));
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

// Compare two strings without leaking how many characters matched.
export async function passwordMatches(given, expected) {
  if (typeof given !== 'string' || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
