/**
 * catalog.js — renderiza la grilla de productos y el modal con galería.
 */

let currentGalleryIndex = 0;
let currentImages = [];
let currentProducts = [];
let currentProductIndex = -1;
let currentPage = 0;
let isLoading = false;
let hasMore = true;
let currentFilter = null;
let observer = null;
let fsZoom = 1;
let fsPanX = 0;
let fsPanY = 0;
const PAGE_SIZE = 12;

// ── RENDER (INFINITE SCROLL) ────────────────────────────

function createCard(product) {
  const images = product.images || [];
  const coverHTML = images.length
    ? `<img class="card-img" src="${images[0]}" alt="${product.name}" loading="lazy">`
    : `<div class="card-img-placeholder">🏷️</div>`;

  const card = document.createElement("article");
  card.className = "card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `Ver ${product.name}`);

  card.innerHTML = `
    ${coverHTML}
    <div class="card-body">
      <span class="card-tag">${product.category}</span>
      <h3 class="card-title">${product.name}</h3>
      <p class="card-desc">${truncate(product.description || "", 90)}</p>
      <div class="card-footer">
        <span class="card-price">${formatPrice(product.price)}</span>
        <span class="card-cta">Ver más</span>
      </div>
    </div>`;

  card.addEventListener("click", () => openModal(product));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openModal(product);
  });

  return card;
}

async function loadNextPage() {
  if (isLoading || !hasMore) return;
  isLoading = true;

  const sentinel = document.getElementById("sentinel");
  sentinel.textContent = "Cargando…";

  currentPage++;
  const products = await getProductsPage(currentPage, PAGE_SIZE, currentFilter);

  if (products.length < PAGE_SIZE) hasMore = false;

  const grid = document.getElementById("product-grid");

  if (currentPage === 1 && products.length === 0) {
    grid.innerHTML = currentFilter
      ? `<div class="empty-state"><div class="empty-icon">🔍</div><p>No hay productos en esta categoría.</p></div>`
      : `<div class="empty-state"><div class="empty-icon">🛍️</div><p>Todavía no hay productos. <a href="admin.html">Ir al panel admin →</a></p></div>`;
    sentinel.style.display = "none";
    isLoading = false;
    return;
  }

  currentProducts.push(...products);

  if (currentPage === 1) grid.innerHTML = "";

  products.forEach((product) => grid.appendChild(createCard(product)));

  sentinel.textContent = hasMore ? "" : "— Todos los productos cargados —";
  isLoading = false;
}

function setFilter(category) {
  currentFilter = category;

  document.querySelectorAll(".filter-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.filter === category),
  );

  currentPage = 0;
  hasMore = true;
  currentProducts = [];
  isLoading = false;

  if (observer) observer.disconnect();

  const grid = document.getElementById("product-grid");
  grid.innerHTML =
    '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:3rem">Cargando productos…</p>';

  const sentinel = document.getElementById("sentinel");
  sentinel.textContent = "";
  sentinel.style.display = "";

  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadNextPage();
  }, { rootMargin: "200px" });
  observer.observe(sentinel);

  loadNextPage();
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max).trimEnd() + "…" : str;
}

// ── MODAL ────────────────────────────────────────────────

function openModal(product) {
  currentProductIndex = currentProducts.findIndex(p => p.id === product.id);
  currentImages = product.images && product.images.length ? product.images : [];
  currentGalleryIndex = 0;

  renderModalContent(product);

  const overlay = document.getElementById("modal-overlay");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  overlay.querySelector(".modal-close").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function renderModalContent(product) {
  const overlay = document.getElementById("modal-overlay");

  // imagen principal
  overlay.querySelector("#gallery-main-area").innerHTML = buildMainImage(0);

  // dots
  overlay.querySelector("#gallery-dots").innerHTML = currentImages
    .map(
      (_, i) =>
        `<button class="gallery-dot ${i === 0 ? "active" : ""}" data-index="${i}" aria-label="Imagen ${i + 1}"></button>`,
    )
    .join("");

  // miniaturas
  overlay.querySelector("#gallery-thumbs").innerHTML = currentImages
    .map(
      (url, i) =>
        `<img class="gallery-thumb ${i === 0 ? "active" : ""}" src="${url}" alt="Miniatura ${i + 1}" data-index="${i}" loading="lazy">`,
    )
    .join("");

  // info
  overlay.querySelector("#modal-tag").textContent = product.category;
  overlay.querySelector("#modal-title").textContent = product.name;
  overlay.querySelector("#modal-price").textContent = formatPrice(
    product.price,
  );
  overlay.querySelector("#modal-desc").textContent = product.description || "";

  // flechas: solo si hay más de una imagen
  overlay
    .querySelectorAll(".gallery-arrow")
    .forEach(
      (a) => (a.style.display = currentImages.length > 1 ? "flex" : "none"),
    );

  bindGalleryEvents(overlay);
}

function buildMainImage(index) {
  const url = currentImages[index];
  return url
    ? `<img class="gallery-main" src="${url}" alt="Imagen ${index + 1}">`
    : `<div class="gallery-main-placeholder">Sin imagen</div>`;
}

function bindGalleryEvents(overlay) {
  overlay.querySelector("#gallery-dots").addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-dot");
    if (btn) goToSlide(parseInt(btn.dataset.index), overlay);
  });

  overlay.querySelector("#gallery-thumbs").addEventListener("click", (e) => {
    const thumb = e.target.closest("[data-index]");
    if (thumb) openFullscreen(parseInt(thumb.dataset.index));
  });

  const prevBtn = overlay.querySelector(".gallery-arrow.prev").cloneNode(true);
  const nextBtn = overlay.querySelector(".gallery-arrow.next").cloneNode(true);
  overlay.querySelector(".gallery-arrow.prev").replaceWith(prevBtn);
  overlay.querySelector(".gallery-arrow.next").replaceWith(nextBtn);

  prevBtn.addEventListener("click", () =>
    goToSlide(
      (currentGalleryIndex - 1 + currentImages.length) % currentImages.length,
      overlay,
    ),
  );
  nextBtn.addEventListener("click", () =>
    goToSlide((currentGalleryIndex + 1) % currentImages.length, overlay),
  );
}

