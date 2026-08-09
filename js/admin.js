/**
 * admin.js — lógica del panel de administración con Supabase.
 */

let editingId = null;
let existingImages = []; // URLs ya guardadas al editar un producto
let removedImages = []; // URLs de imágenes quitadas en la edición actual
let adminProducts = []; // lista actual de productos en el orden visible

// ── AUTH ─────────────────────────────────────────────────

async function initAdmin() {
  document.getElementById("login-overlay").style.display = "none";

  await loadTheme();
  bindThemeEvents();

  await renderAdminTable();
  bindFormEvents();
}

async function logout() {
  await db.auth.signOut();
  location.reload();
}

// ── INIT ─────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // primero adjuntamos los listeners sincronamente
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("btn-logout").addEventListener("click", logout);

  // luego verificamos si ya hay sesión activa
  try {
    const {
      data: { session },
    } = await db.auth.getSession();
    // verificamos que sea un usuario real (con email), no una sesión anónima
    if (session?.user?.email) await initAdmin();
  } catch (err) {
    console.error("Error al verificar sesión:", err);
  }
});

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");

  errorEl.style.display = "none";
  submitBtn.textContent = "Entrando…";
  submitBtn.disabled = true;

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = "Email o contraseña incorrectos.";
    errorEl.style.display = "block";
    submitBtn.textContent = "Entrar";
    submitBtn.disabled = false;
  } else {
    await initAdmin();
  }
}

// ── THEME ────────────────────────────────────────────────

async function loadTheme() {
  try {
    const theme = await getSetting("theme");
    const sel = document.getElementById("theme-select");
    if (theme) {
      sel.value = theme;
      if (theme !== "default") {
        document.documentElement.setAttribute("data-theme", theme);
      }
    }
  } catch (err) {
    console.error("loadTheme:", err);
  }
}

function bindThemeEvents() {
  document.getElementById("theme-select").addEventListener("change", (e) => {
    const theme = e.target.value;
    if (theme !== "default") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  });

  document.getElementById("btn-theme-save").addEventListener("click", async () => {
    const theme = document.getElementById("theme-select").value;
    const ok = await setSetting("theme", theme);
    showToast(ok ? "✅ Tema guardado." : "❌ Error al guardar tema.", ok ? "success" : "error");
  });
}

// ── TABLE ────────────────────────────────────────────────

async function renderAdminTable() {
  const tbody = document.getElementById("admin-tbody");
  tbody.innerHTML =
    '<tr><td colspan="6" class="table-empty">Cargando…</td></tr>';

  adminProducts = await getProducts();

  if (adminProducts.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="table-empty">No hay productos. Cargá el primero 👆</td></tr>';
    return;
  }

  renderTableRows();
}

