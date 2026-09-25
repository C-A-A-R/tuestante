import { getRequest, postRequest, putRequest, patchRequest, deleteRequest, apiRequest } from '../../js/api.js';

export const obtenerProductos = (params) => getRequest('/products/products/', params);
export const obtenerProductosOutlet = (params = {}) => obtenerProductos({ ...params, outlet: true });
export const obtenerProductoPorId = (id) => getRequest(`/products/products/${id}/`);
export const obtenerTiposProducto = (params) => getRequest('/products/product-types/', params);
export const obtenerProductosDestacados = (params) => getRequest('/products/featured-products/', params);
export const obtenerFavoritosUsuario = (params) => getRequest('/products/favorites/', params);
export const alternarFavoritoProducto = (id) => postRequest(`/products/favorites/${id}/toggle/`);
export const crearProducto = (data) => postRequest('/products/products/', data);
export const actualizarProducto = (id, data) => putRequest(`/products/products/${id}/`, data);
export const actualizarParcialProducto = (id, data) => patchRequest(`/products/products/${id}/`, data);
export const eliminarProducto = (id) => deleteRequest(`/products/products/${id}/`);
export const exportarReporteProductos = (formato) => apiRequest({ path: '/products/products/exportar/', params: { format: formato } });
