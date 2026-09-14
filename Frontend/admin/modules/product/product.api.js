/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE PRODUCTOS (PRODUCT.API.JS) - TUESTANTE
 * Conexión centralizada con backend Django (/api/products/, /api/product-types/)
 * y banco de datos reactivo para el panel administrativo.
 * ==========================================================================
 */

import { getRequest, postRequest, patchRequest, putRequest, deleteRequest } from '../../js/api.js';

// ==========================================================================
// BANCO DE DATOS MOCK DE PRODUCTOS, VARIANTES Y MEDIOS
// ==========================================================================

let mockProductTypes = [
  {
    id: 1,
    product_type_name: 'Muebles de Madera',
    description: 'Productos fabricados principalmente en madera.',
    product_type_image: '../../assets/images/products/tipo-producto-estante.png',
    count: 22,
    is_active: true
  },
  {
    id: 2,
    product_type_name: 'Muebles de Metal',
    description: 'Productos fabricados principalmente en metal.',
    product_type_image: '../../assets/images/products/armario-blanco.png',
    count: 14,
    is_active: true
  },
  {
    id: 3,
    product_type_name: 'Muebles Mixtos',
    description: 'Productos combinados con madera, metal y otros materiales.',
    product_type_image: '../../assets/images/products/armario blanco una puerta.jpeg',
    count: 16,
    is_active: true
  },
  {
    id: 4,
    product_type_name: 'Accesorios y Decoración',
    description: 'Accesorios decorativos y artículos complementarios.',
    product_type_image: '../../assets/images/logo.jpeg',
    count: 19,
    is_active: true
  }
];


