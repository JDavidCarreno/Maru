/**
 * catalog.js — renderiza la grilla de productos y el modal con galería.
 */

let currentGalleryIndex = 0;
let currentImages = [];

// ── RENDER GRID ──────────────────────────────────────────

function renderGrid() {
  const grid = document.getElementById('product-grid');
  const products = getProducts();
  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛍️</div>
        <p>Todavía no hay productos. <a href="admin.html">Ir al panel admin →</a></p>
      </div>`;
    return;
  }

  products.forEach(product => {
    const coverHTML = product.images && product.images.length
      ? `<img class="card-img" src="${product.images[0]}" alt="${product.name}" loading="lazy" onerror="this.outerHTML='<div class=\\'card-img-placeholder\\'>${product.emoji || '🏷️'}</div>'">`
      : `<div class="card-img-placeholder">${product.emoji || '🏷️'}</div>`;

    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Ver ${product.name}`);
    card.dataset.id = product.id;

    card.innerHTML = `
      ${coverHTML}
      <div class="card-body">
        <span class="card-tag">${product.category}</span>
        <h3 class="card-title">${product.name}</h3>
        <p class="card-desc">${truncate(product.description, 90)}</p>
        <div class="card-footer">
          <span class="card-price">${formatPrice(product.price)}</span>
          <span class="card-cta">Ver más</span>
        </div>
      </div>`;

    card.addEventListener('click', () => openModal(product.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(product.id); });

    grid.appendChild(card);
  });
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

// ── MODAL ────────────────────────────────────────────────

function openModal(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  currentImages = product.images && product.images.length
    ? product.images
    : [null]; // null = placeholder con emoji

  currentGalleryIndex = 0;
  renderModalContent(product);

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // focus trap — accesibilidad
  overlay.querySelector('.modal-close').focus();
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function renderModalContent(product) {
  const overlay = document.getElementById('modal-overlay');

  // ── galería principal ──
  const mainArea = overlay.querySelector('#gallery-main-area');
  mainArea.innerHTML = buildMainImage(currentGalleryIndex, product.emoji);

  // ── dots ──
  const dotsEl = overlay.querySelector('#gallery-dots');
  dotsEl.innerHTML = currentImages.map((_, i) =>
    `<button class="gallery-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Imagen ${i+1}"></button>`
  ).join('');

  // ── thumbs ──
  const thumbsEl = overlay.querySelector('#gallery-thumbs');
  thumbsEl.innerHTML = currentImages.map((img, i) => {
    if (img) {
      return `<img class="gallery-thumb ${i === 0 ? 'active' : ''}" src="${img}" alt="Miniatura ${i+1}" data-index="${i}" onerror="this.outerHTML='<div class=\\'gallery-thumb-placeholder ${i === 0 ? 'active' : ''}\\' data-index=\\'${i}\\'>${product.emoji || '🏷️'}</div>'">`
    }
    return `<div class="gallery-thumb-placeholder ${i === 0 ? 'active' : ''}" data-index="${i}">${product.emoji || '🏷️'}</div>`;
  }).join('');

  // ── info ──
  overlay.querySelector('#modal-tag').textContent   = product.category;
  overlay.querySelector('#modal-title').textContent = product.name;
  overlay.querySelector('#modal-price').textContent = formatPrice(product.price);
  overlay.querySelector('#modal-desc').textContent  = product.description;

  // Ocultar flechas si solo hay una imagen
  const arrows = overlay.querySelectorAll('.gallery-arrow');
  arrows.forEach(a => a.style.display = currentImages.length > 1 ? 'flex' : 'none');

  // ── eventos galería ──
  bindGalleryEvents(overlay, product);
}

function buildMainImage(index, emoji) {
  const img = currentImages[index];
  if (img) {
    return `<img class="gallery-main" src="${img}" alt="Imagen ${index+1}" onerror="this.outerHTML='<div class=\\'gallery-main-placeholder\\'>${emoji || '🏷️'}</div>'">`;
  }
  return `<div class="gallery-main-placeholder">${emoji || '🏷️'}</div>`;
}

function bindGalleryEvents(overlay, product) {
  // dots
  overlay.querySelector('#gallery-dots').addEventListener('click', e => {
    const btn = e.target.closest('.gallery-dot');
    if (!btn) return;
    goToSlide(parseInt(btn.dataset.index), overlay, product.emoji);
  });

  // thumbs
  overlay.querySelector('#gallery-thumbs').addEventListener('click', e => {
    const thumb = e.target.closest('[data-index]');
    if (!thumb) return;
    goToSlide(parseInt(thumb.dataset.index), overlay, product.emoji);
  });

  // arrows (re-bind limpiando listeners anteriores clonando)
  const prevBtn = overlay.querySelector('.gallery-arrow.prev');
  const nextBtn = overlay.querySelector('.gallery-arrow.next');

  const newPrev = prevBtn.cloneNode(true);
  const newNext = nextBtn.cloneNode(true);
  prevBtn.replaceWith(newPrev);
  nextBtn.replaceWith(newNext);

  newPrev.addEventListener('click', () => goToSlide((currentGalleryIndex - 1 + currentImages.length) % currentImages.length, overlay, product.emoji));
  newNext.addEventListener('click', () => goToSlide((currentGalleryIndex + 1) % currentImages.length, overlay, product.emoji));
}

function goToSlide(index, overlay, emoji) {
  currentGalleryIndex = index;

  overlay.querySelector('#gallery-main-area').innerHTML = buildMainImage(index, emoji);

  overlay.querySelectorAll('.gallery-dot').forEach((d, i) => d.classList.toggle('active', i === index));
  overlay.querySelectorAll('[data-index]').forEach(el => {
    if (el.classList.contains('gallery-thumb') || el.classList.contains('gallery-thumb-placeholder')) {
      el.classList.toggle('active', parseInt(el.dataset.index) === index);
    }
  });
}

// ── KEYBOARD NAVIGATION ──────────────────────────────────

document.addEventListener('keydown', e => {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay.classList.contains('open')) return;

  if (e.key === 'Escape') closeModal();
  if (e.key === 'ArrowRight') goToSlide((currentGalleryIndex + 1) % currentImages.length, overlay, null);
  if (e.key === 'ArrowLeft')  goToSlide((currentGalleryIndex - 1 + currentImages.length) % currentImages.length, overlay, null);
});

// ── INIT ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderGrid();

  // close on overlay click
  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
});
