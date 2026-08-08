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

async function getProductsPage(page, pageSize = 12, category = null, isForAll = null) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);

  if (isForAll === false) {
    query = query.or("is_forall.is.null,is_forall.eq.false");
  }
  // isForAll === true → no filter, todos los productos

  const { data, error } = await query.range(from, to);

  if (error) {
    console.error("getProductsPage:", error.message);
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

// Redimensiona y comprime la imagen antes de subirla,
// para que pese mucho menos y cargue rápido en el catálogo.
function compressImage(file, maxDimension = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = Math.max(img.width, img.height);
      if (max <= maxDimension) {
        resolve(file);
        return;
      }

      const scale = maxDimension / max;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const name = mime === "image/png" ? "optimized.png" : "optimized.jpg";
          resolve(new File([blob], name, { type: mime }));
        },
        mime,
        mime === "image/png" ? undefined : quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

async function uploadImage(file) {
  const optimized = await compressImage(file);
  const ext = optimized.type === "image/png" ? "png" : "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `public/${filename}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, optimized, { cacheControl: "3600", upsert: false });

  if (error) {
    console.error("uploadImage:", error.message);
    return null;
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Verifica si una URL de imagen está siendo usada por otro producto.
// Ante cualquier error, devuelve true para no borrar imágenes en uso.
async function imageIsUsedElsewhere(url, excludeId = null) {
  try {
    let query = db.from(TABLE).select("id").contains("images", [url]);
    if (excludeId !== null) query = query.neq("id", excludeId);
    const { data, error } = await query;
    if (error) {
      console.error("imageIsUsedElsewhere:", error.message);
      return true;
    }
    return (data || []).length > 0;
  } catch (err) {
    console.error("imageIsUsedElsewhere:", err);
    return true;
  }
}

async function deleteImage(url) {
  // extrae el path desde la URL pública
  const path = url.split(`${BUCKET}/`)[1];
  if (!path) return false;
  const { error } = await db.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("deleteImage:", error.message);
    return false;
  }
  return true;
}

// ── SETTINGS ─────────────────────────────────────────────

async function getSetting(key) {
  const { data, error } = await db
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error) {
    console.error("getSetting:", error.message);
    return null;
  }
  return data?.value ?? null;
}

async function setSetting(key, value) {
  const { error } = await db
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) {
    console.error("setSetting:", error.message);
    return false;
  }
  return true;
}

// ── HELPERS ──────────────────────────────────────────────

function formatPrice(amount) {
  return "$" + Number(amount).toLocaleString("es-AR");
}
