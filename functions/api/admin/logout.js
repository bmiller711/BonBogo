// POST /api/admin/logout

import { clearSessionCookie } from '../../_lib/auth.js';
import { json } from '../../_lib/util.js';

export function onRequestPost() {
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}