function renderTableRows() {
  const tbody = document.getElementById("admin-tbody");
  tbody.innerHTML = "";

  adminProducts.forEach((p, index) => {
    const images = p.images || [];
    const thumb = images.length
      ? `<img class="admin-thumb" src="${images[0]}" alt="${p.name}">`
      : `<div class="admin-thumb" style="background:linear-gradient(135deg,#f8e9e0,#f2d5c8)"></div>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Orden" class="admin-order">
        <button class="admin-order-btn" onclick="moveProduct(${index}, -1)" ${index === 0 ? "disabled" : ""} aria-label="Subir ${p.name}">↑</button>
        <button class="admin-order-btn" onclick="moveProduct(${index}, 1)" ${index === adminProducts.length - 1 ? "disabled" : ""} aria-label="Bajar ${p.name}">↓</button>
      </td>
      <td data-label="Imagen">${thumb}</td>
      <td data-label="Nombre / Categoría">
        <strong>${p.name}</strong>
        <br><span class="admin-cat-badge">${p.category}</span>
      </td>
      <td data-label="Precio">${formatPrice(p.price)}</td>
      <td data-label="Imágenes" class="admin-img-count">${images.length} img.</td>
      <td class="admin-actions">
        <button class="admin-btn edit"   onclick="startEdit(${p.id})">✏️ Editar</button>
        <button class="admin-btn delete" onclick="confirmDelete(${p.id})">🗑️ Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Mueve una fila hacia arriba (-1) o abajo (+1) solo en pantalla.
// El orden se persiste con "Guardar orden".
function moveProduct(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= adminProducts.length) return;

  const [item] = adminProducts.splice(index, 1);
  adminProducts.splice(target, 0, item);
  renderTableRows();
}

async function saveOrder() {
  if (!adminProducts.length) return;
  const btn = document.getElementById("btn-save-order");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Guardando…";

  const ok = await saveProductOrder(adminProducts.map((p) => p.id));

  btn.disabled = false;
  btn.textContent = original;
  showToast(ok ? "✅ Orden guardado." : "❌ Error al guardar el orden.", ok ? "success" : "error");
  if (ok) await renderAdminTable();
}

// ── FORM ─────────────────────────────────────────────────

function bindFormEvents() {
  document
    .getElementById("product-form")
    .addEventListener("submit", handleFormSubmit);
  document.getElementById("btn-cancel").addEventListener("click", resetForm);
  document
    .getElementById("btn-add-image")
    .addEventListener("click", () => addImageRow());
  document.getElementById("btn-new").addEventListener("click", () => {
    resetForm();
    document
      .getElementById("form-section")
      .scrollIntoView({ behavior: "smooth" });
  });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const name = form.name_field.value.trim();
  const category = form.category_field.value.trim();
  const price = parseFloat(form.price_field.value);
  const description = form.description_field.value.trim();
  const is_forall = document.getElementById("is_forall_field").value === "1";

  if (!name || !category || isNaN(price)) {
    showToast("Completá los campos obligatorios.", "error");
    return;
  }

  setBusy(true);

  // subir imágenes nuevas y combinarlas con las existentes
  const uploadedUrls = await uploadPendingImages();
  const allImages = [...existingImages, ...uploadedUrls];

  const productData = { name, category, price, description, images: allImages, is_forall };

  let ok;
  if (editingId !== null) {
    ok = await updateProduct(editingId, productData);
    showToast(
      ok ? "✅ Producto actualizado." : "Error al actualizar.",
      ok ? "success" : "error",
    );
  } else {
    // los productos nuevos aparecen arriba (el orden manual lo define el admin)
    ok = await addProduct({ ...productData, sort_order: 0 });
    showToast(
      ok ? "✅ Producto agregado." : "Error al agregar.",
      ok ? "success" : "error",
    );
  }

  setBusy(false);
  if (ok) {
    const freed = await deleteRemovedImages();
    if (freed > 0) {
      showToast(`✅ Guardado. 🗑️ ${freed} imagen(es) eliminada(s) del storage.`);
    }
    resetForm();
    await renderAdminTable();
  }
}

// Borra del storage las imágenes quitadas durante la edición,
// solo si ya no son usadas por ningún otro producto.
// Devuelve cuántas se lograron borrar.
async function deleteRemovedImages() {
  if (!removedImages.length) return 0;

  let deleted = 0;
  const kept = [];
  for (const url of removedImages) {
    const usedElsewhere = await imageIsUsedElsewhere(url, editingId);
    if (usedElsewhere) {
      kept.push(url);
      continue;
    }
    const ok = await deleteImage(url);
    if (ok) deleted++;
    else kept.push(url);
  }

  removedImages = [];

  if (kept.length) {
    console.warn("Imágenes no borradas del storage:", kept);
  }
  return deleted;
}

async function startEdit(id) {
  const products = await getProducts();
  const p = products.find((prod) => prod.id === id);
  if (!p) return;

  editingId = id;
  existingImages = p.images || [];
  removedImages = [];

  const form = document.getElementById("product-form");
  form.name_field.value = p.name;
  form.category_field.value = p.category;
  document.getElementById("is_forall_field").value = p.is_forall ? "1" : "0";
  form.price_field.value = p.price;
  form.description_field.value = p.description || "";

  // mostrar imágenes existentes
  const container = document.getElementById("images-container");
  container.innerHTML = "";
  existingImages.forEach((url, i) => addExistingImageRow(url, i));

  document.getElementById("form-title").textContent = "✏️ Editando producto";
  document.getElementById("btn-submit").textContent = "Guardar cambios";
  document.getElementById("btn-cancel").style.display = "inline-flex";
  document
    .getElementById("form-section")
    .scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  existingImages = [];
  removedImages = [];
  document.getElementById("product-form").reset();
  document.getElementById("images-container").innerHTML = "";
  document.getElementById("form-title").textContent = "➕ Nuevo producto";
  document.getElementById("btn-submit").textContent = "Agregar producto";
  document.getElementById("btn-cancel").style.display = "none";
}

// ── IMAGE ROWS ───────────────────────────────────────────

// Fila para imagen ya guardada (muestra miniatura + botón de eliminar)
function addExistingImageRow(url, index) {
  const container = document.getElementById("images-container");
  const row = document.createElement("div");
  row.className = "image-field-row existing";
  row.dataset.url = url;
  row.innerHTML = `
    <img src="${url}" class="img-preview-thumb" alt="Imagen ${index + 1}">
    <span class="img-existing-label">Imagen ${index + 1}</span>
    <button type="button" class="img-remove-btn" onclick="removeExistingImage(this)">✕ Eliminar</button>`;
  container.appendChild(row);
}

function removeExistingImage(btn) {
  const row = btn.closest(".image-field-row.existing");
  const url = row.dataset.url;
  existingImages = existingImages.filter((u) => u !== url);
  removedImages.push(url);
  row.remove();
}

// Fila para subir imagen nueva desde el dispositivo
function addImageRow() {
  const container = document.getElementById("images-container");
  const row = document.createElement("div");
  row.className = "image-field-row new";
  row.innerHTML = `
    <input type="file" class="img-file-input" accept="image/*" style="display:none">
    <div class="img-pick-area">
      <img class="img-preview-thumb" style="display:none">
      <button type="button" class="img-pick-btn">📁 Elegir imagen</button>
      <span class="img-status">Sin archivo seleccionado</span>
    </div>
    <button type="button" class="img-remove-btn" onclick="this.closest('.image-field-row').remove()">✕</button>`;
  container.appendChild(row);

  const input = row.querySelector(".img-file-input");
  const pickBtn = row.querySelector(".img-pick-btn");
  const status = row.querySelector(".img-status");
  const preview = row.querySelector(".img-preview-thumb");

  // el botón visible dispara el input oculto
  pickBtn.addEventListener("click", () => input.click());

  input.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    status.textContent = `📎 ${file.name}`;
    pickBtn.textContent = "🔄 Cambiar";

    // miniatura local antes de subir
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.src = ev.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });
}

// Recorre todas las filas "new", sube cada archivo y devuelve las URLs
async function uploadPendingImages() {
  const rows = document.querySelectorAll(".image-field-row.new");
  const urls = [];

  for (const row of rows) {
    const input = row.querySelector('input[type="file"]');
    const status = row.querySelector(".img-status");
    if (!input || !input.files[0]) continue;

    status.textContent = "✂️ Optimizando y subiendo…";
    const url = await uploadImage(input.files[0]);
    if (url) {
      urls.push(url);
      status.textContent = "✅";
    } else {
      status.textContent = "❌ Error";
    }
  }
  return urls;
}

// ── DELETE ────────────────────────────────────────────────

function confirmDelete(id) {
  showConfirm("¿Eliminar este producto?", async () => {
    const ok = await deleteProduct(id);
    if (ok) {
      showToast("🗑️ Producto eliminado.");
      if (editingId === id) resetForm();
      await renderAdminTable();
    } else {
      showToast("Error al eliminar.", "error");
    }
  });
}

// ── BUSY STATE ───────────────────────────────────────────

function setBusy(busy) {
  const btn = document.getElementById("btn-submit");
  btn.disabled = busy;
  btn.textContent = busy
    ? "Guardando…"
    : editingId
      ? "Guardar cambios"
      : "Agregar producto";
}

// ── TOAST ────────────────────────────────────────────────

function showToast(msg, type = "success") {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ── CONFIRM ───────────────────────────────────────────────

function showConfirm(message, onConfirm) {
  const overlay = document.getElementById("confirm-overlay");
  document.getElementById("confirm-message").textContent = message;
  overlay.classList.add("open");

  const yes = document.getElementById("confirm-yes");
  const no = document.getElementById("confirm-no");

  function cleanup() {
    overlay.classList.remove("open");
    yes.removeEventListener("click", onYes);
    no.removeEventListener("click", cleanup);
  }
  function onYes() {
    cleanup();
    onConfirm();
  }

  yes.addEventListener("click", onYes);
  no.addEventListener("click", cleanup);
}
