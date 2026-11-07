// Admin page: sign in, review queue, deals, articles, card posts,
// referral requests, the email list, and setup status.

import { api, el, formatDate, setMsg, timeAgo } from './site.js';

const loginView = document.getElementById('login-view');
const dash = document.getElementById('dash');
const panel = document.getElementById('panel');
const dashMsg = document.getElementById('dash-msg');
const logoutBtn = document.getElementById('logout');
const tabs = [...document.querySelectorAll('.admin-tabs .tab')];

let data = null;
let me = null;
let current = 'review';
let editing = null; // article being edited, or {} for new

// ---------- helpers ----------
async function act(type, id, action) {
  try {
    await api('/api/admin/action', { json: { type, id, action } });
    await refresh();
  } catch (err) {
    setMsg(dashMsg, err.message);
  }
}

function button(label, cls, onClick) {
  return el('button', { class: `btn btn-sm ${cls}`, type: 'button', onclick: onClick }, label);
}

// Deleting needs two clicks, so nothing disappears by accident.
function deleteButton(onConfirm, label = 'Delete') {
  const b = button(label, 'btn-outline-pink', () => {
    if (b.dataset.armed) return onConfirm();
    b.dataset.armed = '1';
    b.textContent = 'Click again to delete';
    setTimeout(() => {
      delete b.dataset.armed;
      b.textContent = label;
    }, 4000);
  });
  return b;
}

function section(title, items, emptyText) {
  return el(
    'section',
    { class: 'admin-section' },
    el('h2', {}, title),
    items.length ? items : el('p', { class: 'muted', style: 'margin:0' }, emptyText)
  );
}

