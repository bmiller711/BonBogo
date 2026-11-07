// Deal Tracker page: list, filter, search, votes, reports, comments, and posting.

import { api, el, formatDate, getConfig, setMsg, spamCheck, timeAgo } from './site.js';

const list = document.getElementById('deal-list');
const tabs = [...document.querySelectorAll('.tab[data-scope]')];
const search = document.getElementById('deal-search');
const state = { scope: 'all', q: '', deals: [] };

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
  },
};

// ---------- listing ----------
async function load() {
  const params = new URLSearchParams();
  if (state.scope !== 'all') params.set('scope', state.scope);
  if (state.q) params.set('q', state.q);
  try {
    const { deals } = await api(`/api/deals?${params}`);
    state.deals = deals;
    render();
  } catch (err) {
    list.replaceChildren(el('p', { class: 'empty' }, err.message));
  }
}

function render() {
  if (!state.deals.length) {
    const msg = state.q ? `No deals match "${state.q}".` : 'Nothing here yet. Be the first to add one.';
    list.replaceChildren(el('p', { class: 'empty' }, msg));
    return;
  }
  list.replaceChildren(...state.deals.map(dealCard));
  openFromHash();
}

function whereText(d) {
  if (d.scope === 'national') return `${d.store} · Online and in stores`;
  return d.place ? `${d.store} · ${d.place}` : d.store;
}

function dealCard(d) {
  const gold = d.dealType === 'BOGO' || d.dealType === 'BUY X GET Y';
  const badgeText = d.dealType === 'BUY X GET Y' ? 'FREE' : d.dealType;
  const voted = store.get(`jbb-vote-${d.id}`);

  const still = el('button', { class: 'btn btn-sm btn-vote-still', type: 'button', 'aria-pressed': voted === 'still' ? 'true' : 'false' });
  const gone = el('button', { class: 'btn btn-sm btn-vote-gone', type: 'button', 'aria-pressed': voted === 'gone' ? 'true' : 'false' });
  const setCounts = (s, g) => {
    still.textContent = `Still on the shelf · ${s}`;
    gone.textContent = `Gone · ${g}`;
  };
  setCounts(d.still, d.gone);
  const vote = async (kind) => {
    try {
      const r = await api(`/api/deals/${d.id}/vote`, { json: { kind } });
      setCounts(r.still, r.gone);
      if (r.counted) {
        store.set(`jbb-vote-${d.id}`, kind);
        still.setAttribute('aria-pressed', kind === 'still' ? 'true' : 'false');
        gone.setAttribute('aria-pressed', kind === 'gone' ? 'true' : 'false');
      }
    } catch (err) {
      alertInline(card, err.message);
    }
  };
  still.addEventListener('click', () => vote('still'));
  gone.addEventListener('click', () => vote('gone'));

  const report = el('button', { class: 'btn-link', type: 'button' }, 'Report');
  report.addEventListener('click', async () => {
    report.disabled = true;
    try {
      await api(`/api/deals/${d.id}/report`, { method: 'POST' });
      report.textContent = 'Reported. Thanks.';
    } catch (err) {
      report.disabled = false;
      alertInline(card, err.message);
    }
  });

  const commentsBtn = el('button', { class: 'btn btn-sm btn-outline-gold', type: 'button', 'aria-expanded': 'false' });
  let count = d.comments;
  const label = (open) => (commentsBtn.textContent = `${open ? 'Hide comments' : 'Comments'} · ${count}`);
  label(false);
  const thread = el('div', { class: 'thread', hidden: true });
  commentsBtn.addEventListener('click', () => {
    const open = commentsBtn.getAttribute('aria-expanded') !== 'true';
    commentsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    thread.hidden = !open;
    label(open);
    if (open && !thread.dataset.loaded) {
      thread.dataset.loaded = '1';
      buildThread(d, thread, () => {
        count += 1;
        label(true);
      });
    }
  });

  const meta = [`Spotted by ${d.who}`, timeAgo(d.createdAt)];
  if (d.goodThrough) meta.push(`Good through ${formatDate(d.goodThrough)}`);

  const card = el(
    'article',
    { class: 'deal', id: `deal-${d.id}` },
    el(
      'div',
      { class: 'deal-head' },
      el('span', { class: `badge${gold ? ' badge-gold' : ''}` }, badgeText),
      el(
        'div',
        { class: 'deal-title' },
        el('h3', { class: 'deal-item', style: 'margin:0' }, d.item),
        d.details ? el('span', { class: 'deal-where', style: 'color:var(--gold)' }, d.details) : null,
        el('span', { class: 'deal-where' }, whereText(d))
      )
    ),
    d.photoUrl ? el('img', { class: 'deal-photo', src: d.photoUrl, alt: `Photo of the ${d.item} deal at ${d.store}`, loading: 'lazy' }) : null,
    d.photoPending ? el('span', { class: 'deal-note' }, 'Photo awaiting review.') : null,
    el(
      'div',
      { class: 'deal-foot' },
      el('span', { class: 'muted', style: 'font-size:16px' }, meta.join(' · ')),
      el('div', { class: 'deal-actions' }, still, gone)
    ),
    el('div', { class: 'deal-actions', style: 'justify-content:space-between' }, commentsBtn, report),
    thread
  );
  return card;
}

