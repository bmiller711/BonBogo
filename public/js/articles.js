// Articles page: featured article plus the rest.

import { api, el, formatDate } from './site.js';

const featuredBox = document.getElementById('featured');
const moreSection = document.getElementById('more-section');
const grid = document.getElementById('article-grid');

const CATEGORY_CHIP = { 'Deals 101': 'chip-gold', 'Store Intel': 'chip-cyan', 'Card Strategy': 'chip-pink', 'Guest Column': 'chip-gold' };

function byline(a) {
  const who = a.category === 'Guest Column' ? `Guest column by ${a.author}` : `By ${a.author}`;
  return `${who} · ${formatDate(a.publishedAt)}`;
}

function featured(a) {
  return el(
    'a',
    { class: 'featured', href: `/article?slug=${encodeURIComponent(a.slug)}` },
    el('div', { class: 'featured-art', 'aria-hidden': 'true' }, el('span', {}, '1 + 1 = ?')),
    el(
      'div',
      { class: 'featured-body' },
      el('div', {}, el('span', { class: 'chip chip-gold' }, `Featured · ${a.category}`)),
      el('h2', {}, a.title),
      a.excerpt ? el('p', {}, a.excerpt) : null,
      el('span', { class: 'byline' }, byline(a)),
      el('span', { class: 'go cond', style: 'color:var(--cyan);letter-spacing:0.1em' }, 'Read the article →')
    )
  );
}

function card(a) {
  return el(
    'a',
    { class: 'article-card', href: `/article?slug=${encodeURIComponent(a.slug)}` },
    el('div', {}, el('span', { class: `chip ${CATEGORY_CHIP[a.category] || 'chip-cyan'}` }, a.category)),
    el('h3', {}, a.title),
    a.excerpt ? el('p', {}, a.excerpt) : null,
    el('span', { class: 'byline' }, byline(a))
  );
}

api('/api/articles')
  .then(({ articles }) => {
    if (!articles.length) {
      featuredBox.replaceChildren(el('p', { class: 'empty' }, 'The first articles are on the way. Check back soon.'));
      return;
    }
    const top = articles.find((a) => a.featured) || articles[0];
    featuredBox.replaceChildren(featured(top));
    const rest = articles.filter((a) => a !== top);
    if (rest.length) {
      grid.replaceChildren(...rest.map(card));
      moreSection.hidden = false;
    }
  })
  .catch((err) => featuredBox.replaceChildren(el('p', { class: 'empty' }, err.message)));
