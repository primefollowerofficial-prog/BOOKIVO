'use strict';
/* ============================================
   BOOKIVO.IN — Catalogue grid renderer
   Used by index.html (Featured) and books.html (All Books).
   Rules honoured:
   - Skeleton cards ONLY while a live request is in flight.
   - Unfilled slots are hidden (never fake books, never endless spinners).
   - Max 12 initial slots; data model extensible beyond that.
   ============================================ */

const BookivoCatalogue = (() => {
  const MAX_SLOTS = 12;

  function skeletonHtml(n) {
    let out = '';
    for (let i = 0; i < n; i++) {
      out += `<div class="bk-skeleton" aria-hidden="true">
        <div class="bk-sk bk-sk--cover"></div>
        <div class="bk-sk bk-sk--line"></div>
        <div class="bk-sk bk-sk--line w60"></div>
        <div class="bk-sk bk-sk--price"></div>
      </div>`;
    }
    return out;
  }

  function starsFor(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.round(r);
    return '★★★★★'.slice(0, full) + '<span style="opacity:.3">' + '★★★★★'.slice(full) + '</span>';
  }

  function cardHtml(book) {
    const S = window.BookivoSite;
    const { selling, original } = S.priceOf(book);
    const pct = S.discountPct(book);
    const cover = book.coverImage || (book.gallery && book.gallery[0]) || 'images/Ebook1.png';
    const href = S.bookUrl(book);
    const rating = (Number(book.rating) > 0 && Number(book.reviewCount) > 0)
      ? `<div class="bk-card-rating"><span class="stars">${starsFor(book.rating)}</span><span>${Number(book.rating).toFixed(1)} · ${Number(book.reviewCount)} reviews</span></div>`
      : '';
    return `<article class="bk-card" data-reveal>
      <a class="bk-card-cover" href="${S.esc(href)}" aria-label="View details: ${S.esc(book.title)}">
        <img src="${S.esc(cover)}" alt="Cover of ${S.esc(book.title)}" loading="lazy">
        ${pct ? `<span class="bk-card-badge">${pct}% OFF</span>` : ''}
      </a>
      <h3 class="bk-card-title"><a href="${S.esc(href)}">${S.esc(book.title)}</a></h3>
      ${book.author ? `<p class="bk-card-author">by ${S.esc(book.author)}</p>` : ''}
      ${rating}
      <div class="bk-card-price price-row">
        ${original ? `<span class="price-old">${S.inr(original)}</span>` : ''}
        <span class="price-new">${S.inr(selling)}</span>
      </div>
      <div class="bk-card-actions">
        <a class="btn btn-outline" href="${S.esc(href)}">Details</a>
        <button type="button" class="btn btn-primary" data-add-to-cart="${S.esc(book.id)}">Add to Cart</button>
      </div>
    </article>`;
  }

  // Render into a container. `opts.skeleton` = how many shimmer cards while loading.
  async function render(containerId, books, opts) {
    opts = opts || {};
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = skeletonHtml(opts.skeleton != null ? opts.skeleton : 8);
    try {
      let list = books;
      if (!list) list = await BookivoSite.getCatalogue();
      list = (list || []).filter(b => b.published !== false).slice(0, MAX_SLOTS);
      if (!list.length) {
        el.innerHTML = `<div class="bk-empty-state" style="grid-column:1/-1">
          <h3>More books are on the way</h3>
          <p>New ebooks are published through our admin panel. Check back soon.</p></div>`;
        return;
      }
      el.innerHTML = list.map(cardHtml).join('');
      bindAddButtons(el);
      if (window.initScrollReveals) window.initScrollReveals(el);
    } catch (e) {
      el.innerHTML = `<div class="bk-empty-state" style="grid-column:1/-1">
        <h3>Catalogue unavailable</h3><p>We couldn't load the catalogue. Please refresh to try again.</p></div>`;
    }
  }

  function bindAddButtons(scope) {
    scope.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-add-to-cart');
        CartStore.addItem(id, 1);
        if (window.showToast) showToast('Added to cart', 'success');
        btn.textContent = 'Added ✓';
        setTimeout(() => { btn.textContent = 'Add to Cart'; }, 1400);
      });
    });
  }

  return { render, cardHtml, bindAddButtons, MAX_SLOTS };
})();

window.BookivoCatalogue = BookivoCatalogue;
