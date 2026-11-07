// GET /api/admin/overview -> everything the admin page shows

import { getDb } from '../../_lib/db.js';
import { json } from '../../_lib/util.js';

export async function onRequestGet({ env }) {
  const db = await getDb(env);
  const q = (sql) => db.prepare(sql).all().then((r) => r.results);
  const [pendingPosts, approvedPosts, pendingPhotos, flaggedDeals, flaggedComments, recentDeals, articles, requests, subs] =
    await Promise.all([
      q("SELECT * FROM posts WHERE status = 'pending' ORDER BY created_at ASC"),
      q("SELECT id, guest_name, card_name, issuer, contact_email, approved_at FROM posts WHERE status = 'approved' ORDER BY approved_at DESC LIMIT 200"),
      q("SELECT id, item, store, place, photo_key, created_at FROM deals WHERE photo_status = 'pending' ORDER BY created_at ASC"),
      q('SELECT id, item, deal_type, store, place, who, reports, hidden, created_at FROM deals WHERE reports > 0 OR hidden = 1 ORDER BY reports DESC, created_at DESC LIMIT 200'),
      q('SELECT c.id, c.deal_id, c.name, c.body, c.reports, c.hidden, c.created_at, d.item AS deal_item FROM comments c LEFT JOIN deals d ON d.id = c.deal_id WHERE c.reports > 0 OR c.hidden = 1 ORDER BY c.reports DESC, c.created_at DESC LIMIT 200'),
      q('SELECT id, item, deal_type, details, store, place, scope, who, photo_status, still, gone, reports, hidden, created_at FROM deals ORDER BY created_at DESC LIMIT 100'),
      q('SELECT id, slug, title, category, author, excerpt, body, featured, published, published_at, updated_at FROM articles ORDER BY updated_at DESC'),
      q('SELECT r.id, r.name, r.email, r.note, r.emailed, r.created_at, p.guest_name, p.card_name, p.contact_email FROM referral_requests r LEFT JOIN posts p ON p.id = r.post_id ORDER BY r.created_at DESC LIMIT 200'),
      q('SELECT COUNT(*) AS n FROM subscribers'),
    ]);
  return json({
    pendingPosts,
    approvedPosts,
    pendingPhotos,
    flaggedDeals,
    flaggedComments,
    recentDeals,
    articles,
    requests,
    subscriberCount: subs[0] ? subs[0].n : 0,
  });
}
