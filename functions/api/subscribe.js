// POST /api/subscribe { email } -> join the weekly deals email list

import { getDb } from '../_lib/db.js';
import { clean, fail, isEmail, json, nowIso, rateLimit, readJson, visitorHash } from '../_lib/util.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = clean(body && body.email, 200).toLowerCase();
  if (!isEmail(email)) return fail('Please enter a valid email address.');
  const db = await getDb(env);
  const visitor = await visitorHash(request, env);
  if (!(await rateLimit(db, `sub:${visitor}`, 5, 3600))) {
    return fail('Too many sign-ups from here. Please try again later.', 429);
  }
  await db.prepare('INSERT OR IGNORE INTO subscribers (email, created_at) VALUES (?, ?)').bind(email, nowIso()).run();
  return json({ ok: true });
}
