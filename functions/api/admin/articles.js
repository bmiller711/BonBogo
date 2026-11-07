// POST /api/admin/articles -> create or update an article
// { id?, title, slug?, category, author, excerpt, body, featured, published }

import { getDb } from '../../_lib/db.js';
import { clean, fail, intParam, json, nowIso, readJson } from '../../_lib/util.js';

const CATEGORIES = ['Deals 101', 'Store Intel', 'Card Strategy', 'Guest Column'];

function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'article'
  );
}

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  if (!b) return fail('Could not read the article.');
  const title = clean(b.title, 160);
  if (!title) return fail('Please give the article a title.');
  const category = CATEGORIES.includes(b.category) ? b.category : 'Deals 101';
  const author = clean(b.author, 60) || 'Jon Bon Bogo';
  const excerpt = clean(b.excerpt, 300);
  const body = typeof b.body === 'string' ? b.body.slice(0, 60000) : '';
  const featured = b.featured ? 1 : 0;
  const published = b.published ? 1 : 0;
  const id = intParam(b.id);
  const db = await getDb(env);
  const now = nowIso();

  let slug = slugify(clean(b.slug, 80) || title);
  const clash = await db.prepare('SELECT id FROM articles WHERE slug = ?').bind(slug).first();
  if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36)}`;

  let row;
  if (id) {
    const existing = await db.prepare('SELECT published_at FROM articles WHERE id = ?').bind(id).first();
    if (!existing) return fail('Article not found.', 404);
    const publishedAt = published ? existing.published_at || now : existing.published_at;
    row = await db
      .prepare(
        'UPDATE articles SET slug = ?, title = ?, category = ?, author = ?, excerpt = ?, body = ?, featured = ?, published = ?, published_at = ?, updated_at = ? WHERE id = ? RETURNING *'
      )
      .bind(slug, title, category, author, excerpt, body, featured, published, publishedAt, now, id)
      .first();
  } else {
    row = await db
      .prepare(
        'INSERT INTO articles (slug, title, category, author, excerpt, body, featured, published, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
      )
      .bind(slug, title, category, author, excerpt, body, featured, published, published ? now : null, now, now)
      .first();
  }
  if (featured) {
    await db.prepare('UPDATE articles SET featured = 0 WHERE id != ?').bind(row.id).run();
  }
  return json({ article: row });
}
