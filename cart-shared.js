'use strict';
/* ============================================
   BOOKIVO.IN — Multi-product cart store (v2)
   Replaces the old single-quantity CartStore while KEEPING the same
   public API names (getQty/setQty/add/clear/updateBadge) so legacy
   calls on the cookbook page keep working — they simply operate on
   the cookbook line item.

   Storage: localStorage key "bookivo_cart_v1" = { [productId]: qty }
   Product metadata comes from the catalogue (data.js snapshot / backend).
   Display-only pricing; the server always recalculates authoritative totals.
   ============================================ */

const CookbookProduct = {
  id: 'b99-cookbook',
  slug: 'bachelor-99-survival-cookbook',
  title: 'Bachelor 99 Survival Cookbook',
  coverImage: 'images/Ebook1.png',
  sellingPrice: 99,
  originalPrice: 199,
  url: 'index.html#product'
};

const CartStore = (() => {
  const STORAGE_KEY = 'bookivo_cart_v1';
  const LEGACY_KEY = 'b99_cart_qty'; // migrated once, then removed

  function readRaw() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    } catch (e) { /* corrupted */ }
    return {};
  }

  function writeRaw(map) {
    let any = false;
    for (const k in map) {
      const q = Math.max(0, parseInt(map[k], 10) || 0);
      if (q > 0) { map[k] = Math.min(q, 10); any = true; } else { delete map[k]; }
    }
    if (!any) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    updateBadge();
    document.dispatchEvent(new CustomEvent('bookivo:cart-change'));
    return map;
  }

  // One-time migration of the old single-product quantity.
  function migrateLegacy() {
    const legacy = parseInt(localStorage.getItem(LEGACY_KEY), 10);
    if (Number.isFinite(legacy) && legacy > 0) {
      const map = readRaw();
      map[CookbookProduct.id] = Math.min(legacy, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
    localStorage.removeItem(LEGACY_KEY);
  }
  migrateLegacy();

  function lookupBook(id) {
    if (id === CookbookProduct.id || id === CookbookProduct.slug) return CookbookProduct;
    const cat = (typeof BOOKIVO_CATALOGUE !== 'undefined') ? BOOKIVO_CATALOGUE : [];
    return cat.find(b => b.id === id || b.slug === id) || null;
  }

  /* ---------- core multi-item API ---------- */
  function getItems() {
    const map = readRaw();
    const items = [];
    for (const id in map) {
      const book = lookupBook(id);
      if (book) items.push({ id: book.id, book, qty: map[id] });
    }
    return items;
  }

  function addItem(id, qty) {
    const map = readRaw();
    const addQ = Math.max(1, parseInt(qty, 10) || 1);
    const cur = parseInt(map[id], 10) || 0;
    map[id] = Math.min(cur + addQ, 10); // merge duplicates sensibly
    writeRaw(map);
    return map[id];
  }

  function setItem(id, qty) {
    const map = readRaw();
    const q = Math.max(0, parseInt(qty, 10) || 0);
    if (q === 0) delete map[id]; else map[id] = Math.min(q, 10);
    writeRaw(map);
    return q;
  }

  function removeItem(id) { return setItem(id, 0); }

  function getCount(id) {
    const map = readRaw();
    return parseInt(map[id], 10) || 0;
  }

  function totalUnits() {
    const map = readRaw();
    return Object.values(map).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
  }

  function subtotal() {
    return getItems().reduce((sum, it) => {
      const p = (window.BookivoSite && BookivoSite.priceOf)
        ? BookivoSite.priceOf(it.book).selling
        : (Number(it.book.sellingPrice != null ? it.book.sellingPrice : it.book.price) || 0);
      return sum + p * it.qty;
    }, 0);
  }

  /* ---------- legacy single-product compatibility ----------
     Old pages call CartStore.getQty()/add(qty)/setQty(qty)/clear().
     These now operate specifically on the cookbook line. */
  function getQty() { return getCount(CookbookProduct.id); }
  function setQty(qty) { return setItem(CookbookProduct.id, qty); }
  function legacyAdd(qty) { return addItem(CookbookProduct.id, qty); }
  function clear() { localStorage.removeItem(STORAGE_KEY); updateBadge(); document.dispatchEvent(new CustomEvent('bookivo:cart-change')); }

  function updateBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const units = totalUnits();
    if (units > 0) { badge.textContent = String(units); badge.hidden = false; }
    else { badge.hidden = true; }
  }

  document.addEventListener('DOMContentLoaded', updateBadge);

  return {
    // multi-product
    getItems, addItem, setItem, removeItem, getCount, totalUnits, subtotal,
    // legacy-compatible
    getQty, setQty, add: legacyAdd, clear, updateBadge,
    CookbookProduct
  };
})();

window.CartStore = CartStore;
