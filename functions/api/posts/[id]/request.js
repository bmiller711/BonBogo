// POST /api/posts/:id/request -> ask a guest for their referral link.
// The request is saved, and emailed to the guest if email is set up.
// The guest's own email address is never shown to the requester.

import { getDb } from '../../../_lib/db.js';
import { sendEmail } from '../../../_lib/email.js';
import { clean, fail, intParam, isEmail, json, nowIso, rateLimit, readJson, verifyTurnstile, visitorHash } from '../../../_lib/util.js';

export async function onRequestPost({ request, env, params }) {
  const id = intParam(params.id);
  if (!id) return fail('Unknown post.', 404);
  const body = await readJson(request);
  if (!body) return fail('Could not read the form.');
  if (!(await verifyTurnstile(env, body.token, request))) {
    return fail('The spam check failed. Please try again.', 403);
  }
  const name = clean(body.name, 60);
  const email = clean(body.email, 200);
  const note = clean(body.note, 600);
  if (!name) return fail('Please add your name.');
  if (!isEmail(email)) return fail('Please enter a valid email so the guest can reply.');

  const db = await getDb(env);
  const post = await db.prepare("SELECT * FROM posts WHERE id = ? AND status = 'approved'").bind(id).first();
  if (!post) return fail('Unknown post.', 404);

  const visitor = await visitorHash(request, env);
  if (!(await rateLimit(db, `req:${visitor}`, 5, 86400))) {
    return fail('You have sent several requests today. Please try again tomorrow.', 429);
  }
  if (!(await rateLimit(db, `req-post:${id}`, 25, 86400))) {
    return fail('This guest has had a lot of requests today. Please try again tomorrow.', 429);
  }

  const emailed = await sendEmail(env, {
    to: post.contact_email,
    replyTo: email,
    subject: `Referral request for your ${post.card_name}, from ${name}`,
    text:
      `Hi ${post.guest_name},\n\n` +
      `${name} read your post about the ${post.card_name} on Jon Bon Bogo the Bogo Guy and would like a referral link.\n\n` +
      `Their email: ${email}\n` +
      (note ? `Their note: ${note}\n` : '') +
      `\nJust reply to this email to answer them. You are never obligated to share a link. ` +
      `If you do, please let them know you may earn rewards from it.\n`,
  });

  await db
    .prepare('INSERT INTO referral_requests (post_id, name, email, note, emailed, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, name, email, note, emailed ? 1 : 0, visitor, nowIso())
    .run();
  return json({ ok: true }, 201);
}
