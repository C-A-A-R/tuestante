/**
 * ==========================================================================
 * TUESTANTE - SERVICIO DE CARRITO DE COMPRAS INTERNO (CART SERVICE)
 * ==========================================================================
 * Gestiona el carrito en localStorage, validando disponibilidad física
 * de stock y el límite semanal por empleado (weekly_limit_per_employee).
 * Emite CustomEvents para sincronizar Navbar, Cart y ProductCard.
 */

const CART_STORAGE_KEY = 'te_employee_cart';

/**
 * Obtiene la lista actual de ítems en el carrito.
 * @returns {Array}
 */
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[CartService] Error leyendo carrito:', err);
    return [];
  }
}

/**
 * Guarda el carrito y emite el evento global de actualización.
 * @param {Array} cart 
 */
function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error('[CartService] Error guardando carrito:', err);
  }
  emitCartUpdate(cart);
}

/**
 * Emite un CustomEvent 'cart:updated' con los totales actuales.
 */
function emitCartUpdate(cart) {
  const totalUnits = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const subtotal = cart.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.quantity || 1)), 0);

  window.dispatchEvent(new CustomEvent('cart:updated', {
    detail: {
      count: totalUnits,
      totalUnits: totalUnits,
      itemsCount: cart.length,
      subtotal: subtotal,
      cart: cart
    }
  }));
}

/**
 * Agrega un producto al carrito respetando stock y cupo semanal.
 * @param {Object} product Objeto del producto
 * @param {number} quantity Cantidad a agregar
 * @returns {{ success: boolean, message?: string }}
 */
export function addToCart(product, quantity = 1) {
  if (!product || !product.id) {
    return { success: false, message: 'Producto no válido.' };
  }

  const stock = parseInt(product.stock, 10) || 0;
  const weeklyLimit = parseInt(product.weekly_limit_per_employee, 10) || 0;

  if (stock <= 0) {
    return { success: false, message: 'Este producto se encuentra agotado en bodega.' };
  }

  const cart = getCart();
  const existingIndex = cart.findIndex((i) => i.id === product.id);
  const currentQty = existingIndex > -1 ? cart[existingIndex].quantity : 0;
  const newQty = currentQty + quantity;

  // Validación de Stock Físico
  if (newQty > stock) {
    return {
      success: false,
      message: `Stock insuficiente. Solo quedan ${stock} unidades disponibles en bodega.`
    };
  }

  // Validación de Cupo Semanal
  if (weeklyLimit > 0 && newQty > weeklyLimit) {
    return {
      success: false,
      message: `Límite alcanzado. Solo se permiten hasta ${weeklyLimit} unidades por semana para este artículo.`
    };
  }

  if (existingIndex > -1) {
    cart[existingIndex].quantity = newQty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      price: parseFloat(product.price) || 0,
      stock: stock,
      weekly_limit_per_employee: weeklyLimit,
      subcategory_name: product.subcategory_name || product.category_name || '',
      image: product.image || '',
      quantity: quantity
    });
  }

  saveCart(cart);
  return { success: true };
}

/**
 * Actualiza la cantidad exacta de un producto en el carrito.
 * @param {number} productId 
 * @param {number} quantity 
 */
export function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const index = cart.findIndex((i) => i.id === productId);
  if (index === -1) return { success: false, message: 'Ítem no encontrado en el carrito.' };

  const item = cart[index];
  const stock = parseInt(item.stock, 10) || 0;
  const weeklyLimit = parseInt(item.weekly_limit_per_employee, 10) || 0;

  if (quantity <= 0) {
    return removeFromCart(productId);
  }

  if (quantity > stock) {
    return {
      success: false,
      message: `No puedes superar el stock físico de ${stock} unidades.`
    };
  }

  if (weeklyLimit > 0 && quantity > weeklyLimit) {
    return {
      success: false,
      message: `El límite semanal para este producto es de ${weeklyLimit} unidades.`
    };
  }

  item.quantity = quantity;
  saveCart(cart);
  return { success: true };
}

/**
 * Elimina un producto del carrito.
 * @param {number} productId 
 */
export function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter((i) => i.id !== productId);
  saveCart(cart);
  return { success: true };
}

/**
 * Vacía completamente el carrito.
 */
export function clearCart() {
  saveCart([]);
}

/**
 * Calcula el subtotal general del carrito.
 * @returns {number}
 */
export function getCartSubtotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);
}

/**
 * Retorna la suma total de unidades físicas agregadas.
 * @returns {number}
 */
export function getCartUnitsCount() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
}
