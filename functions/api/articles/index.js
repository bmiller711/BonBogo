// GET /api/articles -> published articles, newest first

import { getDb } from '../../_lib/db.js';
import { articleSummary } from '../../_lib/rows.js';
import { json } from '../../_lib/util.js';

export async function onRequestGet({ env }) {
  const db = await getDb(env);
  const { results } = await db
    .prepare('SELECT * FROM articles WHERE published = 1 ORDER BY published_at DESC LIMIT 200')
    .all();
  return json({ articles: results.map(articleSummary) });
}