let mockProducts = [
  {
    id: 1,
    product_name: 'Estante Modular Roble Nórdico',
    description: 'Estante de madera con estructura reforzada para sala, biblioteca y oficina.',
    product_type: 'Mobiliario Modular',
    product_type_id: 1,
    price: 150.00,
    price_ves: 5475.00,
    is_active: true,
    is_outlet: false,
    is_feature_product: true,
    favorites_count: 14,
    height_cm: 180.0,
    width_cm: 80.0,
    depth_cm: 30.0,
    security: 'Anclaje a pared incluido (soporta hasta 120 kg)',
    product_image: '../../assets/images/products/tipo-producto-estante.png',
    product_video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    angle_images: [
      { id: 101, angle: 'Vista Frontal', image: '../../assets/images/products/tipo-producto-estante.png' },
      { id: 102, angle: 'Vista Lateral', image: '../../assets/images/products/armario-blanco.png' },
      { id: 103, angle: 'Perspectiva 3/4', image: '../../assets/images/products/tipo-producto-estante.png' }
    ],
    color_images: [
      { id: 201, color_name: 'Madera Natural', color_hex: '#A67C52', color_image: '../../assets/images/products/tipo-producto-estante.png' },
      { id: 202, color_name: 'Negro Mate', color_hex: '#101010', color_image: '../../assets/images/products/armario-blanco.png' },
      { id: 203, color_name: 'Blanco Polar', color_hex: '#FFFFFF', color_image: '../../assets/images/products/armario blanco una puerta.jpeg' },
      { id: 204, color_name: 'Gris Grafito', color_hex: '#4A4A4A', color_image: '../../assets/images/products/locker 5 puertas verde con entrada de aire verde con candado.jpeg' }
    ]
  },
  {
    id: 2,
    product_name: 'Mesa de Trabajo Ergonómica',
    description: 'Mesa rectangular de madera y perfilería de acero para comedor, estudio o coworking.',
    product_type: 'Mobiliario Modular',
    product_type_id: 1,
    price: 220.00,
    price_ves: 8030.00,
    is_active: true,
    is_outlet: false,
    is_feature_product: false,
    favorites_count: 8,
    height_cm: 75.0,
    width_cm: 140.0,
    depth_cm: 80.0,
    security: 'Patas niveladoras con regatón antideslizante',
    product_image: '../../assets/images/products/armario-blanco.png',
    product_video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    angle_images: [
      { id: 104, angle: 'Perspectiva 3/4', image: '../../assets/images/products/armario-blanco.png' },
      { id: 105, angle: 'Vista Frontal', image: '../../assets/images/products/tipo-producto-estante.png' }
    ],
    color_images: [
      { id: 205, color_name: 'Roble Claro', color_hex: '#C49A6C', color_image: '../../assets/images/products/armario-blanco.png' },
      { id: 206, color_name: 'Nogal Oscuro', color_hex: '#5A3825', color_image: '../../assets/images/products/tipo-producto-estante.png' },
      { id: 207, color_name: 'Blanco Ártico', color_hex: '#F8F9FA', color_image: '../../assets/images/products/armario blanco una puerta.jpeg' }
    ]
  },
  {
    id: 3,
    product_name: 'Soporte Escuadra Reforzado',
    description: 'Accesorio metálico reforzado para soporte de carga pesada.',
    product_type: 'Accesorios y Repuestos',
    product_type_id: 3,
    price: 50.00,
    price_ves: 1825.00,
    is_active: true,
    is_outlet: true,
    is_feature_product: false,
    favorites_count: 0,
    height_cm: 15.0,
    width_cm: 20.0,
    depth_cm: 5.0,
    security: 'Tratamiento anticorrosivo electrostático',
    product_image: '../../assets/images/logo.jpeg',
    product_video: '',
    angle_images: [
      { id: 106, angle: 'Vista Frontal', image: '../../assets/images/logo.jpeg' }
    ],
    color_images: [
      { id: 208, color_name: 'Negro Mate', color_hex: '#1C1C1C', color_image: '../../assets/images/logo.jpeg' },
      { id: 209, color_name: 'Cromo Plateado', color_hex: '#D1D5DB', color_image: '../../assets/images/logo.jpeg' }
    ]
  },
  {
    id: 4,
    product_name: 'Locker 5 Puertas Verde Industrial',
    description: 'Casillero metálico ventilado con porta candado individual y rejillas de aireación.',
    product_type: 'Almacenamiento Metálico',
    product_type_id: 2,
    price: 320.00,
    price_ves: 11680.00,
    is_active: true,
    is_outlet: false,
    is_feature_product: true,
    favorites_count: 23,
    height_cm: 190.0,
    width_cm: 40.0,
    depth_cm: 45.0,
    security: 'Cerradura porta-candado reforzada',
    product_image: '../../assets/images/products/locker 5 puertas verde con entrada de aire verde con candado.jpeg',
    product_video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    angle_images: [
      { id: 107, angle: 'Vista Frontal Cerrado', image: '../../assets/images/products/locker 5 puertas verde con entrada de aire verde con candado.jpeg' },
      { id: 108, angle: 'Puertas Abiertas', image: '../../assets/images/products/locker multi color 4 puertas con candado.jpeg' },
      { id: 109, angle: 'Detalle Ventilación', image: '../../assets/images/products/locker 6 puertas rosado con candado.jpeg' }
    ],
    color_images: [
      { id: 210, color_name: 'Verde Industrial', color_hex: '#2E7D32', color_image: '../../assets/images/products/locker 5 puertas verde con entrada de aire verde con candado.jpeg' },
      { id: 211, color_name: 'Rosa Magenta', color_hex: '#E91E63', color_image: '../../assets/images/products/locker 6 puertas rosado con candado.jpeg' },
      { id: 212, color_name: 'Multicolor', color_hex: '#F59E0B', color_image: '../../assets/images/products/locker multi color 4 puertas con candado.jpeg' }
    ]
  },
  {
    id: 5,
    product_name: 'Armario Ejecutivo 1 Puerta',
    description: 'Armario archivador para oficina, despacho contable y taller de herramientas.',
    product_type: 'Almacenamiento Metálico',
    product_type_id: 2,
    price: 280.00,
    price_ves: 10220.00,
    is_active: false,
    is_outlet: true,
    is_feature_product: false,
    favorites_count: 3,
    height_cm: 185.0,
    width_cm: 60.0,
    depth_cm: 45.0,
    security: 'Cerradura con llave maestra y duplicado',
    product_image: '../../assets/images/products/armario blanco una puerta.jpeg',
    product_video: '',
    angle_images: [
      { id: 110, angle: 'Vista Frontal', image: '../../assets/images/products/armario blanco una puerta.jpeg' },
      { id: 111, angle: 'Estantería Interna', image: '../../assets/images/products/armario-blanco.png' }
    ],
    color_images: [
      { id: 213, color_name: 'Blanco Puro', color_hex: '#FFFFFF', color_image: '../../assets/images/products/armario blanco una puerta.jpeg' },
      { id: 214, color_name: 'Gris Claro', color_hex: '#9CA3AF', color_image: '../../assets/images/products/armario-blanco.png' }
    ]
  },
  {
    id: 6,
    product_name: 'Locker 6 Puertas Rosado Pastel',
    description: 'Locker modular para vestuarios, academias deportivas y escuelas.',
    product_type: 'Almacenamiento Metálico',
    product_type_id: 2,
    price: 350.00,
    price_ves: 12775.00,
    is_active: true,
    is_outlet: false,
    is_feature_product: true,
    favorites_count: 19,
    height_cm: 190.0,
    width_cm: 60.0,
    depth_cm: 45.0,
    security: 'Refuerzo perimetral antivandálico',
    product_image: '../../assets/images/products/locker 6 puertas rosado con candado.jpeg',
    product_video: '',
    angle_images: [
      { id: 112, angle: 'Vista Frontal', image: '../../assets/images/products/locker 6 puertas rosado con candado.jpeg' }
    ],
    color_images: [
      { id: 215, color_name: 'Rosado Pastel', color_hex: '#F472B6', color_image: '../../assets/images/products/locker 6 puertas rosado con candado.jpeg' }
    ]
  }
];

