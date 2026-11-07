/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIOS API DE GESTIÓN DE CLIENTES
 * ==========================================================================
 * Conexión centralizada con los endpoints del backend para el módulo
 * de clientes (User con rol cliente), KPIs estadísticos y reportes.
 */

import {
  getRequest,
  postRequest,
  patchRequest,
  deleteRequest,
  extractList,
  backendOrigin
} from '../../js/api.js';
import { getAccessToken } from '../../js/storage.js';

/**
 * Consulta la lista de clientes con soporte para búsqueda, filtros y paginación.
 * @param {Object} params - Parámetros de búsqueda { search, is_active, city, period, date_from, date_to, page, page_size, ordering }
 * @returns {Promise<Object>} Respuesta con count, results o lista de clientes
 */
export async function obtenerClientes(params = {}) {
  const query = {
    role: 'client',
    is_staff: false,
    ...params
  };

  // Limpiar parámetros vacíos o nulos
  Object.keys(query).forEach((key) => {
    if (
      query[key] === '' ||
      query[key] === null ||
      query[key] === undefined ||
      query[key] === 'all' ||
      query[key] === 'todas' ||
      query[key] === 'todos'
    ) {
      delete query[key];
    }
  });

  return await getRequest('/user/', query);
}

/**
 * Consulta las 5 métricas consolidadas para las tarjetas KPI superiores.
 * @returns {Promise<Object>} { total_clients, new_clients_this_month, growth_percentage, clients_with_orders, clients_with_orders_percentage, total_spent, total_orders, avg_ticket }
 */
export async function obtenerMetricasClientes() {
  try {
    const data = await getRequest('/user/metrics/');
    if (data && typeof data === 'object') {
      return data;
    }
  } catch (err) {
    console.warn('[Clients API] No se pudo obtener métricas del endpoint /user/metrics/, usando cálculo fallback:', err);
  }

  // Fallback si el endpoint falla
  return {
    total_clients: 0,
    new_clients_this_month: 0,
    growth_percentage: '0% vs mes anterior',
    clients_with_orders: 0,
    clients_with_orders_percentage: '0.0%',
    total_spent: 0.0,
    total_orders: 0,
    avg_ticket: 0.0
  };
}

/**
 * Obtiene la lista de ciudades disponibles para el filtro de ciudad.
 * @returns {Promise<string[]>}
 */
export async function obtenerCiudades() {
  try {
    const cities = await getRequest('/user/cities/');
    if (Array.isArray(cities) && cities.length > 0) {
      return cities;
    }
  } catch (err) {
    console.warn('[Clients API] No se pudo obtener ciudades del endpoint /user/cities/:', err);
  }

  return [
    'Barquisimeto',
    'Caracas',
    'Maracaibo',
    'Maracay',
    'Mérida',
    'Puerto La Cruz',
    'San Cristóbal',
    'Valencia'
  ];
}

/**
 * Obtiene el detalle individual de un cliente por su ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function obtenerDetalleCliente(id) {
  return await getRequest(`/user/${id}/`);
}

/**
 * Obtiene las órdenes o compras asociadas a un cliente.
 * @param {number|string} userId
 * @returns {Promise<Array>}
 */
export async function obtenerPedidosCliente(userId) {
  try {
    const res = await getRequest('/orders/', { user_id: userId, is_deleted: false });
    return extractList(res);
  } catch (err) {
    console.warn(`[Clients API] Error al obtener pedidos del cliente ${userId}:`, err);
    return [];
  }
}

/**
 * Crea un nuevo cliente desde el panel administrativo.
 * @param {Object} payload { first_name, second_name, first_last_name, second_last_name, identity_document, email, phone, city, state, is_active }
 * @returns {Promise<Object>}
 */
export async function crearCliente(payload) {
  return await postRequest('/user/', {
    ...payload,
    is_staff: false,
    is_superuser: false,
    is_registered: true
  });
}

export { crearCliente as createClient };

/**
 * Actualiza los datos de un cliente existente.
 * @param {number|string} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function actualizarCliente(id, payload) {
  return await patchRequest(`/user/${id}/`, payload);
}

/**
 * Elimina lógicamente a un cliente (desactivándolo).
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function eliminarCliente(id) {
  return await deleteRequest(`/user/${id}/`);
}

/**
 * Genera la URL del reporte de clientes.
 * @param {'excel'|'pdf'} tipo
 * @returns {string}
 */
export function obtenerUrlReporteClientes(tipo = 'excel') {
  const base = backendOrigin || window.__API_BASE_ORIGIN__ || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/api/user/reports/usuarios/?tipo=${tipo}&es_administrador=false`;
}

/**
 * Descarga autenticada del reporte de clientes (Excel o PDF) utilizando Bearer Token.
 * @param {'excel'|'pdf'} tipo Formato a descargar
 * @returns {Promise<Blob>}
 */
export async function descargarReporteClientes(tipo = 'excel') {
  const url = obtenerUrlReporteClientes(tipo);
  const token = getAccessToken();

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    throw new Error(`Error en descarga de reporte (${response.status}): ${response.statusText}`);
  }

  return await response.blob();
}
