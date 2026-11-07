// Home page: the three newest deals.

import { api, el, timeAgo } from './site.js';

const box = document.getElementById('latest-deals');

function row(d) {
  const gold = d.dealType === 'BOGO' || d.dealType === 'BUY X GET Y';
  const where = d.scope === 'national' ? `${d.store} · Online and in stores` : d.place ? `${d.store} · ${d.place}` : d.store;
  return el(
    'a',
    { class: 'mini-deal', href: `/deals#deal-${d.id}` },
    el('span', { class: `badge${gold ? ' badge-gold' : ''}` }, d.dealType === 'BUY X GET Y' ? 'FREE' : d.dealType),
    el(
      'span',
      { class: 'deal-title' },
      el('span', { class: 'deal-item' }, d.item),
      d.details ? el('span', { class: 'deal-where', style: 'color:var(--gold)' }, d.details) : null,
      el('span', { class: 'deal-where' }, where)
    ),
    el('span', { class: 'who' }, `spotted by ${d.who}`, el('span', { class: 'sr-only' }, `, ${timeAgo(d.createdAt)}`))
  );
}

api('/api/deals?limit=3')
  .then(({ deals }) => {
    if (!deals.length) {
      box.replaceChildren(
        el('p', { class: 'empty' }, 'No deals posted yet. ', el('a', { href: '/deals' }, 'Be the first to add one.'))
      );
      return;
    }
    box.replaceChildren(...deals.map(row));
  })
  .catch(() => {
    box.replaceChildren(el('p', { class: 'empty' }, el('a', { href: '/deals' }, 'See the Deal Tracker')));
  });