// ==========================================================================
// FUNCIONES API EXPORTADAS
// ==========================================================================

/**
 * Normaliza los productos devueltos por el backend Django
 */
function normalizeBackendProduct(p) {
  const typeName = p.product_type_detail?.product_type_name || p.product_type_name || 'Mobiliario Modular';

  return {
    id: p.id,
    product_name: p.product_name,
    description: p.description || '',
    product_type: typeName,
    product_type_id: p.product_type || p.product_type_id || 1,
    price: parseFloat(p.price) || 0,
    price_ves: (parseFloat(p.price) || 0) * 36.50,
    is_active: p.is_deleted === false && (p.is_active !== undefined ? p.is_active : true),
    is_outlet: Boolean(p.is_outlet),
    is_feature_product: Boolean(p.is_feature_product),
    favorites_count: p.favorites_count !== undefined ? p.favorites_count : (p.favorite_count || p.wishlist_count || 0),
    height_cm: parseFloat(p.height_cm) || 0,
    width_cm: parseFloat(p.width_cm) || 0,
    depth_cm: parseFloat(p.depth_cm) || 0,
    security: p.security || '',
    product_image: p.product_image || '../../assets/images/products/tipo-producto-estante.png',
    product_video: p.product_video || '',
    angle_images: Array.isArray(p.angle_images) ? p.angle_images.map(a => ({
      id: a.id || Math.random(),
      angle: a.angle || 'Vista',
      image: a.image || p.product_image || '../../assets/images/products/tipo-producto-estante.png'
    })) : [],
    color_images: Array.isArray(p.color_images) ? p.color_images.map(c => ({
      id: c.id || Math.random(),
      color_name: c.color_name || 'Color',
      color_hex: c.color_hex || '#101010',
      color_image: c.color_image || c.image || p.product_image || '../../assets/images/products/tipo-producto-estante.png'
    })) : []
  };
}

/**
 * Obtiene la lista de productos con filtros reactivos (búsqueda, tipo, outlet, estado, destacados/favoritos)
 */
