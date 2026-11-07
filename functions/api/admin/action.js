// POST /api/admin/action { type, id, action } -> approve, reject, hide, restore or delete

import { getDb } from '../../_lib/db.js';
import { fail, intParam, json, nowIso, readJson } from '../../_lib/util.js';

async function deletePhoto(env, key) {
  if (key && env.PHOTOS) await env.PHOTOS.delete(key);
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const id = intParam(body && body.id);
  const type = body && body.type;
  const action = body && body.action;
  if (!id || !type || !action) return fail('Missing type, id or action.');
  const db = await getDb(env);
  const run = (sql, ...args) => db.prepare(sql).bind(...args).run();

  switch (`${type}:${action}`) {
    case 'post:approve':
      await run("UPDATE posts SET status = 'approved', approved_at = ? WHERE id = ?", nowIso(), id);
      break;
    case 'post:reject':
      await run("UPDATE posts SET status = 'rejected' WHERE id = ?", id);
      break;
    case 'post:delete':
      await run('DELETE FROM referral_requests WHERE post_id = ?', id);
      await run('DELETE FROM posts WHERE id = ?', id);
      break;

    case 'photo:approve':
      await run("UPDATE deals SET photo_status = 'approved' WHERE id = ?", id);
      break;
    case 'photo:reject': {
      const d = await db.prepare('SELECT photo_key FROM deals WHERE id = ?').bind(id).first();
      await deletePhoto(env, d && d.photo_key);
      await run('UPDATE deals SET photo_key = NULL, photo_status = NULL WHERE id = ?', id);
      break;
    }

    case 'deal:hide':
      await run('UPDATE deals SET hidden = 1 WHERE id = ?', id);
      break;
    case 'deal:restore':
      await run('UPDATE deals SET hidden = 0, reports = 0 WHERE id = ?', id);
      await run("DELETE FROM reports WHERE kind = 'deal' AND target_id = ?", id);
      break;
    case 'deal:delete': {
      const d = await db.prepare('SELECT photo_key FROM deals WHERE id = ?').bind(id).first();
      await deletePhoto(env, d && d.photo_key);
      await run('DELETE FROM comments WHERE deal_id = ?', id);
      await run('DELETE FROM votes WHERE deal_id = ?', id);
      await run("DELETE FROM reports WHERE kind = 'deal' AND target_id = ?", id);
      await run('DELETE FROM deals WHERE id = ?', id);
      break;
    }

    case 'comment:hide':
      await run('UPDATE comments SET hidden = 1 WHERE id = ?', id);
      break;
    case 'comment:restore':
      await run('UPDATE comments SET hidden = 0, reports = 0 WHERE id = ?', id);
      await run("DELETE FROM reports WHERE kind = 'comment' AND target_id = ?", id);
      break;
    case 'comment:delete':
      await run("DELETE FROM reports WHERE kind = 'comment' AND target_id = ?", id);
      await run('DELETE FROM comments WHERE id = ?', id);
      break;

    case 'article:delete':
      await run('DELETE FROM articles WHERE id = ?', id);
      break;

    case 'request:delete':
      await run('DELETE FROM referral_requests WHERE id = ?', id);
      break;

    default:
      return fail('Unknown action.');
  }
  return json({ ok: true });
}
