// GET  /api/deals/:id/comments -> visible comments, oldest first
// POST /api/deals/:id/comments -> { name, body, token }  (appears right away)

import { getDb } from '../../../_lib/db.js';
import { commentRow } from '../../../_lib/rows.js';
import { clean, fail, intParam, json, nowIso, rateLimit, readJson, verifyTurnstile, visitorHash } from '../../../_lib/util.js';

export async function onRequestGet({ env, params }) {
  const id = intParam(params.id);
  if (!id) return fail('Unknown deal.', 404);
  const db = await getDb(env);
  const { results } = await db
    .prepare('SELECT * FROM comments WHERE deal_id = ? AND hidden = 0 ORDER BY created_at ASC LIMIT 200')
    .bind(id)
    .all();
  return json({ comments: results.map(commentRow) });
}

export async function onRequestPost({ request, env, params }) {
  const id = intParam(params.id);
  if (!id) return fail('Unknown deal.', 404);
  const body = await readJson(request);
  if (!body) return fail('Could not read the comment.');
  if (!(await verifyTurnstile(env, body.token, request))) {
    return fail('The spam check failed. Please try again.', 403);
  }
  const text = clean(body.body, 1000);
  const name = clean(body.name, 40);
  if (!text) return fail('Please write a comment first.');

  const db = await getDb(env);
  const deal = await db.prepare('SELECT id FROM deals WHERE id = ? AND hidden = 0').bind(id).first();
  if (!deal) return fail('Unknown deal.', 404);
  const visitor = await visitorHash(request, env);
  if (!(await rateLimit(db, `comment:${visitor}`, 20, 3600))) {
    return fail('You have commented a lot in the last hour. Please try again later.', 429);
  }
  const row = await db
    .prepare('INSERT INTO comments (deal_id, name, body, ip_hash, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *')
    .bind(id, name, text, visitor, nowIso())
    .first();
  return json({ comment: commentRow(row) }, 201);
}
