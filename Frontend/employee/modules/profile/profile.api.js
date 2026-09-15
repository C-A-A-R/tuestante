/**
 * ==========================================================================
 * TUESTANTE - SERVICIO API DE PERFIL Y ESTADO DE CUENTA (EMPLOYEE STORE)
 * ==========================================================================
 * Centraliza las conexiones al backend para la consulta de datos del colaborador,
 * saldo de deuda acumulada, amortizaciones y deducciones de nómina.
 */

import { getRequest, postRequest } from '../../../js/api.js';

/**
 * Obtiene el perfil y estado de cuenta consolidado del colaborador autenticado.
 * Retorna { employee, current_debt, has_overdue_debt, overdue_debt_amount, cutoff_date, orders, payments }
 * @returns {Promise<Object>}
 */
export async function obtenerEstadoDeCuenta() {
  return await getRequest('/employee-store/employees/me/');
}

/**
 * Obtiene los datos del perfil del colaborador autenticado.
 * Retorna el objeto employee con compatibilidad de user { id, first_name, username, ... }
 * @returns {Promise<Object>}
 */
export async function obtenerPerfilEmpleado() {
  const statement = await obtenerEstadoDeCuenta();
  const emp = statement?.employee || statement;
  if (!emp) return null;
  const firstName = emp.full_name ? emp.full_name.split(' ')[0] : emp.username;
  return {
    ...emp,
    user: (typeof emp.user === 'object' && emp.user !== null)
      ? emp.user
      : {
          id: emp.user,
          username: emp.username,
          first_name: firstName,
          full_name: emp.full_name
        }
  };
}

/**
 * Consulta el estado de cuenta por ID de empleado específico.
 * @param {number|string} employeeId 
 * @returns {Promise<Object>}
 */
export async function obtenerEstadoDeCuentaPorId(employeeId) {
  return await getRequest(`/employee-store/employees/${employeeId}/statement/`);
}

/**
 * Registra un abono o deducción de nómina a la deuda del trabajador.
 * @param {Object} payload { employee, amount, payment_type, reference, notes }
 * @returns {Promise<Object>}
 */
export async function registrarAbonoDeuda(payload) {
  return await postRequest('/employee-store/payments/', payload);
}
