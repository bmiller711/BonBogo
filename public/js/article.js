// Single article page: /article?slug=...

import { api, el, formatDate, renderArticle } from './site.js';

const box = document.getElementById('article');
const slug = new URLSearchParams(location.search).get('slug');

function notFound() {
  box.replaceChildren(
    el('h1', { class: 'page-title' }, 'Article not found'),
    el('p', { class: 'lead', style: 'margin-top:16px' }, el('a', { href: '/articles' }, 'See all articles'))
  );
}

if (!slug) {
  notFound();
} else {
  api(`/api/articles/${encodeURIComponent(slug)}`)
    .then(({ article: a }) => {
      document.title = `${a.title} | Jon Bon Bogo the Bogo Guy`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc && a.excerpt) desc.setAttribute('content', a.excerpt);
      const who = a.category === 'Guest Column' ? `Guest column by ${a.author}` : `By ${a.author}`;
      box.replaceChildren(
        el('a', { href: '/articles', class: 'more-link', style: 'display:inline-block;margin-bottom:12px' }, '← All articles'),
        el('div', { style: 'margin-bottom:16px' }, el('span', { class: 'chip chip-cyan' }, a.category)),
        el('h1', { class: 'page-title', style: 'font-size:clamp(40px,7vw,80px);max-width:900px' }, a.title),
        el('p', { class: 'byline', style: 'margin:18px 0 32px;font-size:17px' }, `${who}${a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ' · Draft preview'}`),
        el('div', { class: 'prose' }, renderArticle(a.body))
      );
    })
    .catch(notFound);
}
