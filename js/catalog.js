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
// estado unificado del visor fullscreen
let fsScale = 1; // escala total activa
let fsTx = 0; // traslación total X
let fsTy = 0; // traslación total Y
let fsFitScale = 1; // escala para encajar la imagen en pantalla
let fsFitTx = 0; // traslación X del encaje
let fsFitTy = 0; // traslación Y del encaje
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

  document
    .querySelectorAll(".filter-btn")
    .forEach((btn) =>
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

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadNextPage();
    },
    { rootMargin: "200px" },
  );
  observer.observe(sentinel);

  loadNextPage();
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max).trimEnd() + "…" : str;
}

// ── MODAL ────────────────────────────────────────────────

function openModal(product) {
  currentProductIndex = currentProducts.findIndex((p) => p.id === product.id);
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
  if (
    currentProducts.length < 2 ||
    currentProductIndex >= currentProducts.length - 1
  )
    return;
  closeModal();
  openModal(currentProducts[currentProductIndex + 1]);
}

// ── FULLSCREEN ZOOM ──────────────────────────────────────

function applyFsTransform(animate) {
  const img = document.getElementById("fs-image");
  img.style.transition = animate ? "transform 0.2s ease-out" : "none";
  img.style.transform = `translate(${fsTx}px, ${fsTy}px) scale(${fsScale})`;
}

function resetFsZoom() {
  fsScale = fsFitScale;
  fsTx = fsFitTx;
  fsTy = fsFitTy;
}

// ── FULLSCREEN OVERLAY ───────────────────────────────────

function openFullscreen(index) {
  currentGalleryIndex = index;
  renderFullscreenImage(index);
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
  const img = document.getElementById("fs-image");
  img.classList.remove("loaded");
  img.src = currentImages[index];
  if (img.complete) handleFsLoad();
  document.getElementById("fs-counter").textContent =
    `${index + 1} / ${currentImages.length}`;
}

function handleFsLoad() {
  const img = document.getElementById("fs-image");
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  fsFitScale = Math.min(vw / img.naturalWidth, vh / img.naturalHeight) * 0.92;
  fsFitTx = (vw - img.naturalWidth * fsFitScale) / 2;
  fsFitTy = (vh - img.naturalHeight * fsFitScale) / 2;
  fsScale = fsFitScale;
  fsTx = fsFitTx;
  fsTy = fsFitTy;
  applyFsTransform(false);
  img.classList.add("loaded");
}

