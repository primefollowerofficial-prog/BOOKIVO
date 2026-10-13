'use strict';
/* ============================================
   cart.js — BOOKIVO.IN multi-product cart page
   Renders every line item with per-line quantity controls,
   remove buttons, live subtotal/total, and opens the shared
   checkout modal (checkout.js) with the full cart payload.
   Display-only pricing; backend recalculates authoritative totals.
   ============================================ */

function formatRupees(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function lineHtml(item) {
  const S = window.BookivoSite;
  const { selling, original } = S.priceOf(item.book);
  const cover = item.book.coverImage || (item.book.gallery && item.book.gallery[0]) || 'images/Ebook1.png';
  return `<div class="cart-item" data-line="${S.esc(item.id)}">
    <img src="${S.esc(cover)}" alt="Cover of ${S.esc(item.book.title)}">
    <div class="cart-item-info">
      <h3>${S.esc(item.book.title)}</h3>
      <p class="muted">Digital PDF · Instant download</p>
      <div class="price-row">
        ${original ? `<span class="price-old">${formatRupees(original)}</span>` : ''}
        <span class="price-new">${formatRupees(selling)}</span>
      </div>
      <div class="qty-selector" role="group" aria-label="Quantity for ${S.esc(item.book.title)}">
        <button data-qty-minus="${S.esc(item.id)}" aria-label="Decrease quantity">−</button>
        <span data-qty-value="${S.esc(item.id)}">${item.qty}</span>
        <button data-qty-plus="${S.esc(item.id)}" aria-label="Increase quantity">+</button>
      </div>
    </div>
    <button class="cart-remove" data-remove="${S.esc(item.id)}" aria-label="Remove ${S.esc(item.book.title)} from cart">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
    </button>
  </div>`;
}

function renderCart() {
  const items = CartStore.getItems();
  const filledEl = document.getElementById('cartFilled');
  const emptyEl = document.getElementById('cartEmpty');
  const linesEl = document.getElementById('cartLines');

  if (!items.length) {
    if (filledEl) filledEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (filledEl) filledEl.hidden = false;
  if (emptyEl) emptyEl.hidden = true;
  if (linesEl) linesEl.innerHTML = items.map(lineHtml).join('');

  const total = CartStore.subtotal();
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');
  if (subtotalEl) subtotalEl.textContent = formatRupees(total);
  if (totalEl) totalEl.textContent = formatRupees(total);
}

function bindLineEvents() {
  const linesEl = document.getElementById('cartLines');
  if (!linesEl) return;

  linesEl.addEventListener('click', (e) => {
    const minus = e.target.closest('[data-qty-minus]');
    const plus = e.target.closest('[data-qty-plus]');
    const remove = e.target.closest('[data-remove]');

    if (minus) {
      const id = minus.getAttribute('data-qty-minus');
      const q = CartStore.getCount(id);
      if (q > 1) CartStore.setItem(id, q - 1); else CartStore.removeItem(id);
      renderCart();
    } else if (plus) {
      const id = plus.getAttribute('data-qty-plus');
      CartStore.setItem(id, Math.min(CartStore.getCount(id) + 1, 10));
      renderCart();
    } else if (remove) {
      const id = remove.getAttribute('data-remove');
      CartStore.removeItem(id);
      renderCart();
      if (window.showToast) showToast('Removed from cart', 'info');
    }
  });
}

function init() {
  renderCart();
  bindLineEvents();

  // Keep the page in sync when another tab/action changes the cart.
  document.addEventListener('bookivo:cart-change', renderCart);

  const buyBtn = document.getElementById('cartBuyNowBtn');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      const items = CartStore.getItems();
      if (!items.length) return;
      if (window.Checkout && typeof Checkout.openCart === 'function') {
        Checkout.openCart(items);
      } else if (window.Checkout) {
        // Legacy fallback: single-checkout still expects a qty number.
        Checkout.open(CartStore.totalUnits());
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
