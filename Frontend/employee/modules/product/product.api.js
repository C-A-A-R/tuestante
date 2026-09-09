/**
 * ==========================================================================
 * TUESTANTE - SERVICIO API DE PRODUCTOS Y CATEGORÍAS (EMPLOYEE STORE)
 * ==========================================================================
 * Centraliza las conexiones al backend para catálogo de productos internos,
 * búsqueda por código de barras, filtros y categorías.
 */

import { getRequest, extractList } from '../../../cliente/js/api.js';

/**
 * Consulta el catálogo de productos internos con filtros opcionales.
 * @param {Object} [params] { search, subcategory_id, category_id, in_stock, is_active }
 * @returns {Promise<Array>} Lista normalizada de productos
 */
export async function obtenerProductos(params = {}) {
  const response = await getRequest('/employee-store/products/', params);
  return extractList(response);
}

/**
 * Obtiene el detalle completo de un producto por su ID.
 * @param {number|string} productId 
 * @returns {Promise<Object>}
 */
export async function obtenerProductoPorId(productId) {
  return await getRequest(`/employee-store/products/${productId}/`);
}

/**
 * Búsqueda de producto por código de barras exacto.
 * @param {string} barcode 
 * @returns {Promise<Object|null>}
 */
export async function obtenerProductoPorBarcode(barcode) {
  const response = await getRequest('/employee-store/products/', { barcode: String(barcode).trim() });
  const list = extractList(response);
  return list.length > 0 ? list[0] : null;
}

/**
 * Obtiene productos relacionados que compartan la misma subcategoría excluyendo un ID.
 * @param {number|string} subcategoryId 
 * @param {number|string} excludeId 
 * @returns {Promise<Array>}
 */
export async function obtenerProductosRelacionados(subcategoryId, excludeId) {
  if (!subcategoryId) return [];
  const raw = await getRequest('/employee-store/products/', {
    subcategory_id: subcategoryId,
    is_active: true
  });
  const list = extractList(raw);
  return list.filter((item) => String(item.id) !== String(excludeId));
}

/**
 * Obtiene todas las categorías internas con sus subcategorías anidadas.
 * @returns {Promise<Array>}
 */
export async function obtenerCategorias() {
  const response = await getRequest('/employee-store/categories/');
  return extractList(response);
}

/**
 * Obtiene el listado de subcategorías internas.
 * @param {Object} [params] { category }
 * @returns {Promise<Array>}
 */
export async function obtenerSubcategorias(params = {}) {
  const response = await getRequest('/employee-store/subcategories/', params);
  return extractList(response);
}