function alertInline(card, text) {
  let n = card.querySelector('.form-msg.inline');
  if (!n) {
    n = el('p', { class: 'form-msg inline', role: 'status' });
    card.append(n);
  }
  n.textContent = text;
}

// ---------- comments ----------
function commentNode(c) {
  const report = el('button', { class: 'btn-link', type: 'button' }, 'Report');
  report.addEventListener('click', async () => {
    report.disabled = true;
    try {
      await api(`/api/comments/${c.id}/report`, { method: 'POST' });
      report.textContent = 'Reported';
    } catch {
      report.disabled = false;
    }
  });
  return el(
    'div',
    { class: 'comment' },
    el('div', { class: 'comment-head' }, el('span', {}, el('strong', {}, c.name), ` · ${timeAgo(c.createdAt)}`), report),
    el('p', {}, c.body)
  );
}

async function buildThread(d, thread, onAdded) {
  const items = el('div', { class: 'thread' }, el('p', { class: 'loading' }, 'Loading comments…'));
  const nameId = `c-name-${d.id}`;
  const bodyId = `c-body-${d.id}`;
  const msg = el('p', { class: 'form-msg', role: 'status' });
  const slot = el('div', { class: 'turnstile-slot' });
  const form = el(
    'form',
    { class: 'comment-form', novalidate: true },
    el('div', { class: 'field' }, el('label', { for: nameId }, 'Your name or nickname (optional)'), el('input', { id: nameId, name: 'name', type: 'text', maxlength: 40 })),
    el('div', { class: 'field' }, el('label', { for: bodyId }, 'Your comment'), el('textarea', { id: bodyId, name: 'body', rows: 3, maxlength: 1000, required: true })),
    slot,
    el(
      'div',
      { class: 'deal-actions' },
      el('button', { class: 'btn btn-gold btn-sm', type: 'submit' }, 'Post comment'),
      el('span', { class: 'muted small' }, 'Keep it useful and kind. No personal info.')
    ),
    msg
  );
  thread.replaceChildren(items, form);

  const check = await spamCheck(slot);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = form.body.value.trim();
    if (!body) return setMsg(msg, 'Please write a comment first.');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const { comment } = await api(`/api/deals/${d.id}/comments`, {
        json: { name: form.name.value.trim(), body, token: check.token() },
      });
      if (items.querySelector('.empty-note')) items.replaceChildren();
      items.append(commentNode(comment));
      form.body.value = '';
      setMsg(msg, 'Posted.', true);
      onAdded();
    } catch (err) {
      setMsg(msg, err.message);
    } finally {
      check.reset();
      btn.disabled = false;
    }
  });

  try {
    const { comments } = await api(`/api/deals/${d.id}/comments`);
    items.replaceChildren(
      ...(comments.length
        ? comments.map(commentNode)
        : [el('span', { class: 'empty-note muted', style: 'font-size:17px' }, 'No comments yet. Been to the store? Tell people what you saw.')])
    );
  } catch (err) {
    items.replaceChildren(el('p', { class: 'form-msg' }, err.message));
  }
}

