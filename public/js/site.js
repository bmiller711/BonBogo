// Shared helpers for every page: API calls, the spam check, safe DOM building,
// dates, the weekly-email form, and the contact email.

export async function api(path, options = {}) {
  const opts = { ...options, headers: { ...(options.headers || {}) } };
  if (opts.json !== undefined) {
    opts.body = JSON.stringify(opts.json);
    opts.headers['content-type'] = 'application/json';
    delete opts.json;
  }
  if (opts.body && !opts.method) opts.method = 'POST';
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new Error('Could not reach the site. Check your connection and try again.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
  return data;
}

let configPromise = null;
export function getConfig() {
  if (!configPromise) configPromise = api('/api/config').catch(() => ({}));
  return configPromise;
}

// Build DOM nodes without innerHTML, so text from visitors is always safe.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export function formatDate(iso) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Cloudflare Turnstile (spam check) ----------
let turnstileLoading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoading) {
    turnstileLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => {
        turnstileLoading = null;
        reject(new Error('The spam check could not load. Please refresh the page.'));
      };
      document.head.append(s);
    });
  }
  return turnstileLoading;
}

// Renders the spam check into `slot` (if the site has one configured) and
// returns helpers to read and reset the token.
export async function spamCheck(slot) {
  const { turnstileSiteKey } = await getConfig();
  if (!turnstileSiteKey || !slot) return { token: () => '', reset: () => {} };
  try {
    const ts = await loadTurnstile();
    const id = ts.render(slot, { sitekey: turnstileSiteKey, theme: 'dark', size: 'flexible' });
    return {
      token: () => ts.getResponse(id) || '',
      reset: () => ts.reset(id),
    };
  } catch (err) {
    slot.textContent = err.message;
    return { token: () => '', reset: () => {} };
  }
}

// ---------- Simple, safe article formatting ----------
// Supports: blank-line paragraphs, "## " and "### " headings, "- " lists,
// "> " quotes, **bold**, *italic*, and [links](https://...).
function inline(text) {
  const frag = document.createDocumentFragment();
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    if (m[2]) frag.append(el('strong', {}, m[2]));
    else if (m[4]) frag.append(el('em', {}, m[4]));
    else if (m[6]) frag.append(el('a', { href: m[7], rel: 'noopener nofollow', target: '_blank' }, m[6]));
    last = re.lastIndex;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

export function renderArticle(body) {
  const frag = document.createDocumentFragment();
  const blocks = String(body || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split('\n');
    if (block.startsWith('### ')) frag.append(el('h3', {}, inline(block.slice(4))));
    else if (block.startsWith('## ')) frag.append(el('h2', {}, inline(block.slice(3))));
    else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      frag.append(el('ul', {}, lines.map((l) => el('li', {}, inline(l.replace(/^\s*[-*]\s+/, ''))))));
    } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      frag.append(el('ol', {}, lines.map((l) => el('li', {}, inline(l.replace(/^\s*\d+[.)]\s+/, ''))))));
    } else if (lines.every((l) => l.startsWith('>'))) {
      frag.append(el('blockquote', {}, inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' '))));
    } else {
      const p = el('p');
      lines.forEach((l, i) => {
        if (i) p.append(el('br'));
        p.append(inline(l));
      });
      frag.append(p);
    }
  }
  return frag;
}

// ---------- On every page ----------
function setMsg(node, text, ok = false) {
  if (!node) return;
  node.textContent = text;
  node.classList.toggle('ok', ok);
}
export { setMsg };

function wireSubscribe() {
  for (const form of document.querySelectorAll('form[data-subscribe]')) {
    const msg = form.querySelector('.form-msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await api('/api/subscribe', { json: { email: form.email.value.trim() } });
        form.reset();
        setMsg(msg, "You're on the list. Watch your inbox for the weekly deals.", true);
      } catch (err) {
        setMsg(msg, err.message);
      } finally {
        btn.disabled = false;
      }
    });
  }
}

async function wireContact() {
  const nodes = document.querySelectorAll('[data-contact-email]');
  const optional = document.querySelectorAll('[data-if-contact]');
  if (!nodes.length && !optional.length) return;
  const { contactEmail } = await getConfig();
  for (const n of optional) n.hidden = !contactEmail;
  for (const n of nodes) {
    if (!contactEmail) continue;
    if (n.tagName === 'A') n.href = `mailto:${contactEmail}`;
    if (!n.hasAttribute('data-keep-text')) n.textContent = contactEmail;
  }
}

wireSubscribe();
wireContact();
