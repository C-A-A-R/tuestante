/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIO API PARA EMPRESAS ALIADAS (PARTNERSHIP.API.JS)
 * ==========================================================================
 * Conexión centralizada con el backend Django (/partnerships/)
 * con contingencia local y persistencia para administración fluida.
 */

import {
  getRequest,
  postRequest,
  patchRequest,
  deleteRequest,
  resolveImageUrl,
  extractList
} from '../../js/api.js';

// Clave para almacenamiento local de empresas aliadas
const STORAGE_KEY_PARTNERSHIPS = 'tu_admin_partnerships_items';

/**
 * Obtiene las empresas almacenadas localmente.
 */

function getLocalPartnerships() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARTNERSHIPS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[TuEstante Partnerships API] Error leyendo localStorage:', e);
  }
  return [];
}

/**
 * Guarda las empresas en LocalStorage.
 */
function saveLocalPartnerships(items) {
  try {
    localStorage.setItem(STORAGE_KEY_PARTNERSHIPS, JSON.stringify(items || []));
  } catch (e) {
    console.warn('[TuEstante Partnerships API] Error guardando localStorage:', e);
  }
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
 * Obtiene el listado completo de empresas aliadas.
 * Consulta al backend Django (/partnerships/); si responde (incluso con 0 registros),
 * esa es la fuente de verdad. Solo si el backend falla por red se usa la copia local.
 */
export async function getPartnerships(params = {}) {
  let backendItems = null;

  try {
    const res = await getRequest('/partnerships/', params, { auth: true });
    const list = extractList(res);
    if (Array.isArray(list)) {
      backendItems = list;
    }
  } catch (err) {
    console.warn('[TuEstante Partnerships API] Backend /partnerships/ no disponible o error:', err);
  }

  // Si el backend respondió (incluso si está vacío con 0 registros en la BD), esa es la verdad
  if (backendItems !== null) {
    const normalized = backendItems.map(item => {
      const isActive = item.is_active !== undefined ? Boolean(item.is_active) : true;
      const logoUrl = item.logo ? resolveImageUrl(item.logo) : '';

      return {
        id: item.id,
        name: item.name || `Empresa #${item.id}`,
        logo: logoUrl,
        logo_raw: item.logo || '',
        website: item.website || '',
        description: item.description || '',
        is_active: isActive,
        status: isActive ? 'Activo' : 'Inactivo',
        created_at: item.created_at || new Date().toISOString(),
        formatted_date: formatSimpleDate(item.created_at)
      };
    });

    saveLocalPartnerships(normalized);
    return normalized;
  }

  // Si no hubo respuesta del backend (ej. sin conexión), retornamos la copia local previa
  return getLocalPartnerships();
}


/**
 * Obtiene una empresa por su ID.
 */
export async function getPartnershipById(id) {
  try {
    const item = await getRequest(`/partnerships/${id}/`, {}, { auth: true });
    if (item && item.id) {
      const isActive = item.is_active !== undefined ? Boolean(item.is_active) : true;
      return {
        id: item.id,
        name: item.name,
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
  } catch (err) {
    console.warn(`[TuEstante Partnerships API] Fallback para empresa #${id}`);
  }

  const local = getLocalPartnerships();
  return local.find(i => String(i.id) === String(id)) || null;
}

/**
 * Crea una nueva empresa aliada (POST /partnerships/).
 * Soporta tanto FormData (para envío de imágenes de logo) como objeto regular.
 */
export async function createPartnership(data) {
  let createdBackend = null;

  try {
    createdBackend = await postRequest('/partnerships/', data, { auth: true });
  } catch (err) {
    console.warn('[TuEstante Partnerships API] Error en postRequest /partnerships/:', err);
    // Si el error fue por validación o de red, propagar si es relevante o registrar localmente
    if (err && err.status && err.status >= 400 && err.status < 500) {
      throw err;
    }
  }

  const items = getLocalPartnerships();
  const nextId = items.length > 0 ? Math.max(...items.map(i => Number(i.id) || 0)) + 1 : 1;

  let name = '';
  let website = '';
  let description = '';
  let logoUrl = '';
  let isActive = true;

  if (data instanceof FormData) {
    name = data.get('name') || '';
    website = data.get('website') || '';
    description = data.get('description') || '';
    const activeVal = data.get('is_active');
    isActive = activeVal === 'true' || activeVal === true || activeVal === '1' || activeVal === 'on';

    const logoFile = data.get('logo');
    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      logoUrl = URL.createObjectURL(logoFile);
    }
  } else if (typeof data === 'object') {
    name = data.name || '';
    website = data.website || '';
    description = data.description || '';
    isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;
    logoUrl = data.logo || '';
  }

  if (createdBackend && createdBackend.id) {
    const isAct = createdBackend.is_active !== undefined ? Boolean(createdBackend.is_active) : true;
    const finalItem = {
      id: createdBackend.id,
      name: createdBackend.name || name,
      logo: createdBackend.logo ? resolveImageUrl(createdBackend.logo) : logoUrl,
      logo_raw: createdBackend.logo || '',
      website: createdBackend.website || website,
      description: createdBackend.description || description,
      is_active: isAct,
      status: isAct ? 'Activo' : 'Inactivo',
      created_at: createdBackend.created_at || new Date().toISOString(),
      formatted_date: formatSimpleDate(createdBackend.created_at)
    };

    items.unshift(finalItem);
    saveLocalPartnerships(items);
    return finalItem;
  }

  // Respaldo local
  const now = new Date();
  const newPartner = {
    id: nextId,
    name: name || `Empresa #${nextId}`,
    logo: logoUrl,
    logo_raw: '',
    website: website,
    description: description || 'Sin descripción',
    is_active: isActive,
    status: isActive ? 'Activo' : 'Inactivo',
    created_at: now.toISOString(),
    formatted_date: formatSimpleDate(now)
  };

  items.unshift(newPartner);
  saveLocalPartnerships(items);
  return newPartner;
}

/**
 * Actualiza una empresa aliada existente (PATCH /partnerships/{id}/).
 */
export async function updatePartnership(id, data) {
  let backendItem = null;

  try {
    backendItem = await patchRequest(`/partnerships/${id}/`, data, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Partnerships API] Error en patchRequest /partnerships/${id}/:`, err);
    if (err && err.status && err.status >= 400 && err.status < 500) {
      throw err;
    }
  }

  const items = getLocalPartnerships();
  const idx = items.findIndex(i => String(i.id) === String(id));

  let name = '';
  let website = '';
  let description = '';
  let logoUrl = null;
  let isActive = undefined;

  if (data instanceof FormData) {
    name = data.get('name');
    website = data.get('website');
    description = data.get('description');
    const actVal = data.get('is_active');
    if (actVal !== null) {
      isActive = actVal === 'true' || actVal === true || actVal === '1' || actVal === 'on';
    }
    const logoFile = data.get('logo');
    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      logoUrl = URL.createObjectURL(logoFile);
    }
  } else if (typeof data === 'object') {
    name = data.name;
    website = data.website;
    description = data.description;
    isActive = data.is_active;
    if (data.logo) logoUrl = data.logo;
  }

  if (backendItem && backendItem.id) {
    const isAct = backendItem.is_active !== undefined ? Boolean(backendItem.is_active) : true;
    const updated = {
      id: backendItem.id,
      name: backendItem.name || name || '',
      logo: backendItem.logo ? resolveImageUrl(backendItem.logo) : (logoUrl || (idx >= 0 ? items[idx].logo : '')),
      logo_raw: backendItem.logo || '',
      website: backendItem.website || website || '',
      description: backendItem.description || description || '',
      is_active: isAct,
      status: isAct ? 'Activo' : 'Inactivo',
      created_at: backendItem.created_at || (idx >= 0 ? items[idx].created_at : new Date().toISOString()),
      formatted_date: formatSimpleDate(backendItem.created_at || (idx >= 0 ? items[idx].created_at : null))
    };

    if (idx >= 0) {
      items[idx] = updated;
    } else {
      items.unshift(updated);
    }
    saveLocalPartnerships(items);
    return updated;
  }

  // Si solo fue actualización local
  if (idx >= 0) {
    const current = items[idx];
    const newIsActive = isActive !== undefined ? isActive : current.is_active;
    items[idx] = {
      ...current,
      name: name !== null && name !== undefined ? name : current.name,
      website: website !== null && website !== undefined ? website : current.website,
      description: description !== null && description !== undefined ? description : current.description,
      logo: logoUrl ? logoUrl : current.logo,
      is_active: newIsActive,
      status: newIsActive ? 'Activo' : 'Inactivo'
    };
    saveLocalPartnerships(items);
    return items[idx];
  }

  return null;
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
 * Elimina una empresa aliada (DELETE /partnerships/{id}/).
 */
export async function deletePartnership(id) {
  try {
    await deleteRequest(`/partnerships/${id}/`, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Partnerships API] Eliminación local para empresa #${id}`);
  }

  const items = getLocalPartnerships();
  const filtered = items.filter(i => String(i.id) !== String(id));
  saveLocalPartnerships(filtered);
  return true;
}

export { resolveImageUrl };
