// GET /api/photos/:key -> a deal photo. Only approved photos are public;
// pending ones are visible to the signed-in admin for review.

import { isAdmin } from '../../_lib/auth.js';
import { getDb } from '../../_lib/db.js';

export async function onRequestGet({ request, env, params }) {
  const key = String(params.key || '');
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key) || !env.PHOTOS) {
    return new Response('Not found', { status: 404 });
  }
  const db = await getDb(env);
  const deal = await db.prepare('SELECT photo_status FROM deals WHERE photo_key = ?').bind(key).first();
  if (!deal) return new Response('Not found', { status: 404 });
  const approved = deal.photo_status === 'approved';
  if (!approved && !(await isAdmin(request, env))) return new Response('Not found', { status: 404 });

  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': approved ? 'public, max-age=86400' : 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
