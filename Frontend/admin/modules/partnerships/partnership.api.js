/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIO API PARA EMPRESAS ALIADAS (PARTNERSHIP.API.JS)
 * ==========================================================================
 * Conexión directa y exclusiva con el backend Django REST Framework (/partnerships/).
 * Trabaja únicamente con datos reales del servidor, sin simulaciones locales ni datos falsos.
 */

import {
  getRequest,
  postRequest,
  patchRequest,
  deleteRequest,
  resolveImageUrl,
  extractList
} from '../../js/api.js';

// Limpieza de cualquier residuo previo de mock en localStorage
try {
  localStorage.removeItem('tu_admin_partnerships_items');
} catch (_) {}

/**
 * Normaliza un objeto de empresa aliada recibido desde el backend Django.
 */
function normalizePartnership(item) {
  if (!item) return null;
  const isActive = item.is_active !== undefined ? Boolean(item.is_active) : true;
  return {
    id: item.id,
    name: item.name || `Empresa #${item.id}`,
    logo: item.logo ? resolveImageUrl(item.logo) : '',
    logo_raw: item.logo || '',
    website: item.website || '',
    description: item.description || '',
    is_active: isActive,
    status: isActive ? 'Activo' : 'Inactivo',
    created_at: item.created_at || new Date().toISOString(),
    formatted_date: formatSimpleDate(item.created_at)
  };
}

/**
 * Formatea fechas a formato legible DD/MM/YYYY hh:mm A
 */
export function formatSimpleDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
  } catch (e) {
    return String(isoString);
  }
}

/**
 * Obtiene el listado completo de empresas aliadas directamente desde el backend.
 * @param {Object} [params] Filtros opcionales (is_active, search, etc.)
 * @returns {Promise<Array>} Listado real de empresas registradas.
 */
export async function getPartnerships(params = {}) {
  const res = await getRequest('/partnerships/', params, { auth: true });
  const list = extractList(res);
  if (!Array.isArray(list)) return [];
  return list.map(normalizePartnership).filter(Boolean);
}

/**
 * Obtiene una empresa aliada por su ID real desde el backend.
 * @param {number|string} id ID de la empresa en la base de datos
 * @returns {Promise<Object|null>} Objeto de la empresa o null
 */
export async function getPartnershipById(id) {
  const item = await getRequest(`/partnerships/${id}/`, {}, { auth: true });
  return normalizePartnership(item);
}

/**
 * Registra una nueva empresa aliada en el backend Django (POST /partnerships/).
 * Soporta FormData (con archivo logo) u objeto regular.
 * @param {FormData|Object} data Datos reales a enviar
 * @returns {Promise<Object>} Registro creado en la base de datos
 */
export async function createPartnership(data) {
  const res = await postRequest('/partnerships/', data, { auth: true });
  return normalizePartnership(res);
}

/**
 * Actualiza una empresa aliada existente en la base de datos (PATCH /partnerships/{id}/).
 * @param {number|string} id ID de la empresa
 * @param {FormData|Object} data Campos reales a actualizar
 * @returns {Promise<Object>} Registro actualizado
 */
export async function updatePartnership(id, data) {
  const res = await patchRequest(`/partnerships/${id}/`, data, { auth: true });
  return normalizePartnership(res);
}

/**
 * Alterna o actualiza el estado de la empresa (Activo / Inactivo).
 */
export async function updatePartnershipStatus(id, newStatusOrBool) {
  const isActive = typeof newStatusOrBool === 'boolean'
    ? newStatusOrBool
    : newStatusOrBool === 'Activo';

  return await updatePartnership(id, { is_active: isActive });
}

/**
 * Elimina una empresa aliada de la base de datos (DELETE /partnerships/{id}/).
 * @param {number|string} id ID de la empresa
 * @returns {Promise<boolean>}
 */
export async function deletePartnership(id) {
  await deleteRequest(`/partnerships/${id}/`, { auth: true });
  return true;
}

export { resolveImageUrl };
