/**
 * ==========================================================================
 * SERVICIO API DE PERFIL DE ADMINISTRADOR (PROFILE.API.JS) - TUESTANTE
 * Manejo de consulta y actualización de datos de la cuenta de administrador.
 * ==========================================================================
 */

import { apiRequest } from '../../js/api.js';
import { getCurrentUser, setCurrentUser } from '../../js/storage.js';

const AVATAR_STORAGE_KEY = 'tuestante_admin_avatar';
const ADDRESS_STORAGE_KEY = 'tuestante_admin_address';

/**
 * Obtiene el perfil del usuario administrador autenticado.
 * Consulta primero la API en /user/me/ y sincroniza con localStorage.
 * Si la red o endpoint falla, provee los datos guardados en sesión.
 * @returns {Promise<Object>}
 */
export async function getAdminProfile() {
  try {
    const data = await apiRequest({
      path: '/user/me/',
      method: 'GET',
      auth: true
    });

    if (data && typeof data === 'object') {
      // Guardar dirección si viene en data o combinar con local
      const savedAddress = getSavedAddress();
      if (!data.address && savedAddress) {
        data.address = savedAddress;
      }
      setCurrentUser(data);
      return data;
    }
  } catch (err) {
    console.warn('[Profile API] No se pudo consultar /user/me/, usando fallback local:', err);
  }

  // Fallback con datos locales
  const localUser = getCurrentUser() || {};
  return {
    id: localUser.id || 1,
    username: localUser.username || 'admin',
    email: localUser.email || 'admin@mitienda.com',
    first_name: localUser.first_name || 'Administrador',
    second_name: localUser.second_name || '',
    first_last_name: localUser.first_last_name || '',
    second_last_name: localUser.second_last_name || '',
    document_type: localUser.document_type || 'V',
    identity_document: localUser.identity_document || '',
    full_name: localUser.full_name || localUser.first_name || 'Administrador',
    phone: localUser.phone || '+58 412-1234567',
    is_staff: localUser.is_staff !== false,
    is_superuser: localUser.is_superuser || false,
    is_active: localUser.is_active !== false,
    date_joined: localUser.date_joined || new Date().toISOString(),
    last_login: localUser.last_login || new Date().toISOString(),
    address: getSavedAddress() || 'Av. Principal, Edif. Los Pinos, Piso 3, Apto. 3B, Maracaibo, Zulia, Venezuela'
  };
}

/**
 * Actualiza los datos del perfil del administrador.
 * @param {Object} updateData Datos modificados (nombre, usuario, email, teléfono, dirección, etc.)
 * @returns {Promise<Object>}
 */
export async function updateAdminProfile(updateData) {
  // Guardar dirección en almacenamiento local persistente
  if (updateData.address !== undefined) {
    saveAddress(updateData.address);
  }

  try {
    const payload = { ...updateData };

    const response = await apiRequest({
      path: '/user/me/',
      method: 'PATCH',
      body: payload,
      auth: true
    });

    if (response) {
      const merged = { ...response, address: response.address || getSavedAddress() };
      setCurrentUser(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[Profile API] Falló PATCH /user/me/, actualizando sesión local:', err);
  }

  // Fallback actualizando sesión local
  const current = getCurrentUser() || {};
  const updated = {
    ...current,
    ...updateData,
    address: getSavedAddress()
  };
  setCurrentUser(updated);
  return updated;
}

/**
 * Guarda y recupera la foto de perfil en Base64 o URL
 */
export function getSavedAvatar() {
  try {
    return localStorage.getItem(AVATAR_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function saveAvatar(avatarDataUrl) {
  try {
    if (!avatarDataUrl) {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    } else {
      localStorage.setItem(AVATAR_STORAGE_KEY, avatarDataUrl);
    }
  } catch (e) {
    console.warn('Error al guardar avatar en localStorage:', e);
  }
}

/**
 * Guarda y recupera la dirección del administrador
 */
export function getSavedAddress() {
  try {
    return localStorage.getItem(ADDRESS_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveAddress(address) {
  try {
    localStorage.setItem(ADDRESS_STORAGE_KEY, address || '');
  } catch (e) {
    console.warn('Error al guardar dirección:', e);
  }
}

/**
 * Solicita el cambio de contraseña para el administrador actual.
 * @param {Object} data { current_password, new_password, confirm_new_password }
 * @returns {Promise<Object>}
 */
export async function changeAdminPassword(data) {
  return await apiRequest({
    path: '/user/password/change/',
    method: 'POST',
    body: data,
    auth: true
  });
}