function dl(pairs) {
  return el('dl', {}, pairs.filter(([, v]) => v).flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
}

// ---------- views ----------
const views = {
  review() {
    const posts = data.pendingPosts.map((p) =>
      el(
        'div',
        { class: 'admin-item' },
        el('span', { class: 'title' }, `${p.card_name} · ${p.issuer}`),
        el('span', { class: 'meta' }, `From ${p.guest_name} · ${timeAgo(p.created_at)} · contact: ${p.contact_email}`),
        dl([
          ['Annual fee', `${p.annual_fee}${p.fee_note ? ` (${p.fee_note})` : ''}`],
          ['Why', p.why],
          ['Benefits', p.perks],
        ]),
        el(
          'div',
          { class: 'admin-actions' },
          button('Approve', 'btn-gold', () => act('post', p.id, 'approve')),
          button('Reject', 'btn-outline-pink', () => act('post', p.id, 'reject'))
        )
      )
    );
    const photos = data.pendingPhotos.map((d) =>
      el(
        'div',
        { class: 'admin-item' },
        el('span', { class: 'title' }, d.item),
        el('span', { class: 'meta' }, `${d.store}${d.place ? ` · ${d.place}` : ''} · ${timeAgo(d.created_at)}`),
        el('img', { class: 'admin-photo', src: `/api/photos/${d.photo_key}`, alt: `Photo for ${d.item}`, loading: 'lazy' }),
        el(
          'div',
          { class: 'admin-actions' },
          button('Approve photo', 'btn-gold', () => act('photo', d.id, 'approve')),
          button('Reject photo', 'btn-outline-pink', () => act('photo', d.id, 'reject'))
        )
      )
    );
    const deals = data.flaggedDeals.map((d) =>
      el(
        'div',
        { class: 'admin-item flagged' },
        el('span', { class: 'title' }, `${d.item} · ${d.store}`),
        el('span', { class: 'meta' }, `${d.reports} report${d.reports === 1 ? '' : 's'} · ${d.hidden ? 'hidden from the site' : 'still visible'} · posted by ${d.who || 'A reader'} ${timeAgo(d.created_at)}`),
        el(
          'div',
          { class: 'admin-actions' },
          d.hidden ? null : button('Hide', 'btn-outline-gold', () => act('deal', d.id, 'hide')),
          button(d.hidden ? 'Restore' : 'Keep (clear reports)', 'btn-outline', () => act('deal', d.id, 'restore')),
          deleteButton(() => act('deal', d.id, 'delete'))
        )
      )
    );
    const comments = data.flaggedComments.map((c) =>
      el(
        'div',
        { class: 'admin-item flagged' },
        el('span', { class: 'meta' }, `On "${c.deal_item || 'deleted deal'}" · ${c.name || 'A reader'} · ${c.reports} report${c.reports === 1 ? '' : 's'} · ${c.hidden ? 'hidden' : 'visible'}`),
        el('p', {}, c.body),
        el(
          'div',
          { class: 'admin-actions' },
          c.hidden ? null : button('Hide', 'btn-outline-gold', () => act('comment', c.id, 'hide')),
          button(c.hidden ? 'Restore' : 'Keep (clear reports)', 'btn-outline', () => act('comment', c.id, 'restore')),
          deleteButton(() => act('comment', c.id, 'delete'))
        )
      )
    );
    return [
      section('Guest posts waiting', posts, 'No guest posts waiting.'),
      section('Photos waiting', photos, 'No photos waiting.'),
      section('Reported deals', deals, 'No reported deals.'),
      section('Reported comments', comments, 'No reported comments.'),
    ];
  },

  deals() {
    const items = data.recentDeals.map((d) =>
      el(
        'div',
        { class: `admin-item${d.hidden ? ' flagged' : ''}` },
        el('span', { class: 'title' }, `${d.deal_type} · ${d.item}`),
        d.details ? el('span', {}, d.details) : null,
        el(
          'span',
          { class: 'meta' },
          [
            d.scope === 'national' ? `${d.store} · national` : `${d.store} · ${d.place}`,
            `by ${d.who || 'A reader'}`,
            timeAgo(d.created_at),
            `still ${d.still} / gone ${d.gone}`,
            d.reports ? `${d.reports} reports` : null,
            d.photo_status ? `photo ${d.photo_status}` : null,
            d.hidden ? 'HIDDEN' : null,
          ]
            .filter(Boolean)
            .join(' · ')
        ),
        el(
          'div',
          { class: 'admin-actions' },
          el('a', { class: 'btn btn-sm btn-outline', href: `/deals#deal-${d.id}`, target: '_blank', rel: 'noopener' }, 'View'),
          d.hidden
            ? button('Restore', 'btn-outline', () => act('deal', d.id, 'restore'))
            : button('Hide', 'btn-outline-gold', () => act('deal', d.id, 'hide')),
          deleteButton(() => act('deal', d.id, 'delete'))
        )
      )
    );
    return [section('Latest 100 deals', items, 'No deals yet.')];
  },

  articles() {
    if (editing) return [articleEditor(editing)];
    const items = data.articles.map((a) =>
      el(
        'div',
        { class: 'admin-item' },
        el('span', { class: 'title' }, a.title),
        el(
          'span',
          { class: 'meta' },
          [a.category, `by ${a.author}`, a.published ? `published ${formatDate(a.published_at)}` : 'DRAFT', a.featured ? 'FEATURED' : null]
            .filter(Boolean)
            .join(' · ')
        ),
        el(
          'div',
          { class: 'admin-actions' },
          button('Edit', 'btn-gold', () => {
            editing = a;
            render();
          }),
          el('a', { class: 'btn btn-sm btn-outline', href: `/article?slug=${encodeURIComponent(a.slug)}`, target: '_blank', rel: 'noopener' }, a.published ? 'View' : 'Preview'),
          deleteButton(() => act('article', a.id, 'delete'))
        )
      )
    );
    return [
      el(
        'div',
        { style: 'margin-bottom:24px' },
        button('Write a new article', 'btn-pink', () => {
          editing = {};
          render();
        })
      ),
      section('Articles', items, 'No articles yet. Write the first one.'),
    ];
  },

  posts() {
    const items = data.approvedPosts.map((p) =>
      el(
        'div',
        { class: 'admin-item' },
        el('span', { class: 'title' }, `${p.card_name} · ${p.issuer}`),
        el('span', { class: 'meta' }, `By ${p.guest_name} · approved ${formatDate(p.approved_at)} · contact: ${p.contact_email}`),
        el('div', { class: 'admin-actions' }, deleteButton(() => act('post', p.id, 'delete'), 'Remove post'))
      )
    );
    return [section('Live card posts', items, 'No approved card posts yet.')];
  },

  requests() {
    const items = data.requests.map((r) =>
      el(
        'div',
        { class: 'admin-item' },
        el('span', { class: 'title' }, `${r.name} wants a referral for ${r.card_name || 'a removed post'}`),
        el('span', { class: 'meta' }, `${timeAgo(r.created_at)} · ${r.emailed ? 'emailed to the guest' : 'NOT emailed: forward it to the guest yourself'}`),
        dl([
          ['Requester email', r.email],
          ['Note', r.note],
          ['Guest', r.guest_name ? `${r.guest_name} (${r.contact_email})` : ''],
        ]),
        el('div', { class: 'admin-actions' }, deleteButton(() => act('request', r.id, 'delete')))
      )
    );
    const note = me.setup.email
      ? el('p', { class: 'muted', style: 'margin:0 0 20px' }, 'Requests are emailed to guests automatically. They are listed here for your records.')
      : el('p', { class: 'form-msg', style: 'margin:0 0 20px' }, 'Email is not set up, so requests are not sent to guests automatically. Forward each one to the guest yourself, or set up email (see Setup).');
    return [note, section('Referral requests', items, 'No referral requests yet.')];
  },

  email() {
    return [
      el(
        'section',
        { class: 'admin-section' },
        el('h2', {}, 'Weekly deals email list'),
        el('p', { style: 'margin:0;font-size:20px' }, `${data.subscriberCount} subscriber${data.subscriberCount === 1 ? '' : 's'}`),
        el('p', { class: 'muted', style: 'margin:0' }, 'Download the list and import it into your newsletter tool (for example Buttondown, Mailchimp or Kit). That tool handles sending and unsubscribes.'),
        el('div', {}, el('a', { class: 'btn btn-cyan', href: '/api/admin/subscribers' }, 'Download CSV'))
      ),
    ];
  },

  setup() {
    const s = me.setup;
    const line = (ok, label, how) =>
      el('li', {}, el('span', { class: ok ? 'yes' : 'no' }, ok ? 'Ready' : 'Missing'), el('span', {}, label, ok ? '' : el('span', { class: 'muted' }, ` ${how}`)));
    return [
      el(
        'section',
        { class: 'admin-section' },
        el('h2', {}, 'Setup checklist'),
        el(
          'ul',
          { class: 'setup-list' },
          line(s.database, 'Database (D1 binding "DB")', 'See README step 3.'),
          line(s.photos, 'Photo storage (R2 binding "PHOTOS")', 'See README step 4. Without it, photo uploads are turned off.'),
          line(s.spamCheck, 'Spam check (TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY)', 'See README step 5. Without it, forms are open to bots.'),
          line(s.contactEmail, 'Contact email (CONTACT_EMAIL)', 'Shown in the footer and used for new-post alerts.'),
          line(s.email, 'Email sending (RESEND_API_KEY and EMAIL_FROM)', 'Optional. Without it, referral requests are only listed here.')
        )
      ),
    ];
  },
};

function articleEditor(a) {
  const msg = el('p', { class: 'form-msg', role: 'status' });
  const cats = ['Deals 101', 'Store Intel', 'Card Strategy', 'Guest Column'];
  const form = el(
    'form',
    { class: 'editor', novalidate: true },
    el('h2', { style: 'margin:0;font-family:var(--cond);text-transform:uppercase;font-size:28px' }, a.id ? 'Edit article' : 'New article'),
    el('div', { class: 'field' }, el('label', { for: 'a-title' }, 'Title'), el('input', { id: 'a-title', name: 'title', type: 'text', maxlength: 160, required: true, value: a.title || '' })),
    el(
      'div',
      { class: 'row' },
      el(
        'div',
        { class: 'field' },
        el('label', { for: 'a-cat' }, 'Category'),
        el('select', { id: 'a-cat', name: 'category' }, cats.map((c) => el('option', { value: c, selected: (a.category || 'Deals 101') === c }, c)))
      ),
      el('div', { class: 'field' }, el('label', { for: 'a-author' }, 'Author'), el('input', { id: 'a-author', name: 'author', type: 'text', maxlength: 60, value: a.author || 'Jon Bon Bogo' }))
    ),
    el('div', { class: 'field' }, el('label', { for: 'a-excerpt' }, 'Short summary (shown on the Articles page)'), el('input', { id: 'a-excerpt', name: 'excerpt', type: 'text', maxlength: 300, value: a.excerpt || '' })),
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'a-body' }, 'Article'),
      el('textarea', { id: 'a-body', name: 'body', maxlength: 60000 }, a.body || ''),
      el('span', { class: 'hint' }, 'Leave a blank line between paragraphs. "## " starts a heading, "- " starts a bullet, **bold**, *italic*, [link text](https://example.com).')
    ),
    el(
      'div',
      { class: 'checks' },
      el('div', { class: 'check' }, el('input', { id: 'a-pub', name: 'published', type: 'checkbox', checked: Boolean(a.published) }), el('label', { for: 'a-pub' }, 'Published (visible to everyone)')),
      el('div', { class: 'check' }, el('input', { id: 'a-feat', name: 'featured', type: 'checkbox', checked: Boolean(a.featured) }), el('label', { for: 'a-feat' }, 'Featured at the top of the Articles page'))
    ),
    el(
      'div',
      { class: 'admin-actions' },
      el('button', { class: 'btn btn-pink', type: 'submit' }, 'Save'),
      button('Back to the list', 'btn-outline', () => {
        editing = null;
        render();
      })
    ),
    msg
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const { article } = await api('/api/admin/articles', {
        json: {
          id: a.id,
          title: form.title.value,
          category: form.category.value,
          author: form.author.value,
          excerpt: form.excerpt.value,
          body: form.body.value,
          published: form.published.checked,
          featured: form.featured.checked,
        },
      });
      editing = article;
      await refresh(false);
      setMsg(msg, article.published ? 'Saved and published.' : 'Saved as a draft.', true);
      const link = el('a', { href: `/article?slug=${encodeURIComponent(article.slug)}`, target: '_blank', rel: 'noopener', style: 'margin-left:8px' }, article.published ? 'View it' : 'Preview');
      msg.append(link);
    } catch (err) {
      setMsg(msg, err.message);
    } finally {
      btn.disabled = false;
    }
  });
  return form;
}

