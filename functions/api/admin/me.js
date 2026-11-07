// GET /api/admin/me -> whether you're signed in, and which settings are configured

import { isAdmin } from '../../_lib/auth.js';
import { emailConfigured } from '../../_lib/email.js';
import { json } from '../../_lib/util.js';

export async function onRequestGet({ request, env }) {
  return json({
    admin: await isAdmin(request, env),
    passwordSet: Boolean(env.ADMIN_PASSWORD),
    setup: {
      database: Boolean(env.DB),
      photos: Boolean(env.PHOTOS),
      spamCheck: Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY),
      email: emailConfigured(env),
      contactEmail: Boolean(env.CONTACT_EMAIL),
    },
  });
}
