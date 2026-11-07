// Card Offers page: approved guest posts, referral requests, and the guest post form.

import { api, el, setMsg, spamCheck } from './site.js';

const box = document.getElementById('posts');

function referralBox(p) {
  const wrap = el('div', { class: 'referral' });
  const btn = el('button', { class: 'btn btn-gold', type: 'button', 'aria-expanded': 'false' }, 'Request a referral');
  wrap.append(
    el(
      'div',
      { class: 'stack' },
      el('span', { class: 'label' }, 'Referral · this guest may earn rewards'),
      el('span', { style: 'font-size:19px;line-height:1.5;color:var(--body)' }, `Want to apply through a referral? Ask ${p.guestName}. They decide who gets their link.`)
    ),
    btn
  );

  let form = null;
  btn.addEventListener('click', async () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Cancel' : 'Request a referral';
    if (!open) {
      if (form) form.hidden = true;
      return;
    }
    if (form) {
      form.hidden = false;
      return;
    }
    const id = (s) => `rq-${s}-${p.id}`;
    const msg = el('p', { class: 'form-msg', role: 'status' });
    const slot = el('div', { class: 'turnstile-slot' });
    form = el(
      'form',
      { novalidate: true },
      el(
        'div',
        { class: 'row' },
        el('div', { class: 'field' }, el('label', { for: id('name') }, 'Your name'), el('input', { id: id('name'), name: 'name', type: 'text', maxlength: 60, required: true, autocomplete: 'name' })),
        el('div', { class: 'field' }, el('label', { for: id('email') }, 'Your email'), el('input', { id: id('email'), name: 'email', type: 'email', maxlength: 200, required: true, autocomplete: 'email' }))
      ),
      el('div', { class: 'field' }, el('label', { for: id('note') }, 'A short note (optional)'), el('textarea', { id: id('note'), name: 'note', rows: 3, maxlength: 600 })),
      slot,
      el(
        'div',
        { class: 'deal-actions' },
        el('button', { class: 'btn btn-pink', type: 'submit' }, 'Send request'),
        el('span', { class: 'muted small', style: 'flex:1 1 260px' }, 'Your name, email and note go only to this guest so they can reply. They choose whether to share a link.')
      ),
      msg
    );
    wrap.append(form);
    const check = await spamCheck(slot);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sendBtn = form.querySelector('button[type=submit]');
      sendBtn.disabled = true;
      try {
        await api(`/api/posts/${p.id}/request`, {
          json: { name: form.name.value.trim(), email: form.email.value.trim(), note: form.note.value.trim(), token: check.token() },
        });
        form.remove();
        btn.remove();
        wrap.append(el('p', { class: 'sent', role: 'status' }, `Request sent. ${p.guestName} will reply to you by email if they decide to share a link.`));
      } catch (err) {
        setMsg(msg, err.message);
        check.reset();
        sendBtn.disabled = false;
      }
    });
  });
  return wrap;
}

function post(p) {
  return el(
    'article',
    { class: 'post' },
    el(
      'div',
      { class: 'post-side' },
      el('span', { class: 'eyebrow', style: 'font-size:15px;letter-spacing:0.25em' }, 'Guest'),
      el('span', { class: 'post-guest' }, p.guestName),
      el('div', { class: 'post-rule' }),
      el('h2', { class: 'post-card', style: 'margin:0' }, p.cardName),
      el('span', { style: 'font-size:17px;color:var(--soft)' }, p.issuer)
    ),
    el(
      'div',
      { class: 'post-main' },
      el('div', {}, el('h3', {}, 'Why I chose it'), el('p', {}, p.why)),
      p.perks.length ? el('div', {}, el('h3', {}, 'What I get out of it'), el('ul', {}, p.perks.map((t) => el('li', {}, t)))) : null,
      el('div', {}, el('h3', {}, 'Annual fee'), el('p', {}, el('span', { class: 'fee' }, p.annualFee), p.feeNote ? ` ${p.feeNote}` : '')),
      referralBox(p)
    )
  );
}

api('/api/posts')
  .then(({ posts }) => {
    if (!posts.length) {
      box.replaceChildren(el('p', { class: 'empty' }, 'No guest posts yet. ', el('a', { href: '#share' }, 'Be the first to share your card.')));
      return;
    }
    box.replaceChildren(...posts.map(post));
  })
  .catch((err) => box.replaceChildren(el('p', { class: 'empty' }, err.message)));

// ---------- guest post form ----------
const form = document.getElementById('post-form');
const msg = form.querySelector('.form-msg');
let check = { token: () => '', reset: () => {} };
spamCheck(document.getElementById('post-ts')).then((c) => (check = c));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = (n) => form[n].value.trim();
  if (!v('guestName') || !v('cardName') || !v('issuer') || !v('annualFee') || !v('why') || !v('contactEmail')) {
    return setMsg(msg, 'Please fill in your name, the card, the issuer, the annual fee, why you chose it, and your email.');
  }
  if (!form.agree.checked) return setMsg(msg, 'Please tick the box about referral rewards.');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await api('/api/posts', {
      json: {
        guestName: v('guestName'),
        cardName: v('cardName'),
        issuer: v('issuer'),
        annualFee: v('annualFee'),
        feeNote: v('feeNote'),
        why: v('why'),
        perks: v('perks'),
        contactEmail: v('contactEmail'),
        agree: true,
        token: check.token(),
      },
    });
    form.reset();
    setMsg(msg, 'Thanks! Jon will review your post before it goes up.', true);
  } catch (err) {
    setMsg(msg, err.message);
  } finally {
    check.reset();
    btn.disabled = false;
  }
});