export async function getProducts(params = {}) {
  try {
    const res = await getRequest('/products/', { params, auth: true });
    if (Array.isArray(res)) {
      return res.map(normalizeBackendProduct);
    }
    if (res && Array.isArray(res.results)) {
      return res.results.map(normalizeBackendProduct);
    }
  } catch (err) {
    console.warn('[TuEstante Product API] Fallo al consultar backend, usando banco mock de productos:', err);
  }

  let result = [...mockProducts];

  // Filtro por término de búsqueda (nombre, tipo, descripción)
  if (params.search) {
    const term = params.search.toLowerCase().trim();
    result = result.filter(p => 
      p.product_name.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term) ||
      p.product_type.toLowerCase().includes(term)
    );
  }

  // Filtro por tipo de producto
  if (params.type && params.type !== 'all') {
    const typeId = parseInt(params.type, 10);
    const typeTerm = params.type.toString().toLowerCase().trim();
    result = result.filter(p => p.product_type_id === typeId || p.product_type.toLowerCase() === typeTerm);
  }

  // Filtro por outlet
  if (params.outlet !== undefined && params.outlet !== 'all') {
    const isOutlet = params.outlet === 'true' || params.outlet === true;
    result = result.filter(p => p.is_outlet === isOutlet);
  }

  // Filtro por destacados / favoritos
  if (params.featured && params.featured !== 'all') {
    if (params.featured === 'featured') {
      result = result.filter(p => p.is_feature_product);
    } else if (params.featured === 'favorites') {
      result = result.filter(p => p.favorites_count && p.favorites_count > 0);
    }
  }

  // Filtro por estado (activo / inactivo)
  if (params.status && params.status !== 'all') {
    if (params.status === 'active') {
      result = result.filter(p => p.is_active);
    } else if (params.status === 'inactive') {
      result = result.filter(p => !p.is_active);
    }
  }

  return result;
}

/**
 * Obtiene un producto por su ID
 */
export async function getProduct(id) {
  try {
    const res = await getRequest(`/products/${id}/`, { auth: true });
    if (res && res.id) {
      return normalizeBackendProduct(res);
    }
  } catch (err) {
    console.warn(`[TuEstante Product API] Error al obtener producto #${id}, usando mock:`, err);
  }

  const found = mockProducts.find(p => p.id === parseInt(id, 10));
  if (found) return found;
  throw new Error(`Producto #${id} no encontrado.`);
}

/**
 * Registra un nuevo producto con variantes de color y ángulos
 */
export async function createProduct(data = {}) {
  try {
    const res = await postRequest('/products/', data, { auth: true });
    if (res && res.id) {
      return normalizeBackendProduct(res);
    }
  } catch (err) {
    console.warn('[TuEstante Product API] Fallo al crear en backend, creando en mock:', err);
  }

  const newId = mockProducts.length > 0 
    ? Math.max(...mockProducts.map(p => p.id)) + 1 
    : 1;

  const typeObj = mockProductTypes.find(t => t.id === parseInt(data.product_type || data.product_type_id, 10));
  const typeName = typeObj ? typeObj.product_type_name : (data.product_type_name || 'Mobiliario Modular');

  const newProduct = {
    id: newId,
    product_name: data.product_name || 'Nuevo Producto',
    description: data.description || '',
    product_type: typeName,
    product_type_id: parseInt(data.product_type || data.product_type_id, 10) || 1,
    price: parseFloat(data.price) || 100.00,
    price_ves: (parseFloat(data.price) || 100.00) * 36.50,
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    is_outlet: Boolean(data.is_outlet),
    is_feature_product: Boolean(data.is_feature_product),
    height_cm: parseFloat(data.height_cm) || 0,
    width_cm: parseFloat(data.width_cm) || 0,
    depth_cm: parseFloat(data.depth_cm) || 0,
    security: data.security || '',
    product_image: data.product_image || '../../assets/images/products/tipo-producto-estante.png',
    product_video: data.product_video || '',
    angle_images: Array.isArray(data.angle_images) && data.angle_images.length > 0 
      ? data.angle_images.map((a, idx) => ({ id: newId * 100 + idx + 1, angle: a.angle || `Ángulo ${idx + 1}`, image: a.image || data.product_image }))
      : [{ id: newId * 100 + 1, angle: 'Vista Frontal', image: data.product_image || '../../assets/images/products/tipo-producto-estante.png' }],
    color_images: Array.isArray(data.color_images) && data.color_images.length > 0
      ? data.color_images.map((c, idx) => ({ id: newId * 200 + idx + 1, color_name: c.color_name || `Color ${idx + 1}`, color_hex: c.color_hex || '#101010', color_image: c.color_image || c.image || data.product_image }))
      : [{ id: newId * 200 + 1, color_name: 'Estándar', color_hex: '#101010', color_image: data.product_image || '../../assets/images/products/tipo-producto-estante.png' }]
  };

  mockProducts.unshift(newProduct);
  return newProduct;
}

