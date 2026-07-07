/**
 * store.js — fuente de verdad compartida para productos.
 * Usa localStorage para persistir los datos entre páginas.
 */

const STORAGE_KEY = "maru_products";

// Productos de ejemplo para la primera carga
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Set de velas aromáticas",
    category: "Iluminación",
    price: 12000,
    description:
      "Tres velas de soja con fragancias de lavanda, vainilla y sándalo. Perfectas para crear ambientes cálidos y acogedores en cualquier espacio del hogar.",
    emoji: "🕯️",
    images: [], // se llenará con URLs cuando el admin las cargue
  },
  {
    id: 2,
    name: "Maceta cerámica artesanal",
    category: "Plantas",
    price: 8500,
    description:
      "Maceta pintada a mano en tonos terrosos. Ideal para suculentas y plantas de interior. Cada pieza es única y puede tener variaciones mínimas.",
    emoji: "🪴",
    images: [],
  },
  {
    id: 3,
    name: "Cuadro boho minimalista",
    category: "Arte",
    price: 18000,
    description:
      "Impresión artística en lienzo, estilo boho con tonos neutros. Disponible en varios tamaños. Transforma cualquier pared en un punto focal del ambiente.",
    emoji: "🖼️",
    images: [],
  },
  {
    id: 4,
    name: "Cesta tejida de mimbre",
    category: "Textiles",
    price: 14500,
    description:
      "Cesta multifuncional tejida a mano con mimbre natural. Organiza con estilo o úsala como elemento decorativo en sala, dormitorio o baño.",
    emoji: "🧺",
    images: [],
  },
  {
    id: 5,
    name: "Espejo redondo con marco rattan",
    category: "Espejos",
    price: 22000,
    description:
      "Espejo decorativo de 60 cm con borde tejido en rattan natural. Un toque orgánico y elegante. Apto para colgar en pared o apoyar en piso.",
    emoji: "🪞",
    images: [],
  },
  {
    id: 6,
    name: "Flores secas en jarrón",
    category: "Flores",
    price: 16000,
    description:
      "Arreglo de pampas y flores secas en jarrón de barro pintado a mano. Sin mantenimiento, belleza duradera. Ideal para mesa o repisa.",
    emoji: "💐",
    images: [],
  },
];

// ── API pública ──────────────────────────────────────────

function getProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  // primera visita: carga los de ejemplo y los guarda
  saveProducts(DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS;
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function addProduct(product) {
  const products = getProducts();
  const newId = products.length
    ? Math.max(...products.map((p) => p.id)) + 1
    : 1;
  const newProduct = { ...product, id: newId };
  products.push(newProduct);
  saveProducts(products);
  return newProduct;
}

function updateProduct(id, data) {
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...data };
  saveProducts(products);
  return products[idx];
}

function deleteProduct(id) {
  const products = getProducts().filter((p) => p.id !== id);
  saveProducts(products);
}

function formatPrice(amount) {
  return "$" + Number(amount).toLocaleString("es-AR");
}
