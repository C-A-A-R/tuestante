import { getRequest, postRequest, putRequest, patchRequest, deleteRequest, apiRequest } from '../../js/api.js';

export { extractList, resolveImageUrl } from '../../js/api.js';

/**
 * Obtiene la lista de productos del servidor, con filtros opcionales.
 * @param {Object} [params] Parámetros de búsqueda o filtrado.
 * @returns {Promise<Object>} Respuesta con el listado de productos.
 */
export async function obtenerProductos(params = {}) {
  return getRequest('/products/products/', params, { auth: false });
}

/**
 * Obtiene el detalle de un producto específico por su ID.
 * @param {number|string} id ID del producto.
 * @param {Object} [params] Parámetros opcionales.
 * @returns {Promise<Object>} Detalle del producto.
 */
export async function obtenerProductoPorId(id, params = {}) {
  return getRequest(`/products/products/${id}/`, params, { auth: false });
}

/**
 * Obtiene la lista de categorías de productos.
 * @param {Object} [params] Parámetros de consulta opcionales.
 * @returns {Promise<Object>} Lista de categorías.
 */
export async function obtenerCategorias(params = {}) {
  return getRequest('/products/categories/', params, { auth: false });
}

/**
 * Obtiene la lista de tipos de producto.
 * @param {Object} [params] Parámetros de consulta opcionales.
 * @returns {Promise<Object>} Lista de tipos de producto.
 */
export async function obtenerTiposProducto(params = {}) {
  return getRequest('/products/product-types/', params, { auth: false });
}

/**
 * Obtiene la lista de productos destacados.
 * @param {Object} [params] Parámetros de consulta opcionales.
 * @returns {Promise<Object>} Lista de productos destacados.
 */
export async function obtenerProductosDestacados(params = {}) {
  return getRequest('/products/featured-products/', params, { auth: false });
}

/**
 * Registra un nuevo producto en el sistema.
 * @param {Object} datosProducto Información del producto a crear.
 * @returns {Promise<Object>} Datos del producto creado.
 */
export async function crearProducto(datosProducto) {
  return postRequest('/products/products/', datosProducto);
}

/**
 * Actualiza la información de un producto existente.
 * @param {number|string} id ID del producto.
 * @param {Object} datosProducto Nuevos datos del producto.
 * @returns {Promise<Object>} Datos del producto actualizado.
 */
export async function actualizarProducto(id, datosProducto) {
  return putRequest(`/products/products/${id}/`, datosProducto);
}

/**
 * Actualiza parcialmente la información de un producto.
 * @param {number|string} id ID del producto.
 * @param {Object} datosProducto Campos a modificar.
 * @returns {Promise<Object>} Datos del producto actualizado.
 */
export async function actualizarParcialProducto(id, datosProducto) {
  return patchRequest(`/products/products/${id}/`, datosProducto);
}

/**
 * Elimina un producto del sistema.
 * @param {number|string} id ID del producto a eliminar.
 * @returns {Promise<null|Object>} Confirmación de eliminación.
 */
export async function eliminarProducto(id) {
  return deleteRequest(`/products/products/${id}/`);
}

/**
 * Solicita la generación y descarga del reporte de productos.
 * @param {string} formato Formato del reporte ('pdf' o 'excel').
 * @returns {Promise<{blob: Blob, headers: Headers}>} Archivo blob y cabeceras.
 */
export async function exportarReporteProductos(formato) {
  return apiRequest({
    path: '/products/products/exportar/',
    method: 'GET',
    params: { format: formato },
    auth: true
  });
}
