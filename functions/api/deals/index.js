// GET  /api/deals  -> public list of deals (newest first)
// POST /api/deals  -> add a deal (multipart form, optional photo)

import { getDb } from '../../_lib/db.js';
import { dealRow } from '../../_lib/rows.js';
import { clean, fail, json, nowIso, rateLimit, today, verifyTurnstile, visitorHash } from '../../_lib/util.js';

const DEAL_TYPES = ['BOGO', 'BUY X GET Y', '% OFF', 'PRICE DROP', 'COUPON', 'CLEARANCE', 'OTHER'];
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_AGE_DAYS = 45;

export async function onRequestGet({ request, env }) {
  const db = await getDb(env);
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const q = clean(url.searchParams.get('q') || '', 60);
  const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '60', 10) || 60, 100);

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86400 * 1000).toISOString();
  const where = ['d.hidden = 0', 'd.created_at >= ?', '(d.good_through IS NULL OR d.good_through >= ?)'];
  const args = [cutoff, today()];
  if (scope === 'local' || scope === 'national') {
    where.push('d.scope = ?');
    args.push(scope);
  }
  if (q) {
    where.push('(d.item LIKE ? OR d.store LIKE ? OR d.place LIKE ? OR d.details LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    args.push(like, like, like, like);
  }
  const sql =
    'SELECT d.*, (SELECT COUNT(*) FROM comments c WHERE c.deal_id = d.id AND c.hidden = 0) AS comment_count ' +
    `FROM deals d WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT ?`;
  const { results } = await db.prepare(sql).bind(...args, limit).all();
  return json({ deals: results.map(dealRow) });
}

export async function onRequestPost({ request, env }) {
  const db = await getDb(env);
  let form;
  try {
    form = await request.formData();
  } catch {
    return fail('Could not read the form.');
  }

  if (!(await verifyTurnstile(env, form.get('cf-turnstile-response'), request))) {
    return fail('The spam check failed. Please try again.', 403);
  }
  const visitor = await visitorHash(request, env);
  if (!(await rateLimit(db, `deal:${visitor}`, 10, 3600))) {
    return fail('You have posted a lot of deals in the last hour. Please try again later.', 429);
  }

  const item = clean(form.get('item'), 80);
  const details = clean(form.get('details'), 120);
  const store = clean(form.get('store'), 80);
  const place = clean(form.get('place'), 120);
  const who = clean(form.get('who'), 40);
  const scope = form.get('scope') === 'national' ? 'national' : 'local';
  const dealTypeRaw = clean(form.get('dealType'), 20).toUpperCase();
  const dealType = DEAL_TYPES.includes(dealTypeRaw) ? dealTypeRaw : 'OTHER';
  const goodThroughRaw = clean(form.get('goodThrough'), 10);
  const goodThrough = /^\d{4}-\d{2}-\d{2}$/.test(goodThroughRaw) ? goodThroughRaw : null;

  if (!item || !store) return fail('Please say what the deal is on and which store.');
  if (scope === 'local' && !place) return fail('For a local deal, please add the street, city and state.');

  let photoKey = null;
  const photo = form.get('photo');
  if (photo && typeof photo === 'object' && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext) return fail('Photos must be JPEG, PNG or WebP images.');
    if (photo.size > MAX_PHOTO_BYTES) return fail('That photo is too large. Please use one under 6 MB.');
    if (!env.PHOTOS) return fail('Photo uploads are not set up yet. Please post without a photo.', 503);
    photoKey = `${crypto.randomUUID()}.${ext}`;
    await env.PHOTOS.put(photoKey, photo.stream(), { httpMetadata: { contentType: photo.type } });
  }

  const created = nowIso();
  const result = await db
    .prepare(
      'INSERT INTO deals (item, deal_type, details, store, place, scope, who, good_through, photo_key, photo_status, ip_hash, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
    )
    .bind(item, dealType, details, store, place, scope, who, goodThrough, photoKey, photoKey ? 'pending' : null, visitor, created)
    .first();

  return json({ deal: dealRow({ ...result, comment_count: 0 }) }, 201);
}
