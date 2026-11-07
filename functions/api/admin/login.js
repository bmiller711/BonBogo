// POST /api/admin/login { password }

import { makeSessionCookie, passwordMatches } from '../../_lib/auth.js';
import { getDb } from '../../_lib/db.js';
import { fail, json, rateLimit, readJson, visitorHash } from '../../_lib/util.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) return fail('Admin sign-in is not set up yet. Add ADMIN_PASSWORD in Cloudflare (see README).', 503);
  const db = await getDb(env);
  const visitor = await visitorHash(request, env);
  if (!(await rateLimit(db, `login:${visitor}`, 10, 900))) {
    return fail('Too many attempts. Please wait 15 minutes.', 429);
  }
  const body = await readJson(request);
  if (!(await passwordMatches(body && body.password, env.ADMIN_PASSWORD))) {
    return fail('Wrong password.', 401);
  }
  return json({ ok: true }, 200, { 'set-cookie': await makeSessionCookie(env, request) });
}
