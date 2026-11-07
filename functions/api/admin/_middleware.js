// Every /api/admin/* request needs the admin session, except signing in.

import { isAdmin } from '../../_lib/auth.js';
import { fail } from '../../_lib/util.js';

const OPEN = new Set(['/api/admin/login', '/api/admin/me', '/api/admin/logout']);

export async function onRequest({ request, env, next }) {
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  if (OPEN.has(path)) return next();
  if (!(await isAdmin(request, env))) return fail('Please sign in.', 401);
  if (request.method !== 'GET' && !(request.headers.get('content-type') || '').includes('application/json')) {
    return fail('Expected JSON.', 415);
  }
  return next();
}