/**
 * Actualiza un producto existente
 */
export async function updateProduct(id, data = {}) {
  try {
    const res = await patchRequest(`/products/${id}/`, data, { auth: true });
    if (res && res.id) {
      return normalizeBackendProduct(res);
    }
  } catch (err) {
    console.warn(`[TuEstante Product API] Error al actualizar #${id}, aplicando en mock:`, err);
  }

  const product = mockProducts.find(p => p.id === parseInt(id, 10));
  if (!product) throw new Error(`Producto #${id} no encontrado.`);

  Object.assign(product, data);
  if (data.price !== undefined) {
    product.price_ves = product.price * 36.50;
  }
  return product;
}

/**
 * Alterna el estado activo/inactivo de un producto
 */
export async function toggleProductActive(id) {
  const product = mockProducts.find(p => p.id === parseInt(id, 10));
  if (!product) throw new Error(`Producto #${id} no encontrado.`);

  const newStatus = !product.is_active;

  try {
    await patchRequest(`/products/${id}/`, { is_active: newStatus }, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Product API] Toggle en backend falló, aplicando en mock:`, err);
  }

  product.is_active = newStatus;
  return product;
}

/**
 * Alterna el estado de outlet de un producto
 */
export async function toggleProductOutlet(id) {
  const product = mockProducts.find(p => p.id === parseInt(id, 10));
  if (!product) throw new Error(`Producto #${id} no encontrado.`);

  const newStatus = !product.is_outlet;

  try {
    await patchRequest(`/products/${id}/`, { is_outlet: newStatus }, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Product API] Toggle outlet falló, aplicando en mock:`, err);
  }

  product.is_outlet = newStatus;
  return product;
}

/**
 * Elimina un producto (borrado lógico o físico)
 */
export async function deleteProduct(id) {
  try {
    await deleteRequest(`/products/${id}/`, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Product API] Fallo al eliminar en backend, eliminando en mock:`, err);
  }

  const idx = mockProducts.findIndex(p => p.id === parseInt(id, 10));
  if (idx !== -1) {
    mockProducts.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Obtiene métricas superiores de resumen de productos (KPI cards: Total, Destacados, Favoritos, Activos, Inactivos, Outlet)
 */
export async function getProductMetrics() {
  let active = 0;
  let inactive = 0;
  let outlet = 0;
  let featured = 0;
  let favorites = 0;

  mockProducts.forEach(p => {
    if (!p.is_active) inactive++;
    else active++;
    if (p.is_outlet) outlet++;
    if (p.is_feature_product) featured++;
    if (p.favorites_count && p.favorites_count > 0) favorites += p.favorites_count;
  });

  return {
    total: mockProducts.length,
    active,
    inactive,
    outlet,
    featured,
    favorites
  };
}

/**
 * Obtiene la lista de tipos de productos
 */
export async function getProductTypes() {
  try {
    const res = await getRequest('/products/product-types/', { auth: true });
    let items = [];
    if (Array.isArray(res)) items = res;
    else if (res && Array.isArray(res.results)) items = res.results;

    if (items.length > 0) {
      return items.map(t => ({
        id: t.id,
        product_type_name: t.product_type_name,
        description: t.description || '',
        product_type_image: t.product_type_image || '../../assets/images/logo.jpeg',
        count: t.products_count !== undefined ? t.products_count : (t.count || 0),
        is_active: t.is_active !== undefined ? t.is_active : true
      }));
    }
  } catch (err) {
    console.warn('[TuEstante Product API] Usando tipos mock:', err);
  }
  return mockProductTypes;
}

/**
 * Obtiene un tipo de producto específico por su ID
 */
export async function getProductType(id) {
  try {
    const res = await getRequest(`/products/product-types/${id}/`, { auth: true });
    if (res && res.id) return res;
  } catch (err) {
    console.warn(`[TuEstante Product API] Fallo al obtener tipo ${id} de backend, buscando en mock:`, err);
  }
  return mockProductTypes.find(t => String(t.id) === String(id)) || null;
}

/**
 * Crea un nuevo tipo de producto
 */
export async function createProductType(data) {
  try {
    const res = await postRequest('/products/product-types/', data, { auth: true });
    if (res && res.id) {
      mockProductTypes.unshift({
        id: res.id,
        product_type_name: res.product_type_name,
        description: res.description || '',
        product_type_image: res.product_type_image || '../../assets/images/logo.jpeg',
        count: 0,
        is_active: true
      });
      return res;
    }
  } catch (err) {
    console.warn('[TuEstante Product API] Fallo al crear en backend, creando en mock:', err);
  }

  // Fallback local mock
  const newId = mockProductTypes.length ? Math.max(...mockProductTypes.map(t => t.id)) + 1 : 1;
  const name = (data instanceof FormData) ? data.get('product_type_name') : data.product_type_name;
  const desc = (data instanceof FormData) ? data.get('description') : data.description;
  const image = (data instanceof FormData) ? (data.get('product_type_image_url') || '../../assets/images/logo.jpeg') : (data.product_type_image || '../../assets/images/logo.jpeg');

  const newType = {
    id: newId,
    product_type_name: name || `Tipo #${newId}`,
    description: desc || '',
    product_type_image: image,
    count: 0,
    is_active: true
  };
  mockProductTypes.unshift(newType);
  return newType;
}

/**
 * Actualiza un tipo de producto existente
 */
export async function updateProductType(id, data) {
  try {
    const res = await patchRequest(`/products/product-types/${id}/`, data, { auth: true });
    if (res && res.id) {
      const idx = mockProductTypes.findIndex(t => String(t.id) === String(id));
      if (idx !== -1) {
        mockProductTypes[idx] = { ...mockProductTypes[idx], ...res };
      }
      return res;
    }
  } catch (err) {
    console.warn(`[TuEstante Product API] Fallo al actualizar en backend, actualizando en mock:`, err);
  }

  const idx = mockProductTypes.findIndex(t => String(t.id) === String(id));
  if (idx !== -1) {
    const name = (data instanceof FormData) ? data.get('product_type_name') : data.product_type_name;
    const desc = (data instanceof FormData) ? data.get('description') : data.description;
    const img = (data instanceof FormData) ? data.get('product_type_image_url') : data.product_type_image;

    if (name) mockProductTypes[idx].product_type_name = name;
    if (desc !== undefined) mockProductTypes[idx].description = desc;
    if (img) mockProductTypes[idx].product_type_image = img;
    return mockProductTypes[idx];
  }
  return null;
}

/**
 * Elimina un tipo de producto
 */
export async function deleteProductType(id) {
  try {
    await deleteRequest(`/products/product-types/${id}/`, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Product API] Fallo al eliminar en backend, eliminando en mock:`, err);
  }

  const idx = mockProductTypes.findIndex(t => String(t.id) === String(id));
  if (idx !== -1) {
    mockProductTypes.splice(idx, 1);
    return true;
  }
  return false;
}


