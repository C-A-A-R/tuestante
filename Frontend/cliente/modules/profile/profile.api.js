/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE PERFIL DE USUARIO (TUESTANTE)
 * Maneja la gestión de datos de perfil, seguridad y solicitud de cambio de contraseña.
 * ==========================================================================
 */

import { requestPasswordReset } from '../auth/password-reset.api.js';
import { getCurrentUser, setCurrentUser } from '../../js/storage.js';

/**
 * Obtiene la información del perfil del usuario autenticado actualmente.
 * @returns {Object|null} Datos del usuario en sesión.
 */
export function getProfileData() {
    return getCurrentUser();
}

/**
 * Actualiza los datos del perfil en el almacenamiento local de sesión.
 * @param {Object} updatedFields Campos a actualizar.
 * @returns {Object} Usuario con datos actualizados.
 */
export function updateProfileData(updatedFields) {
    const current = getCurrentUser() || {};
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
