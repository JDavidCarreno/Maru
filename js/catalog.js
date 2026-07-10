/**
 * catalog.js — renderiza la grilla de productos y el modal con galería.
 */

let currentGalleryIndex = 0;
let currentImages = [];
let currentProducts = [];
let currentProductIndex = -1;

// ── RENDER GRID ──────────────────────────────────────────

async function renderGrid() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML =
    '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:3rem">Cargando productos…</p>';

  const products = await getProducts();
  currentProducts = products;
  grid.innerHTML = "";

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛍️</div>
        <p>Todavía no hay productos. <a href="admin.html">Ir al panel admin →</a></p>
      </div>`;
    return;
  }

  products.forEach((product) => {
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

    grid.appendChild(card);
  });
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
  if (currentProducts.length < 2) return;
  const i = (currentProductIndex - 1 + currentProducts.length) % currentProducts.length;
  closeModal();
  openModal(currentProducts[i]);
}

function nextProduct() {
  if (currentProducts.length < 2) return;
  const i = (currentProductIndex + 1) % currentProducts.length;
  closeModal();
  openModal(currentProducts[i]);
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

  renderGrid();

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

  let fsTouchStartX = 0;
  let fsTouchStartY = 0;
  fs.addEventListener("touchstart", (e) => {
    fsTouchStartX = e.changedTouches[0].screenX;
    fsTouchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  fs.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].screenX - fsTouchStartX;
    const dy = e.changedTouches[0].screenY - fsTouchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        openFullscreen((currentGalleryIndex + 1) % currentImages.length);
      } else {
        openFullscreen((currentGalleryIndex - 1 + currentImages.length) % currentImages.length);
      }
    }
  }, { passive: true });
});
