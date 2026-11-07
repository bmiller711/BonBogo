// POST /api/comments/:id/report -> flag a comment (auto-hidden after enough reports)

import { getDb } from '../../../_lib/db.js';
import { fail, intParam, json, reportThreshold, visitorHash } from '../../../_lib/util.js';

export async function onRequestPost({ request, env, params }) {
  const id = intParam(params.id);
  if (!id) return fail('Unknown comment.', 404);
  const db = await getDb(env);
  const row = await db.prepare('SELECT id FROM comments WHERE id = ?').bind(id).first();
  if (!row) return fail('Unknown comment.', 404);
  const visitor = await visitorHash(request, env);
  const ins = await db
    .prepare("INSERT OR IGNORE INTO reports (kind, target_id, ip_hash) VALUES ('comment', ?, ?)")
    .bind(id, visitor)
    .run();
  if (ins.meta.changes > 0) {
    await db
      .prepare('UPDATE comments SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= ? THEN 1 ELSE hidden END WHERE id = ?')
      .bind(reportThreshold(env), id)
      .run();
  }
  return json({ ok: true });
}
