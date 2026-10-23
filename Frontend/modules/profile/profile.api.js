/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE PERFIL DE USUARIO (TUESTANTE)
 * Maneja la gestión de datos de perfil, seguridad y solicitud de cambio de contraseña.
 * ==========================================================================
 */

import { requestPasswordReset } from '../auth/password-reset.api.js';
import { getCurrentUser, setCurrentUser } from '../../js/storage.js';
import { apiRequest } from '../../js/api.js';

/**
 * Obtiene la información del perfil del usuario autenticado en la sesión local.
 * @returns {Object|null} Datos del usuario en sesión.
 */
export function getProfileData() {
    return getCurrentUser();
}

/**
 * Consulta los datos más recientes del perfil desde la API del backend (/users/profile/).
 * @returns {Promise<Object|null>} Datos del usuario actualizados.
 */
export async function fetchProfileFromAPI() {
    try {
        const data = await apiRequest({
            path: '/user/profile/',
            method: 'GET',
            auth: true
        });
        if (data && typeof data === 'object') {
            const current = getCurrentUser() || {};
            const merged = { ...current, ...data };
            setCurrentUser(merged);
            return merged;
        }
    } catch (err) {
        console.warn('[Profile API] No se pudo consultar /user/profile/, usando datos locales:', err);
    }
    return getCurrentUser();
}

/**
 * Actualiza los datos del perfil tanto en el backend como en el almacenamiento local de sesión.
 * @param {Object} updatedFields Campos a actualizar.
 * @returns {Promise<Object>} Usuario con datos actualizados.
 */
export async function updateProfileData(updatedFields) {
    const current = getCurrentUser() || {};
    try {
        const response = await apiRequest({
            path: '/user/profile/',
            method: 'PATCH',
            body: updatedFields,
            auth: true
        });

        const serverUser = response?.user || response;
        if (serverUser && typeof serverUser === 'object') {
            const merged = {
                ...current,
                ...serverUser,
                full_name: `${serverUser.first_name || ''} ${serverUser.first_last_name || ''}`.trim() || serverUser.username
            };
            setCurrentUser(merged);
            return merged;
        }
    } catch (err) {
        console.warn('[Profile API] Error al actualizar perfil en servidor:', err);
        throw err;
    }

    const updatedUser = {
        ...current,
        ...updatedFields,
        full_name: `${updatedFields.first_name || current.first_name || ''} ${updatedFields.first_last_name || current.first_last_name || ''}`.trim() || current.username
    };
    setCurrentUser(updatedUser);
    return updatedUser;
}

/**
 * Solicita el envío de un correo de restablecimiento de contraseña al email del usuario.
 * @param {string} email Correo del usuario.
 * @returns {Promise<Object>} Respuesta del backend.
 */
export async function sendPasswordResetEmail(email) {
    return requestPasswordReset(email);
}
