import { postRequest } from "../../js/api.js";

const AUTH_BASE_PATH = "/user";

/**
 * Solicita el restablecimiento de contraseña enviando un correo al usuario.
 * @param {string} correo_electronico
 */
export async function requestPasswordReset(correo_electronico) {
    return postRequest(
        `${AUTH_BASE_PATH}/password/reset/`,
        { 
            email: correo_electronico,
            correo_electronico: correo_electronico 
        },
        { auth: false }
    );
}

/**
 * Confirma el restablecimiento de contraseña usando el uid y token del enlace.
 * @param {string} uidb64
 * @param {string} token
 * @param {string} nueva_contrasena
 * @param {string} nueva_contrasena2
 */
export async function confirmPasswordReset(uidb64, token, nueva_contrasena, nueva_contrasena2) {
    return postRequest(
        `${AUTH_BASE_PATH}/password/reset/confirm/${uidb64}/${token}/`,
        { 
            new_password: nueva_contrasena,
            nueva_contrasena: nueva_contrasena,
            nueva_contrasena2: nueva_contrasena2 
        },
        { auth: false }
    );
}
