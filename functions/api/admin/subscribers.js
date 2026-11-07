// GET /api/admin/subscribers -> CSV download of the email list

import { getDb } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  const db = await getDb(env);
  const { results } = await db.prepare('SELECT email, created_at FROM subscribers ORDER BY created_at ASC').all();
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ['email,signed_up', ...results.map((r) => `${esc(r.email)},${esc(r.created_at)}`)].join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="jonbonbogo-subscribers.csv"',
      'cache-control': 'no-store',
    },
  });
}
