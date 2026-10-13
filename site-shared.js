'use strict';
/* ============================================
   BOOKIVO.IN — Site Shell (shared across all pages)
   Loads AFTER config.js and cart-shared.js.

   Responsibilities:
   - Inject the Amazon-style two-row header + promo bar + mobile menu
     so every page shares one authoritative header implementation.
   - Admin-controlled promotional announcement (text, image popup,
     schedule/expiry evaluated against real timestamps).
   - Live catalogue search with suggestions (title/author/category/keywords).
   - Cart badge wiring, auth-menu placeholder hooks, active nav state.
   - Footer injection.
   Everything degrades gracefully if the backend is unreachable
   (falls back to the local catalogue snapshot in data.js).
   ============================================ */

const BookivoSite = (() => {
  const PROMO_CACHE_KEY = 'bookivo_promo_cache_v1';
  const DEFAULT_PROMO_TEXT = '🔥 DISCOVER QUALITY EBOOKS THAT INSPIRE LEARNING AND GROWTH';

  /* ---------- tiny helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function fetchJSON(url, opts, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    try {
      const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function apiBase() {
    return (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '';
  }

  /* ---------- catalogue access ---------- */
  function localCatalogue() {
    return (typeof BOOKIVO_CATALOGUE !== 'undefined') ? BOOKIVO_CATALOGUE : [];
  }

  // Try backend first, cache result, fall back to cached/local snapshot.
  let cataloguePromise = null;
  function getCatalogue() {
    if (cataloguePromise) return cataloguePromise;
    cataloguePromise = (async () => {
      let books = localCatalogue().filter(b => b.published);
      try {
        if (apiBase()) {
          const data = await fetchJSON(`${apiBase()}/api/products`);
          const list = Array.isArray(data) ? data : (data && Array.isArray(data.products) ? data.products : null);
          if (list && list.length) books = list.filter(p => p.published !== false);
        }
      } catch (e) { /* offline / not yet migrated — use local snapshot */ }
      try {
        localStorage.setItem('bookivo_catalogue_cache_v1', JSON.stringify({ at: Date.now(), books }));
      } catch (e) { /* storage full/blocked */ }
      return books;
    })();
    return cataloguePromise;
  }

  function priceOf(book) {
    const sp = Number(book.sellingPrice != null ? book.sellingPrice : book.price) || 0;
    const op = Number(book.originalPrice) || 0;
    return { selling: sp, original: op > sp ? op : 0 };
  }

  function inr(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  function discountPct(book) {
    const { selling, original } = priceOf(book);
    if (original > selling && selling > 0) return Math.round(((original - selling) / original) * 100);
    return 0;
  }

  function bookUrl(book) {
    if (book.url) return book.url;
    return 'book.html?slug=' + encodeURIComponent(book.slug || '');
  }

  function searchableText(book) {
    return [book.title, book.subtitle, book.author, book.category,
      (book.keywords || []).join(' '), book.shortDescription, book.description]
      .filter(Boolean).join(' ').toLowerCase();
  }

  /* ---------- icons ---------- */
  const ICONS = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    user: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="3.4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>',
    cart: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    chevDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ============================================================
     PROMO BAR + POPUP MODAL
     ============================================================ */
  let promoState = null; // resolved promotion record

  function cachedPromo() {
    try { return JSON.parse(localStorage.getItem(PROMO_CACHE_KEY) || 'null'); }
    catch (e) { return null; }
  }

  // Evaluate using real wall-clock timestamps (Date.now), never only browser flags.
  function promoStatus(p, now) {
    now = now || Date.now();
    if (!p || !p.enabled || !p.text) return 'disabled';
    if (p.startAt && now < new Date(p.startAt).getTime()) return 'scheduled';
    if (p.expireAt && now >= new Date(p.expireAt).getTime()) return 'expired';
    return 'active';
  }

  async function loadPromotion() {
    let rec = null;
    try {
      if (apiBase()) {
        const data = await fetchJSON(`${apiBase()}/api/promotion`);
        if (data && (data.text || data.announcement)) rec = normalizePromo(data);
        if (rec) localStorage.setItem(PROMO_CACHE_KEY, JSON.stringify({ at: Date.now(), rec }));
      }
    } catch (e) {
      const c = cachedPromo();
      if (c && c.rec) rec = c.rec;
    }
    promoState = rec;
    renderPromoBar();
  }

  function normalizePromo(d) {
    return {
      text: String(d.text || d.announcement || '').trim(),
      enabled: d.enabled !== false,
      startAt: d.startAt || d.start_at || null,
      expireAt: d.expireAt || d.expire_at || d.expiresAt || null,
      imageUrl: d.imageUrl || d.image_url || d.image || null,
      imageEnabled: (d.imageEnabled !== false) && !!d.imageUrl === true ? true : (d.imageEnabled !== false && !!(d.imageUrl || d.image_url || d.image)),
      popupEnabled: d.popupEnabled !== false && (d.imageEnabled !== false)
    };
  }

  function renderPromoBar() {
    const bar = document.getElementById('promoBar');
    if (!bar) return;
    const status = promoStatus(promoState);
    const active = status === 'active';
    const text = active ? promoState.text : DEFAULT_PROMO_TEXT;
    const canOpenImage = active && promoState.popupEnabled && promoState.imageUrl;

    bar.classList.toggle('promo-bar--custom', active);
    bar.classList.toggle('promo-bar--clickable', canOpenImage);
    bar.setAttribute('role', canOpenImage ? 'button' : 'status');
    if (canOpenImage) {
      bar.setAttribute('tabindex', '0');
      bar.setAttribute('aria-haspopup', 'dialog');
      bar.setAttribute('aria-label', 'View today\'s offer');
    } else {
      bar.removeAttribute('tabindex');
      bar.removeAttribute('aria-haspopup');
    }
    const p = bar.querySelector('p');
    if (p) p.textContent = text.toUpperCase();
    bar.dataset.status = status;
  }

  // Re-evaluate expiry periodically so a mid-session expiry hides the custom promo.
  function startPromoWatch() {
    setInterval(() => {
      const prev = promoState ? promoState._status : 'none';
      const st = promoStatus(promoState);
      if (st !== prev && promoState) { promoState._status = st; renderPromoBar(); }
    }, 30000);
  }

  function openPromoModal() {
    if (!promoState || promoStatus(promoState) !== 'active') return; // expired promo must never open
    if (!promoState.popupEnabled || !promoState.imageUrl) return;    // no broken/empty modal
    let modal = document.getElementById('promoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'promoModal';
      modal.className = 'promo-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Today\'s promotion');
      modal.innerHTML = `
        <div class="promo-modal-backdrop" id="promoModalBackdrop"></div>
        <div class="promo-modal-card">
          <button type="button" class="promo-modal-close" id="promoModalClose" aria-label="Close promotion">&#10005;</button>
          <img id="promoModalImg" src="" alt="Today's promotion at Bookivo">
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#promoModalClose').addEventListener('click', closePromoModal);
      modal.querySelector('#promoModalBackdrop').addEventListener('click', closePromoModal);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePromoModal(); });
    }
    const img = modal.querySelector('#promoModalImg');
    img.src = promoState.imageUrl;
    img.alt = (promoState.text || 'Today\'s promotion') + ' — Bookivo';
    modal.lastTrigger = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('#promoModalClose').focus(), 60);
  }

  function closePromoModal() {
    const modal = document.getElementById('promoModal');
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (modal.lastTrigger && modal.lastTrigger.focus) modal.lastTrigger.focus();
  }

  /* ============================================================
     HEADER MARKUP (two rows, Amazon-inspired layout)
     ============================================================ */
  function headerMarkup(activeKey) {
    const link = (key, href, label) =>
      `<a class="bk-nav-link${activeKey === key ? ' is-active' : ''}" href="${href}">${label}</a>`;
    return `
<div class="promo-bar" id="promoBar">
  <div class="promo-shine" aria-hidden="true"></div>
  <p>${esc(DEFAULT_PROMO_TEXT)}</p>
</div>

<header class="bk-header" id="bkHeader">
  <div class="bk-header-main">
    <a class="bk-logo" href="index.html" aria-label="Bookivo home">
      <span class="bk-logo-book">BOOK</span><span class="bk-logo-accent">IVO</span><span class="bk-logo-tld">.IN</span>
    </a>

    <div class="bk-search" role="search">
      <form class="bk-search-form" id="bkSearchForm" autocomplete="off">
        <input type="text" id="bkSearchInput" class="bk-search-input" placeholder="Search ebooks, categories, authors…"
               aria-label="Search Bookivo catalogue" role="combobox" aria-expanded="false" aria-controls="bkSearchSuggest">
        <button type="submit" class="bk-search-btn" aria-label="Search">${ICONS.search}</button>
      </form>
      <div class="bk-search-suggest" id="bkSearchSuggest" hidden role="listbox" aria-label="Search suggestions"></div>
    </div>

    <div class="bk-actions">
      <div class="bk-account" id="bkAccount">
        <button type="button" class="bk-action-btn" id="bkAccountBtn" aria-haspopup="true" aria-expanded="false">
          ${ICONS.user}<span class="bk-action-label">Sign in</span>
        </button>
        <div class="bk-account-menu" id="bkAccountMenu" hidden>
          <p class="bk-account-hint">Sign in to track orders and access your library.</p>
          <a class="bk-account-item" href="auth.html?mode=signin">Sign in</a>
          <a class="bk-account-item" href="auth.html?mode=signup">Create account</a>
        </div>
      </div>
      <a class="bk-action-btn bk-cart-btn" href="cart.html" aria-label="Cart">
        ${ICONS.cart}<span class="cart-badge" id="cartBadge" hidden>0</span>
      </a>
      <button type="button" class="hamburger" id="hamburger" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>

  <nav class="bk-subnav" aria-label="Store sections">
    <div class="bk-subnav-inner">
      ${link('home', 'index.html', 'Home')}
      ${link('books', 'books.html', 'All Books')}
      ${link('categories', 'books.html', 'Categories')}
      ${link('bestsellers', 'books.html?sort=featured', 'Bestsellers')}
      ${link('new', 'books.html?sort=newest', 'New Releases')}
      ${link('offers', 'books.html?deals=1', 'Deals')}
      ${link('help', 'index.html#contact', 'Contact &amp; Help')}
    </div>
  </nav>

  <div class="mobile-menu" id="mobileMenu">
    <a href="index.html">Home</a>
    <a href="books.html">All Books</a>
    <a href="books.html?sort=newest">New Releases</a>
    <a href="cart.html">Cart</a>
    <a href="auth.html?mode=signin">Sign in</a>
    <a href="index.html#contact">Contact &amp; Help</a>
  </div>
</header>`;
  }

  function footerMarkup() {
    return `
<footer class="bk-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <p class="footer-logo">BOOK<span class="logo-accent">IVO</span><span class="bk-logo-tld">.IN</span></p>
      <p>Quality ebooks that inspire learning and growth — practical knowledge at honest prices.</p>
    </div>
    <nav class="footer-nav" aria-label="Footer">
      <a href="index.html">Home</a>
      <a href="books.html">All Books</a>
      <a href="books.html?deals=1">Deals</a>
      <a href="cart.html">Cart</a>
      <a href="index.html#contact">Contact</a>
    </nav>
    <div class="footer-social" aria-hidden="true">
      <span class="social-dot"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></span>
      <span class="social-dot"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg></span>
      <span class="social-dot"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© 2026 Bookivo (bookivo.in). All rights reserved.</p>
    <p class="footer-note">Digital products only — no physical item will be shipped.</p>
  </div>
</footer>`;
  }

  /* ============================================================
     SEARCH BEHAVIOUR
     ============================================================ */
  function initSearch() {
    const form = document.getElementById('bkSearchForm');
    const input = document.getElementById('bkSearchInput');
    const suggestBox = document.getElementById('bkSearchSuggest');
    if (!form || !input || !suggestBox) return;

    let debounce = null;

    function closeSuggest() {
      suggestBox.hidden = true;
      suggestBox.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
    }

    function suggestionHtml(books, q) {
      if (!books.length) {
        return `<div class="bk-suggest-empty">No matches for “${esc(q)}”. Try “cookbook”, “recipes” or browse All Books.</div>`;
      }
      return books.slice(0, 6).map(b => {
        const { selling, original } = priceOf(b);
        return `<a class="bk-suggest-item" role="option" href="${esc(bookUrl(b))}">
          <img src="${esc(b.coverImage || (b.gallery && b.gallery[0]) || 'images/Ebook1.png')}" alt="">
          <span class="bk-suggest-meta">
            <strong>${esc(b.title)}</strong>
            <small>${esc(b.category || 'Ebook')}${b.author ? ' · ' + esc(b.author) : ''}</small>
          </span>
          <span class="bk-suggest-price">${inr(selling)}${original ? ` <s>${inr(original)}</s>` : ''}</span>
        </a>`;
      }).join('') +
      `<a class="bk-suggest-all" href="books.html?q=${encodeURIComponent(q)}">See all results for “${esc(q)}” →</a>`;
    }

    async function showSuggestions() {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { closeSuggest(); return; }
      const books = await getCatalogue();
      const matches = books.filter(b => searchableText(b).includes(q));
      suggestBox.innerHTML = suggestionHtml(matches, q);
      suggestBox.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(showSuggestions, 180);
    });
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) showSuggestions(); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.bk-search')) closeSuggest();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      window.location.href = 'books.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSuggest(); });
  }

  /* ============================================================
     ACCOUNT MENU (signed-out UI now; Supabase session hooks later)
     Hook: BookivoAuth.getSession() will be checked when present.
     ============================================================ */
  function initAccountMenu() {
    const wrap = document.getElementById('bkAccount');
    if (!wrap) return;
    const btn = wrap.querySelector('#bkAccountBtn');
    const menu = wrap.querySelector('#bkAccountMenu');

    // If a future BookivoAuth module exists, reflect signed-in state.
    try {
      if (window.BookivoAuth && typeof window.BookivoAuth.renderAccount === 'function') {
        window.BookivoAuth.renderAccount(wrap, btn, menu);
      }
    } catch (e) { /* non-blocking */ }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#bkAccount')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ============================================================
     MOUNT
     ============================================================ */
  function mount(activeKey) {
    const shell = document.getElementById('siteHeader');
    if (shell) shell.innerHTML = headerMarkup(activeKey);

    const foot = document.getElementById('siteFooter');
    if (foot) foot.innerHTML = footerMarkup();

    // Promo bar interactions
    const bar = document.getElementById('promoBar');
    if (bar) {
      bar.addEventListener('click', () => { if (bar.dataset.status === 'active' && bar.classList.contains('promo-bar--clickable')) openPromoModal(); });
      bar.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && bar.classList.contains('promo-bar--clickable')) { e.preventDefault(); openPromoModal(); } });
    }

    // Mobile menu
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => {
        const isOpen = mobileMenu.classList.toggle('open');
        hamburger.classList.toggle('open', isOpen);
        hamburger.setAttribute('aria-expanded', String(isOpen));
      });
      mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }));
    }

    initSearch();
    initAccountMenu();
    loadPromotion();
    startPromoWatch();

    if (window.CartStore && CartStore.updateBadge) CartStore.updateBadge();
  }

  return { mount, getCatalogue, priceOf, discountPct, inr, bookUrl, esc, fetchJSON, searchableText };
})();

window.BookivoSite = BookivoSite;
