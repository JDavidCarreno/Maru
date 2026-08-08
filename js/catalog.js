/**
 * catalog.js — renderiza la grilla de productos y el visor fullscreen.
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
let fsRotation = 0; // rotación en grados (0/90/180/270)
const PAGE_SIZE = 12;

// ── RENDER (INFINITE SCROLL) ────────────────────────────

function autoFitImage(img, tolerance = 0.12) {
  const apply = () => {
    const cw = img.clientWidth;
    const ch = img.clientHeight;
    if (!cw || !ch || !img.naturalWidth) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = cw / ch;
    img.classList.toggle(
      "fit-contain",
      Math.abs(imgRatio - boxRatio) > tolerance,
    );
  };
  img.addEventListener("load", apply);
  if (img.complete) requestAnimationFrame(apply);
  img._applyFit = apply;
}

function createCardImage(src, alt) {
  const img = document.createElement("img");
  img.className = "card-img";
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  autoFitImage(img);
  return img;
}

function createCard(product) {
  const card = document.createElement("article");
  card.className = "card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `Ver ${product.name}`);

  card.innerHTML = `
    <div class="card-body">
      <span class="card-tag">${product.category}</span>
      <h3 class="card-title">${product.name}</h3>
      <p class="card-desc">${truncate(product.description || "", 90)}</p>
      <div class="card-footer">
        <span class="card-price">${formatPrice(product.price)}</span>
        <span class="card-cta">Ver fotos</span>
      </div>
    </div>`;

  const images = product.images || [];
  const cover = images.length
    ? createCardImage(images[0], product.name)
    : (() => {
        const ph = document.createElement("div");
        ph.className = "card-img-placeholder";
        ph.textContent = "🏷️";
        return ph;
      })();
  card.insertBefore(cover, card.firstChild);

  card.addEventListener("click", () => openDirect(product));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openDirect(product);
  });

  return card;
}

async function loadNextPage() {
  if (isLoading || !hasMore) return;
  isLoading = true;

  const sentinel = document.getElementById("sentinel");
  sentinel.textContent = "Cargando…";

  currentPage++;
  const isForAll = typeof PAGE_IS_FOR_ALL !== "undefined" ? PAGE_IS_FOR_ALL : null;
  const products = await getProductsPage(currentPage, PAGE_SIZE, currentFilter, isForAll);

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

// ── APERTURA DIRECTA A FULLSCREEN ─────────────────────────

function openDirect(product) {
  const images = product.images && product.images.length ? product.images : [];
  if (!images.length) return;

  currentProductIndex = currentProducts.findIndex((p) => p.id === product.id);
  currentImages = images;
  currentGalleryIndex = 0;

  document.getElementById("fs-info-name").textContent = product.name;
  document.getElementById("fs-info-price").textContent = formatPrice(
    product.price,
  );

  openFullscreen(0);
}

// ── FULLSCREEN ZOOM ──────────────────────────────────────

function applyFsTransform(animate) {
  const img = document.getElementById("fs-image");
  img.style.transition = animate ? "transform 0.2s ease-out" : "none";
  img.style.transform = `translate(${fsTx}px, ${fsTy}px) scale(${fsScale}) rotate(${fsRotation}deg)`;
}

function resetFsZoom() {
  fsScale = fsFitScale;
  fsTx = fsFitTx;
  fsTy = fsFitTy;
}

// Calcula el encaje a pantalla teniendo en cuenta la rotación.
// Con transform-origin 0 0, la caja rotada se reubica según el cuadrante.
function computeFsFit(rotation, vw, vh, nw, nh) {
  const swap = rotation === 90 || rotation === 270;
  const effW = swap ? nh : nw;
  const effH = swap ? nw : nh;
  const scale = Math.min(vw / effW, vh / effH) * 0.92;

  let tx, ty;
  switch (rotation) {
    case 90:
      tx = (vw + effW * scale) / 2;
      ty = (vh - effH * scale) / 2;
      break;
    case 180:
      tx = (vw + effW * scale) / 2;
      ty = (vh + effH * scale) / 2;
      break;
    case 270:
      tx = (vw - effW * scale) / 2;
      ty = (vh + effH * scale) / 2;
      break;
    default:
      tx = (vw - effW * scale) / 2;
      ty = (vh - effH * scale) / 2;
  }
  return { scale, tx, ty };
}

// Rota la imagen y reencuadra a pantalla.
function rotateImage(dir) {
  fsRotation = (fsRotation + (dir === "right" ? 90 : 270)) % 360;
  const img = document.getElementById("fs-image");
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fit = computeFsFit(fsRotation, vw, vh, img.naturalWidth, img.naturalHeight);
  fsFitScale = fit.scale;
  fsFitTx = fit.tx;
  fsFitTy = fit.ty;
  fsScale = fsFitScale;
  fsTx = fsFitTx;
  fsTy = fsFitTy;
  applyFsTransform(false);
}

// ── FULLSCREEN OVERLAY ───────────────────────────────────

function openFullscreen(index) {
  currentGalleryIndex = index;
  renderFullscreenImage(index);
  const fsOverlay = document.getElementById("fs-overlay");
  fsOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  const show = currentImages.length > 1;
  fsOverlay.querySelectorAll(".fs-arrow").forEach((a) => {
    a.style.display = show ? "flex" : "none";
  });
}

function closeFullscreen() {
  document.getElementById("fs-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function renderFullscreenImage(index) {
  const img = document.getElementById("fs-image");
  img.classList.remove("loaded");
  fsRotation = 0;
  img.src = currentImages[index];
  if (img.complete) handleFsLoad();
  document.getElementById("fs-counter").textContent =
    `${index + 1} / ${currentImages.length}`;
}

function handleFsLoad() {
  const img = document.getElementById("fs-image");
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fit = computeFsFit(fsRotation, vw, vh, img.naturalWidth, img.naturalHeight);
  fsFitScale = fit.scale;
  fsFitTx = fit.tx;
  fsFitTy = fit.ty;
  fsScale = fsFitScale;
  fsTx = fsFitTx;
  fsTy = fsFitTy;
  applyFsTransform(false);
  img.classList.add("loaded");
}

// ── TECLADO ──────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  const fs = document.getElementById("fs-overlay");

  if (!fs.classList.contains("open")) return;
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

  document
    .getElementById("fs-rotate-left")
    .addEventListener("click", () => rotateImage("left"));
  document
    .getElementById("fs-rotate-right")
    .addEventListener("click", () => rotateImage("right"));

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
