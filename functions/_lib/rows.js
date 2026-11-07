// Turn database rows into the shapes the pages use. Private fields
// (visitor fingerprints, guest contact emails) are never included here.

export function dealRow(row) {
  return {
    id: row.id,
    item: row.item,
    dealType: row.deal_type,
    details: row.details || '',
    store: row.store,
    place: row.place,
    scope: row.scope,
    who: row.who || 'A reader',
    goodThrough: row.good_through || null,
    photoUrl: row.photo_key && row.photo_status === 'approved' ? `/api/photos/${row.photo_key}` : null,
    photoPending: Boolean(row.photo_key && row.photo_status === 'pending'),
    still: row.still,
    gone: row.gone,
    comments: row.comment_count ?? 0,
    createdAt: row.created_at,
  };
}

export function commentRow(row) {
  return {
    id: row.id,
    name: row.name || 'A reader',
    body: row.body,
    createdAt: row.created_at,
  };
}

export function postRow(row) {
  return {
    id: row.id,
    guestName: row.guest_name,
    cardName: row.card_name,
    issuer: row.issuer,
    annualFee: row.annual_fee,
    feeNote: row.fee_note,
    why: row.why,
    perks: row.perks ? row.perks.split('\n').map((s) => s.trim()).filter(Boolean) : [],
    approvedAt: row.approved_at || row.created_at,
  };
}

export function articleSummary(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    author: row.author,
    excerpt: row.excerpt,
    featured: Boolean(row.featured),
    publishedAt: row.published_at,
  };
}

export function articleFull(row) {
  return { ...articleSummary(row), body: row.body };
}
