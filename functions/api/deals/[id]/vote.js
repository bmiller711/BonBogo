// POST /api/deals/:id/vote  { kind: "still" | "gone" }
// One vote per person per deal per day.

import { getDb } from '../../../_lib/db.js';
import { fail, intParam, json, readJson, today, visitorHash } from '../../../_lib/util.js';

export async function onRequestPost({ request, env, params }) {
  const id = intParam(params.id);
  if (!id) return fail('Unknown deal.', 404);
  const body = await readJson(request);
  const kind = body && body.kind;
  if (kind !== 'still' && kind !== 'gone') return fail('Vote must be "still" or "gone".');

  const db = await getDb(env);
  const deal = await db.prepare('SELECT id FROM deals WHERE id = ? AND hidden = 0').bind(id).first();
  if (!deal) return fail('Unknown deal.', 404);

  const visitor = await visitorHash(request, env);
  const inserted = await db
    .prepare('INSERT OR IGNORE INTO votes (deal_id, ip_hash, day) VALUES (?, ?, ?)')
    .bind(id, visitor, today())
    .run();
  let counted = false;
  if (inserted.meta.changes > 0) {
    await db.prepare(`UPDATE deals SET ${kind} = ${kind} + 1 WHERE id = ?`).bind(id).run();
    counted = true;
  }
  const row = await db.prepare('SELECT still, gone FROM deals WHERE id = ?').bind(id).first();
  return json({ counted, still: row.still, gone: row.gone });
}
