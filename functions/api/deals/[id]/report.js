// POST /api/deals/:id/report  -> flag a deal. Hidden automatically after
// REPORT_HIDE_THRESHOLD reports (default 3) until you review it.

import { getDb } from '../../../_lib/db.js';
import { fail, intParam, json, reportThreshold, visitorHash } from '../../../_lib/util.js';

export async function onRequestPost({ request, env, params }) {
  const id = intParam(params.id);
  if (!id) return fail('Unknown deal.', 404);
  const db = await getDb(env);
  const deal = await db.prepare('SELECT id FROM deals WHERE id = ?').bind(id).first();
  if (!deal) return fail('Unknown deal.', 404);
  const visitor = await visitorHash(request, env);
  const ins = await db
    .prepare("INSERT OR IGNORE INTO reports (kind, target_id, ip_hash) VALUES ('deal', ?, ?)")
    .bind(id, visitor)
    .run();
  if (ins.meta.changes > 0) {
    await db
      .prepare('UPDATE deals SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= ? THEN 1 ELSE hidden END WHERE id = ?')
      .bind(reportThreshold(env), id)
      .run();
  }
  return json({ ok: true });
}
