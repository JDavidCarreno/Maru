/**
 * admin.js — lógica del panel de administración.
 */

let editingId = null;       // null = nuevo producto, número = editar existente
let pendingImages = [];     // URLs de imágenes para el producto actual

// ── INIT ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderAdminTable();
  bindFormEvents();
});

// ── TABLE ────────────────────────────────────────────────

function renderAdminTable() {
  const tbody = document.getElementById('admin-tbody');
  const products = getProducts();
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No hay productos. Cargá el primero 👆</td></tr>`;
    return;
  }

  products.forEach(p => {
    const thumb = p.images && p.images.length
      ? `<img class="admin-thumb" src="${p.images[0]}" alt="${p.name}" onerror="this.outerHTML='<span class=\\'admin-thumb-emoji\\'>${p.emoji || '🏷️'}</span>'">`
      : `<span class="admin-thumb-emoji">${p.emoji || '🏷️'}</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${thumb}</td>
      <td>
        <strong>${p.name}</strong>
        <br><span class="admin-cat-badge">${p.category}</span>
      </td>
      <td>${formatPrice(p.price)}</td>
      <td class="admin-img-count">${p.images ? p.images.length : 0} img.</td>
      <td class="admin-actions">
        <button class="admin-btn edit" onclick="startEdit(${p.id})">✏️ Editar</button>
        <button class="admin-btn delete" onclick="confirmDelete(${p.id})">🗑️ Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ── FORM ─────────────────────────────────────────────────

function bindFormEvents() {
  document.getElementById('product-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-cancel').addEventListener('click', resetForm);
  document.getElementById('btn-add-image').addEventListener('click', addImageField);
  document.getElementById('btn-new').addEventListener('click', () => {
    resetForm();
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
  });
}

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const productData = {
    name:        form.name_field.value.trim(),
    category:    form.category_field.value.trim(),
    price:       parseFloat(form.price_field.value),
    description: form.description_field.value.trim(),
    emoji:       form.emoji_field.value.trim() || '🏷️',
    images:      collectImages()
  };

  if (!productData.name || !productData.category || isNaN(productData.price)) {
    showToast('Completá los campos obligatorios.', 'error');
    return;
  }

  if (editingId !== null) {
    updateProduct(editingId, productData);
    showToast('✅ Producto actualizado.');
  } else {
    addProduct(productData);
    showToast('✅ Producto agregado.');
  }

  resetForm();
  renderAdminTable();
}

function startEdit(id) {
  const products = getProducts();
  const p = products.find(prod => prod.id === id);
  if (!p) return;

  editingId = id;
  const form = document.getElementById('product-form');
  form.name_field.value        = p.name;
  form.category_field.value    = p.category;
  form.price_field.value       = p.price;
  form.description_field.value = p.description;
  form.emoji_field.value       = p.emoji || '';

  // render image fields
  const container = document.getElementById('images-container');
  container.innerHTML = '';
  (p.images || []).forEach(url => addImageField(url));

  document.getElementById('form-title').textContent = '✏️ Editando producto';
  document.getElementById('btn-submit').textContent = 'Guardar cambios';
  document.getElementById('btn-cancel').style.display = 'inline-flex';
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
  editingId = null;
  document.getElementById('product-form').reset();
  document.getElementById('images-container').innerHTML = '';
  document.getElementById('form-title').textContent = '➕ Nuevo producto';
  document.getElementById('btn-submit').textContent = 'Agregar producto';
  document.getElementById('btn-cancel').style.display = 'none';
}

// ── IMAGE FIELDS ─────────────────────────────────────────

function addImageField(url = '') {
  const container = document.getElementById('images-container');
  const count = container.querySelectorAll('.image-field-row').length;

  const row = document.createElement('div');
  row.className = 'image-field-row';
  row.innerHTML = `
    <span class="img-index">${count + 1}</span>
    <input type="url" class="img-url-input" placeholder="https://ejemplo.com/imagen.jpg" value="${url}">
    <button type="button" class="img-preview-btn" onclick="previewImage(this)" title="Vista previa">👁️</button>
    <button type="button" class="img-remove-btn" onclick="removeImageField(this)" title="Eliminar">✕</button>`;
  container.appendChild(row);
  row.querySelector('input').focus();
}

function removeImageField(btn) {
  btn.closest('.image-field-row').remove();
  // renumber
  document.querySelectorAll('.img-index').forEach((el, i) => el.textContent = i + 1);
}

function previewImage(btn) {
  const input = btn.previousElementSibling;
  const url = input.value.trim();
  if (!url) { showToast('Ingresá una URL primero.', 'error'); return; }

  const existing = btn.closest('.image-field-row').querySelector('.img-preview-thumb');
  if (existing) { existing.remove(); return; }

  const img = document.createElement('img');
  img.className = 'img-preview-thumb';
  img.src = url;
  img.alt = 'Vista previa';
  img.onerror = () => showToast('No se pudo cargar la imagen.', 'error');
  btn.closest('.image-field-row').appendChild(img);
}

function collectImages() {
  return Array.from(document.querySelectorAll('.img-url-input'))
    .map(i => i.value.trim())
    .filter(Boolean);
}

// ── DELETE ────────────────────────────────────────────────

function confirmDelete(id) {
  const products = getProducts();
  const p = products.find(prod => prod.id === id);
  if (!p) return;

  showConfirm(`¿Eliminár "${p.name}"?`, () => {
    deleteProduct(id);
    renderAdminTable();
    showToast('🗑️ Producto eliminado.');
    if (editingId === id) resetForm();
  });
}

// ── TOAST ────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ── CONFIRM DIALOG ───────────────────────────────────────

function showConfirm(message, onConfirm) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-message').textContent = message;
  overlay.classList.add('open');

  const confirmBtn = document.getElementById('confirm-yes');
  const cancelBtn  = document.getElementById('confirm-no');

  function cleanup() {
    overlay.classList.remove('open');
    confirmBtn.removeEventListener('click', onYes);
    cancelBtn.removeEventListener('click', cleanup);
  }

  function onYes() { cleanup(); onConfirm(); }

  confirmBtn.addEventListener('click', onYes);
  cancelBtn.addEventListener('click', cleanup);
}