// ── TECLADO ──────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  const fs = document.getElementById("fs-overlay");
  const overlay = document.getElementById("modal-overlay");

  if (fs.classList.contains("open")) {
    if (e.key === "Escape") {
      closeFullscreen();
      return;
    }
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
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadNextPage();
    },
    { rootMargin: "200px" },
  );
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

  overlay
    .querySelector(".modal-product-arrow.prev")
    .addEventListener("click", prevProduct);
  overlay
    .querySelector(".modal-product-arrow.next")
    .addEventListener("click", nextProduct);

  let touchStartX = 0;
  let touchStartY = 0;
  overlay.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: true },
  );
  overlay.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      const dy = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) nextProduct();
        else prevProduct();
      }
    },
    { passive: true },
  );

  const fs = document.getElementById("fs-overlay");
  document.getElementById("fs-image").addEventListener("load", handleFsLoad);

  document
    .getElementById("fs-close-btn")
    .addEventListener("click", closeFullscreen);
  fs.addEventListener("click", (e) => {
    if (e.target === fs) closeFullscreen();
  });
  fs.querySelector(".fs-arrow.prev").addEventListener("click", () => {
    openFullscreen(
      (currentGalleryIndex - 1 + currentImages.length) % currentImages.length,
    );
  });
  fs.querySelector(".fs-arrow.next").addEventListener("click", () => {
    openFullscreen((currentGalleryIndex + 1) % currentImages.length);
  });

  // ── GESTOS FULLSCREEN (Pointer Events) ──────────────────
  // Usamos Pointer Events en lugar de Touch Events porque:
  //  - Cada dedo tiene un ID único que persiste durante el gesto
  //  - Al cambiar la cantidad de dedos simplemente rebaseamos el estado
  //  - No hay ambigüedad en e.touches vs e.changedTouches

  const fsPointers = new Map(); // pointerId → {x, y} posición actual
  let fsGestureStart = null; // snapshot del estado al inicio del gesto actual
  let fsSwipeStartX = 0;
  let fsSwipeStartY = 0;
  let fsIsDragging = false; // true si el dedo se movió lo suficiente
  let fsLastTapTime = 0;
  let fsLastTapX = 0;
  let fsLastTapY = 0;

  // Guarda un snapshot del estado actual como base para el gesto en curso.
  // Se llama cada vez que cambia la cantidad de dedos.
  function fsRebase() {
    const pts = [...fsPointers.values()];
    if (pts.length === 1) {
      fsGestureStart = {
        scale: fsScale,
        tx: fsTx,
        ty: fsTy,
        x: pts[0].x,
        y: pts[0].y,
      };
    } else if (pts.length >= 2) {
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      fsGestureStart = { scale: fsScale, tx: fsTx, ty: fsTy, midX, midY, dist };
    } else {
      fsGestureStart = null;
    }
  }

  fs.addEventListener("pointerdown", (e) => {
    // Ignorar clicks en botones (close, flechas)
    if (e.target.closest("button")) return;

    fs.setPointerCapture(e.pointerId);
    fsPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (fsPointers.size === 1) {
      // Primer dedo: guardar posición de inicio para swipe y double-tap
      fsSwipeStartX = e.clientX;
      fsSwipeStartY = e.clientY;
      fsIsDragging = false;
    }

    // Rebasear siempre al cambiar cantidad de dedos
    fsRebase();
  });

  fs.addEventListener("pointermove", (e) => {
    if (!fsPointers.has(e.pointerId) || !fsGestureStart) return;
    fsPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...fsPointers.values()];

    if (pts.length === 1) {
      const dx = pts[0].x - fsGestureStart.x;
      const dy = pts[0].y - fsGestureStart.y;
      if (!fsIsDragging && Math.hypot(dx, dy) > 6) fsIsDragging = true;

      if (fsScale > fsFitScale * 1.01) {
        // Pan con un dedo cuando hay zoom activo
        fsTx = fsGestureStart.tx + dx;
        fsTy = fsGestureStart.ty + dy;
        applyFsTransform(false);
      }
      // Sin zoom: el movimiento de un dedo es solo para swipe (se evalúa en pointerup)
    } else if (pts.length >= 2) {
      // Pinch-to-zoom con 2 dedos
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);

      const rawScale = fsGestureStart.scale * (dist / fsGestureStart.dist);
      const newScale = Math.max(fsFitScale, Math.min(fsFitScale * 5, rawScale));
      const ratio = newScale / fsGestureStart.scale;

      // El punto de imagen que estaba bajo fsGestureStart.mid queda ahora bajo mid actual.
      // Fórmula: tx = currentMid - (startMid - startTx) * ratio
      fsScale = newScale;
      fsTx = midX - (fsGestureStart.midX - fsGestureStart.tx) * ratio;
      fsTy = midY - (fsGestureStart.midY - fsGestureStart.ty) * ratio;

      fsIsDragging = true;
      applyFsTransform(false);
    }
  });

  fs.addEventListener("pointerup", (e) => {
    if (!fsPointers.has(e.pointerId)) return;
    fsPointers.delete(e.pointerId);

    if (fsPointers.size > 0) {
      // Queda al menos un dedo: rebasar para continuar el gesto sin salto
      fsRebase();
      return;
    }

    // Todos los dedos levantados — evaluar qué acción fue
    const wasDrag = fsIsDragging;
    fsIsDragging = false;
    fsGestureStart = null;

    const dx = e.clientX - fsSwipeStartX;
    const dy = e.clientY - fsSwipeStartY;

    // Swipe para cambiar imagen (solo cuando no hay zoom)
    if (wasDrag && fsScale <= fsFitScale * 1.01) {
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0)
          openFullscreen((currentGalleryIndex + 1) % currentImages.length);
        else
          openFullscreen(
            (currentGalleryIndex - 1 + currentImages.length) %
              currentImages.length,
          );
        return;
      }
    }

    // Double-tap: solo si fue un toque breve (no un arrastre ni un pinch)
    if (!wasDrag) {
      const now = Date.now();
      const dt = now - fsLastTapTime;
      const tapDist = Math.hypot(
        e.clientX - fsLastTapX,
        e.clientY - fsLastTapY,
      );

      if (dt < 300 && tapDist < 40) {
        // Segundo tap rápido
        if (fsScale > fsFitScale * 1.01) {
          // Estaba zoomado → volver al encaje
          resetFsZoom();
          applyFsTransform(true);
        } else {
          // Sin zoom → zoom 2.5× centrado en el punto del tap
          const newScale = fsFitScale * 2.5;
          const ratio = newScale / fsScale;
          fsTx = e.clientX - (e.clientX - fsTx) * ratio;
          fsTy = e.clientY - (e.clientY - fsTy) * ratio;
          fsScale = newScale;
          applyFsTransform(true);
        }
        fsLastTapTime = 0;
        return;
      }

      fsLastTapTime = now;
      fsLastTapX = e.clientX;
      fsLastTapY = e.clientY;
    }
  });

  fs.addEventListener("pointercancel", (e) => {
    fsPointers.delete(e.pointerId);
    if (fsPointers.size > 0) fsRebase();
    else {
      fsGestureStart = null;
      fsIsDragging = false;
    }
  });
});