function goToSlide(index, overlay) {
  currentGalleryIndex = index;
  overlay.querySelector("#gallery-main-area").innerHTML = buildMainImage(index);
  overlay
    .querySelectorAll(".gallery-dot")
    .forEach((d, i) => d.classList.toggle("active", i === index));
  overlay
    .querySelectorAll(".gallery-thumb")
    .forEach((t) =>
      t.classList.toggle("active", parseInt(t.dataset.index) === index),
    );
}

// ── PRODUCT NAVIGATION ───────────────────────────────────

function prevProduct() {
  if (currentProducts.length < 2 || currentProductIndex < 1) return;
  closeModal();
  openModal(currentProducts[currentProductIndex - 1]);
}

function nextProduct() {
  if (currentProducts.length < 2 || currentProductIndex >= currentProducts.length - 1) return;
  closeModal();
  openModal(currentProducts[currentProductIndex + 1]);
}

// ── FULLSCREEN ZOOM ──────────────────────────────────────

function applyFsTransform(animate) {
  const img = document.getElementById("fs-image");
  img.style.transition = animate ? "transform 0.15s ease-out" : "none";
  img.style.transform = `translate(${fsPanX}px, ${fsPanY}px) scale(${fsZoom})`;
}

function resetFsZoom() {
  fsZoom = 1;
  fsPanX = 0;
  fsPanY = 0;
}

// ── FULLSCREEN OVERLAY ───────────────────────────────────

function openFullscreen(index) {
  currentGalleryIndex = index;
  renderFullscreenImage(index);
  resetFsZoom();
  applyFsTransform(false);
  document.getElementById("fs-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeFullscreen() {
  document.getElementById("fs-overlay").classList.remove("open");
  const modalOverlay = document.getElementById("modal-overlay");
  if (modalOverlay.classList.contains("open")) {
    goToSlide(currentGalleryIndex, modalOverlay);
  }
  if (!modalOverlay.classList.contains("open")) {
    document.body.style.overflow = "";
  }
}

function renderFullscreenImage(index) {
  const src = currentImages[index];
  document.getElementById("fs-image").src = src;
  const counter = document.getElementById("fs-counter");
  counter.textContent = `${index + 1} / ${currentImages.length}`;
}

// ── TECLADO ──────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  const fs = document.getElementById("fs-overlay");
  const overlay = document.getElementById("modal-overlay");

  if (fs.classList.contains("open")) {
    if (e.key === "Escape") { closeFullscreen(); return; }
    if (e.key === "ArrowRight")
      openFullscreen((currentGalleryIndex + 1) % currentImages.length);
    if (e.key === "ArrowLeft")
      openFullscreen(
        (currentGalleryIndex - 1 + currentImages.length) % currentImages.length,
      );
    return;
  }

  if (!overlay.classList.contains("open")) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "ArrowRight")
    goToSlide((currentGalleryIndex + 1) % currentImages.length, overlay);
  if (e.key === "ArrowLeft")
    goToSlide(
      (currentGalleryIndex - 1 + currentImages.length) % currentImages.length,
      overlay,
    );
});