// ---------- rendering ----------
function render() {
  for (const t of tabs) t.setAttribute('aria-pressed', t.dataset.tab === current ? 'true' : 'false');
  const n = data.pendingPosts.length + data.pendingPhotos.length + data.flaggedDeals.filter((d) => d.hidden || d.reports).length + data.flaggedComments.length;
  const badge = document.getElementById('review-count');
  badge.hidden = n === 0;
  badge.textContent = String(n);
  panel.replaceChildren(...views[current]());
}

async function refresh(rerender = true) {
  setMsg(dashMsg, '');
  data = await api('/api/admin/overview');
  if (rerender) render();
}

for (const t of tabs) {
  t.addEventListener('click', () => {
    current = t.dataset.tab;
    if (current !== 'articles') editing = null;
    render();
  });
}

document.getElementById('refresh').addEventListener('click', () => refresh().catch((err) => setMsg(dashMsg, err.message)));

logoutBtn.addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = loginForm.querySelector('.form-msg');
  try {
    await api('/api/admin/login', { json: { password: loginForm.password.value } });
    loginForm.reset();
    await start();
  } catch (err) {
    setMsg(msg, err.message);
  }
});

async function start() {
  me = await api('/api/admin/me');
  if (!me.admin) {
    loginView.hidden = false;
    dash.hidden = true;
    logoutBtn.hidden = true;
    if (!me.passwordSet) {
      setMsg(loginForm.querySelector('.form-msg'), 'Admin sign-in is not set up yet. Add the ADMIN_PASSWORD setting in Cloudflare (README step 6).');
    }
    loginForm.password.focus();
    return;
  }
  loginView.hidden = true;
  dash.hidden = false;
  logoutBtn.hidden = false;
  await refresh();
}

start().catch((err) => {
  loginView.hidden = false;
  setMsg(loginForm.querySelector('.form-msg'), err.message);
});