function openFromHash() {
  const m = location.hash.match(/^#deal-(\d+)$/);
  if (!m) return;
  const card = document.getElementById(`deal-${m[1]}`);
  if (!card || card.dataset.opened) return;
  card.dataset.opened = '1';
  card.scrollIntoView({ block: 'start' });
  card.style.borderColor = 'var(--cyan)';
}

// ---------- filters ----------
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    state.scope = tab.dataset.scope;
    for (const t of tabs) t.setAttribute('aria-pressed', t === tab ? 'true' : 'false');
    load();
  });
}
let searchTimer;
search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = search.value.trim();
    load();
  }, 300);
});

// ---------- add a deal ----------
const form = document.getElementById('deal-form');
const formMsg = form.querySelector('.form-msg');
const photoInput = document.getElementById('f-photo');
const preview = document.getElementById('photo-preview');
const previewImg = preview.querySelector('img');
const scopeSelect = document.getElementById('f-scope');
const placeField = document.getElementById('place-field');
let photoBlob = null;

function syncScope() {
  placeField.hidden = scopeSelect.value === 'national';
}
scopeSelect.addEventListener('change', syncScope);
syncScope();

// Resize in the browser: smaller uploads, and re-encoding strips hidden
// location data (EXIF) from phone photos.
async function shrink(file) {
  const MAX = 1600;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, MAX / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85)
  );
}

photoInput.addEventListener('change', async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) return;
  setMsg(formMsg, 'Preparing photo…', true);
  try {
    photoBlob = await shrink(file);
    if (previewImg.src) URL.revokeObjectURL(previewImg.src);
    previewImg.src = URL.createObjectURL(photoBlob);
    preview.hidden = false;
    setMsg(formMsg, '');
  } catch {
    photoBlob = null;
    photoInput.value = '';
    setMsg(formMsg, "Couldn't read that photo. Try a JPEG or PNG.");
  }
});

document.getElementById('photo-remove').addEventListener('click', () => {
  photoBlob = null;
  photoInput.value = '';
  preview.hidden = true;
});

let check = { token: () => '', reset: () => {} };
spamCheck(document.getElementById('deal-ts')).then((c) => (check = c));

getConfig().then((cfg) => {
  if (cfg && cfg.photosEnabled === false) photoInput.closest('.field').hidden = true;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = form.item.value.trim();
  const storeName = form.store.value.trim();
  if (!item || !storeName) return setMsg(formMsg, 'Please add what the deal is on and which store.');
  if (scopeSelect.value === 'local' && !form.place.value.trim()) {
    return setMsg(formMsg, 'For a local deal, please add the street, city and state.');
  }
  const data = new FormData();
  for (const name of ['item', 'dealType', 'details', 'store', 'scope', 'place', 'goodThrough', 'who']) {
    data.append(name, form[name].value.trim());
  }
  if (photoBlob) data.append('photo', photoBlob, 'deal.jpg');
  data.append('cf-turnstile-response', check.token());

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  setMsg(formMsg, 'Posting…', true);
  try {
    const { deal } = await api('/api/deals', { method: 'POST', body: data });
    const who = form.who.value;
    const scope = form.scope.value;
    form.reset();
    form.who.value = who;
    form.scope.value = scope;
    syncScope();
    photoBlob = null;
    preview.hidden = true;
    setMsg(formMsg, deal.photoPending ? 'Added. Thanks for the tip. Your photo will appear after a quick review.' : 'Added. Thanks for the tip.', true);
    if (state.scope !== 'all' && state.scope !== deal.scope) {
      state.scope = 'all';
      for (const t of tabs) t.setAttribute('aria-pressed', t.dataset.scope === 'all' ? 'true' : 'false');
    }
    state.q = '';
    search.value = '';
    await load();
    const card = document.getElementById(`deal-${deal.id}`);
    if (card && window.matchMedia('(max-width: 999px)').matches) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (err) {
    setMsg(formMsg, err.message);
  } finally {
    check.reset();
    btn.disabled = false;
  }
});

load();
