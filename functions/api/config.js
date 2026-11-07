// GET /api/config -> public settings the pages need (no secrets)

import { json } from '../_lib/util.js';

export function onRequestGet({ env }) {
  return json(
    {
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
      contactEmail: env.CONTACT_EMAIL || null,
      photosEnabled: Boolean(env.PHOTOS),
    },
    200,
    { 'cache-control': 'public, max-age=300' }
  );
}
