// GET /api/articles/:slug -> one published article (admin can preview drafts)

import { isAdmin } from '../../_lib/auth.js';
import { getDb } from '../../_lib/db.js';
import { articleFull } from '../../_lib/rows.js';
import { fail, json } from '../../_lib/util.js';

export async function onRequestGet({ request, env, params }) {
  const slug = String(params.slug || '').slice(0, 120);
  const db = await getDb(env);
  const row = await db.prepare('SELECT * FROM articles WHERE slug = ?').bind(slug).first();
  if (!row || (!row.published && !(await isAdmin(request, env)))) return fail('Article not found.', 404);
  return json({ article: articleFull(row) });
}
