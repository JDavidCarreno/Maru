/**
 * store.js — todas las operaciones de datos van contra Supabase.
 */

const TABLE = "products";
const BUCKET = "product-images";

// ── PRODUCTOS ────────────────────────────────────────────

async function getProducts() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getProducts:", error.message);
    return [];
  }
  return data;
}

async function addProduct(product) {
  const { data, error } = await db
    .from(TABLE)
    .insert([product])
    .select()
    .single();

  if (error) {
    console.error("addProduct:", error.message);
    return null;
  }
  return data;
}

async function updateProduct(id, product) {
  const { data, error } = await db
    .from(TABLE)
    .update(product)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateProduct:", error.message);
    return null;
  }
  return data;
}

async function deleteProduct(id) {
  // primero obtenemos las imágenes del producto
  const { data: product } = await db
    .from(TABLE)
    .select("images")
    .eq("id", id)
    .single();

  // borramos las imágenes del bucket
  if (product?.images?.length) {
    const paths = product.images
      .map((url) => url.split(`${BUCKET}/`)[1])
      .filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await db.storage
        .from(BUCKET)
        .remove(paths);
      if (storageError) console.error("deleteImages:", storageError.message);
    }
  }

  // borramos el producto de la base de datos
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) {
    console.error("deleteProduct:", error.message);
    return false;
  }
  return true;
}

// ── IMÁGENES ─────────────────────────────────────────────

async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `public/${filename}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    console.error("uploadImage:", error.message);
    return null;
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteImage(url) {
  // extrae el path desde la URL pública
  const path = url.split(`${BUCKET}/`)[1];
  if (!path) return;
  await db.storage.from(BUCKET).remove([path]);
}

// ── HELPERS ──────────────────────────────────────────────

function formatPrice(amount) {
  return "$" + Number(amount).toLocaleString("es-AR");
}