// ── INIT ─────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const theme = await getSetting("theme");
    if (theme && theme !== "default") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (err) {
    console.error("Error al cargar tema:", err);
  }

  document.getElementById("product-grid").innerHTML =
    '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:3rem">Cargando productos…</p>';

  const sentinelEl = document.getElementById("sentinel");
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadNextPage();
  }, { rootMargin: "200px" });
  observer.observe(sentinelEl);

  document.getElementById("filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (btn) setFilter(btn.dataset.filter);
  });

  loadNextPage();

  const overlay = document.getElementById("modal-overlay");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target.classList.contains("gallery-main") && currentImages.length) {
      openFullscreen(currentGalleryIndex);
    }
  });
  document
    .getElementById("modal-close-btn")
    .addEventListener("click", closeModal);

  overlay.querySelector(".modal-product-arrow.prev").addEventListener("click", prevProduct);
  overlay.querySelector(".modal-product-arrow.next").addEventListener("click", nextProduct);

  let touchStartX = 0;
  let touchStartY = 0;
  overlay.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  overlay.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) nextProduct();
      else prevProduct();
    }
  }, { passive: true });

  const fs = document.getElementById("fs-overlay");
  document.getElementById("fs-close-btn").addEventListener("click", closeFullscreen);
  fs.addEventListener("click", (e) => {
    if (e.target === fs) closeFullscreen();
  });
  fs.querySelector(".fs-arrow.prev").addEventListener("click", () => {
    openFullscreen((currentGalleryIndex - 1 + currentImages.length) % currentImages.length);
  });
  fs.querySelector(".fs-arrow.next").addEventListener("click", () => {
    openFullscreen((currentGalleryIndex + 1) % currentImages.length);
  });

  let fsPinchStartDist = 0;
  let fsPinchStartZoom = 1;
  let fsSwipeStartX = 0;
  let fsSwipeStartY = 0;
  let fsIsSwiping = false;
  let fsPanStartX = 0;
  let fsPanStartY = 0;
  let fsPanTouchX = 0;
  let fsPanTouchY = 0;
  let fsLastTapTime = 0;
  let fsLastTapX = 0;
  let fsLastTapY = 0;

  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  fs.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      fsPinchStartDist = getTouchDist(e.touches);
      fsPinchStartZoom = fsZoom;
      fsIsSwiping = false;
      fsLastTapTime = 0;
    } else if (e.touches.length === 1) {
      if (fsZoom > 1) {
        fsPanStartX = fsPanX;
        fsPanStartY = fsPanY;
        fsPanTouchX = e.touches[0].clientX;
        fsPanTouchY = e.touches[0].clientY;
        fsIsSwiping = false;
      } else {
        fsSwipeStartX = e.touches[0].clientX;
        fsSwipeStartY = e.touches[0].clientY;
        fsIsSwiping = true;
      }
    }
  }, { passive: true });

  fs.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches);
      const newZoom = fsPinchStartZoom * (dist / fsPinchStartDist);
      fsZoom = Math.max(1, Math.min(5, newZoom));
      if (fsZoom === 1) { fsPanX = 0; fsPanY = 0; }
      applyFsTransform(false);
      e.preventDefault();
    } else if (e.touches.length === 1 && fsZoom > 1) {
      fsPanX = fsPanStartX + e.touches[0].clientX - fsPanTouchX;
      fsPanY = fsPanStartY + e.touches[0].clientY - fsPanTouchY;
      applyFsTransform(false);
      e.preventDefault();
    }
  }, { passive: false });

  fs.addEventListener("touchend", (e) => {
    if (e.changedTouches.length === 1 && fsIsSwiping && fsZoom === 1) {
      const dx = e.changedTouches[0].clientX - fsSwipeStartX;
      const dy = e.changedTouches[0].clientY - fsSwipeStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
          openFullscreen((currentGalleryIndex + 1) % currentImages.length);
        } else {
          openFullscreen((currentGalleryIndex - 1 + currentImages.length) % currentImages.length);
        }
        return;
      }
    }

    if (e.changedTouches.length === 1 && !fsIsSwiping) {
      const now = Date.now();
      const dt = now - fsLastTapTime;
      const cx = e.changedTouches[0].clientX;
      const cy = e.changedTouches[0].clientY;
      const tapDist = Math.hypot(cx - fsLastTapX, cy - fsLastTapY);

      if (dt < 300 && tapDist < 30) {
        if (fsZoom > 1) {
          fsZoom = 1;
          fsPanX = 0;
          fsPanY = 0;
        } else {
          fsZoom = 2.5;
          fsPanX = 0;
          fsPanY = 0;
        }
        applyFsTransform(true);
        fsLastTapTime = 0;
        return;
      }

      fsLastTapTime = now;
      fsLastTapX = cx;
      fsLastTapY = cy;
    }
  }, { passive: true });

});
