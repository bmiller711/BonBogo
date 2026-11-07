// GET  /api/posts -> approved guest card posts
// POST /api/posts -> submit a guest post (waits for admin approval)

import { getDb } from '../../_lib/db.js';
import { sendEmail } from '../../_lib/email.js';
import { postRow } from '../../_lib/rows.js';
import { clean, fail, isEmail, json, nowIso, rateLimit, readJson, verifyTurnstile, visitorHash } from '../../_lib/util.js';

export async function onRequestGet({ env }) {
  const db = await getDb(env);
  const { results } = await db
    .prepare("SELECT * FROM posts WHERE status = 'approved' ORDER BY approved_at DESC LIMIT 100")
    .all();
  return json({ posts: results.map(postRow) });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return fail('Could not read the form.');
  if (!(await verifyTurnstile(env, body.token, request))) {
    return fail('The spam check failed. Please try again.', 403);
  }

  const post = {
    guestName: clean(body.guestName, 40),
    cardName: clean(body.cardName, 80),
    issuer: clean(body.issuer, 60),
    annualFee: clean(body.annualFee, 60),
    feeNote: clean(body.feeNote, 200),
    why: clean(body.why, 2000),
    perks: clean(body.perks, 1000),
    contactEmail: clean(body.contactEmail, 200),
  };
  if (!post.guestName || !post.cardName || !post.issuer || !post.annualFee || !post.why) {
    return fail('Please fill in your name, the card, the issuer, the annual fee and why you chose it.');
  }
  if (!isEmail(post.contactEmail)) return fail('Please enter a valid contact email.');
  if (body.agree !== true) return fail('Please tick the box about referral rewards.');

  const db = await getDb(env);
  const visitor = await visitorHash(request, env);
  if (!(await rateLimit(db, `post:${visitor}`, 3, 86400))) {
    return fail('You have sent several posts today. Please try again tomorrow.', 429);
  }
  await db
    .prepare(
      'INSERT INTO posts (guest_name, card_name, issuer, annual_fee, fee_note, why, perks, contact_email, ip_hash, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(post.guestName, post.cardName, post.issuer, post.annualFee, post.feeNote, post.why, post.perks, post.contactEmail, visitor, nowIso())
    .run();

  if (env.CONTACT_EMAIL) {
    const site = new URL(request.url).origin;
    await sendEmail(env, {
      to: env.CONTACT_EMAIL,
      subject: `New guest post to review: ${post.cardName}`,
      text: `${post.guestName} sent a guest post about the ${post.cardName} (${post.issuer}).\n\nReview it at ${site}/admin`,
    });
  }
  return json({ ok: true }, 201);
}
