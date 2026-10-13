'use strict';
/* ============================================
   bookpage.js — All Books listing (books.html)
   Real filtering/sorting over the live catalogue. Reads URL params:
   ?q= (from header search), ?sort=featured|newest, ?deals=1
   ============================================ */

const BookPage = (() => {
  let allBooks = [];
  const els = {};

  function currentFilters() {
    return {
      q: els.search.value.trim().toLowerCase(),
      category: els.category.value,
      sort: els.sort.value,
      deals: els.deals.getAttribute('aria-pressed') === 'true'
    };
  }

  function applyFilters() {
    const f = currentFilters();
    let list = allBooks.filter(b => {
      if (f.category && b.category !== f.category) return false;
      if (f.deals && BookivoSite.discountPct(b) < 25) return false;
      if (f.q && !BookivoSite.searchableText(b).includes(f.q)) return false;
      return true;
    });

    const price = b => BookivoSite.priceOf(b).selling;
    switch (f.sort) {
      case 'price-asc': list.sort((a, b) => price(a) - price(b)); break;
      case 'price-desc': list.sort((a, b) => price(b) - price(a)); break;
      case 'rating': list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)); break;
      case 'newest': list.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0)); break;
      default: list.sort((a, b) => (b.featured === true) - (a.featured === true));
    }

    const grid = document.getElementById('bkAllBooksGrid');
    if (!list.length) {
      grid.innerHTML = `<div class="bk-empty-state" style="grid-column:1/-1">
        <h3>No books match those filters</h3>
        <p>Try clearing the search or picking another category. New titles are published regularly.</p></div>`;
      return;
    }
    grid.innerHTML = list.map(BookivoCatalogue.cardHtml).join('');
    BookivoCatalogue.bindAddButtons(grid);
  }

  function initFromUrl() {
    const p = new URLSearchParams(location.search);
    if (p.get('q')) els.search.value = p.get('q');
    if (p.get('sort') === 'newest') els.sort.value = 'newest';
    if (p.get('sort') === 'featured') els.sort.value = 'featured';
    if (p.get('deals') === '1') els.deals.setAttribute('aria-pressed', 'true');
  }

  async function init() {
    els.search = document.getElementById('bkFilterSearch');
    els.category = document.getElementById('bkCategorySelect');
    els.sort = document.getElementById('bkSortSelect');
    els.deals = document.getElementById('bkDealsChip');
    if (!els.search) return;

    initFromUrl();

    // Skeletons while loading, then real cards only.
    const grid = document.getElementById('bkAllBooksGrid');
    grid.innerHTML = Array.from({ length: 8 }, () =>
      '<div class="bk-skeleton" aria-hidden="true"><div class="bk-sk bk-sk--cover"></div><div class="bk-sk bk-sk--line"></div><div class="bk-sk bk-sk--line w60"></div><div class="bk-sk bk-sk--price"></div></div>').join('');

    allBooks = await BookivoSite.getCatalogue();

    // Populate categories from actual data (never invented).
    const cats = [...new Set(allBooks.map(b => b.category).filter(Boolean))].sort();
    els.category.innerHTML = '<option value="">All categories</option>' +
      cats.map(c => `<option value="${BookivoSite.esc(c)}">${BookivoSite.esc(c)}</option>`).join('');

    [els.search, els.category, els.sort].forEach(el => el.addEventListener('input', applyFilters));
    els.deals.addEventListener('click', () => {
      const on = els.deals.getAttribute('aria-pressed') === 'true';
      els.deals.setAttribute('aria-pressed', String(!on));
      els.deals.classList.toggle('is-active', !on);
      applyFilters();
    });
    if (els.deals.getAttribute('aria-pressed') === 'true') els.deals.classList.add('is-active');

    applyFilters();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { init };
})();
