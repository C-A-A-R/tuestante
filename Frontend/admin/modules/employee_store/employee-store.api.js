/**
 * ==========================================================================
 * TUESTANTE ADMIN - API SERVICES PARA TIENDA DE EMPLEADOS
 * ==========================================================================
 * Conexión centralizada con los endpoints de apps.employee_store en Django REST Framework.
 */

import { 
  getRequest, 
  postRequest, 
  patchRequest, 
  putRequest, 
  deleteRequest, 
  extractList 
} from '../../js/api.js';

/* ==========================================================================
   1. PRODUCTOS INTERNOS (INTERNAL PRODUCTS)
   ========================================================================== */

/**
 * Consulta el catálogo de productos internos con filtros opcionales.
 * @param {Object} params - { barcode, category, subcategory, search, is_active, in_stock }
 */
export async function fetchProducts(params = {}) {
  const response = await getRequest('/employee-store/products/', params);
  return extractList(response);
}

/**
 * Obtiene un producto interno por su ID.
 * @param {number|string} productId
 */
export async function fetchProduct(productId) {
  return await getRequest(`/employee-store/products/${productId}/`);
}

/**
 * Búsqueda rápida de producto por código de barras exacto (lector POS / input).
 * @param {string} barcode
 */
export async function fetchProductByBarcode(barcode) {
  if (!barcode) return null;
  const response = await getRequest('/employee-store/products/', { barcode: barcode.trim() });
  const list = extractList(response);
  return list.length > 0 ? list[0] : null;
}

/**
 * Crea un nuevo producto interno.
 * @param {Object} payload - { barcode, name, description, price, stock, weekly_limit_per_employee, category, subcategory, is_active }
 */
export async function createProduct(payload) {
  return await postRequest('/employee-store/products/', payload);
}

/**
 * Actualiza completamente un producto interno.
 * @param {number|string} productId
 * @param {Object} payload
 */
export async function updateProduct(productId, payload) {
  return await patchRequest(`/employee-store/products/${productId}/`, payload);
}

/**
 * Ajuste rápido de existencias y/o precio (modal Quick Edit).
 * @param {number|string} productId
 * @param {Object} delta - { stock, price }
 */
export async function quickUpdateProduct(productId, { stock, price }) {
  const payload = {};
  if (stock !== undefined) payload.stock = stock;
  if (price !== undefined) payload.price = price;
  return await patchRequest(`/employee-store/products/${productId}/`, payload);
}

/**
 * Elimina un producto interno (borrado lógico por BaseViewSet).
 * @param {number|string} productId
 */
export async function deleteProduct(productId) {
  return await deleteRequest(`api/employee-store/products/${productId}/`);
}

/* ==========================================================================
   2. CATEGORÍAS Y SUBCATEGORÍAS INTERNAS
   ========================================================================== */

/**
 * Consulta la lista de categorías internas.
 * @param {Object} params - { search }
 */
export async function fetchCategories(params = {}) {
  const response = await getRequest('/employee-store/categories/', params);
  return extractList(response);
}

/**
 * Crea una nueva categoría interna.
 * @param {Object} payload - { name, description }
 */
export async function createCategory(payload) {
  return await postRequest('/employee-store/categories/', payload);
}

/**
 * Actualiza una categoría interna.
 * @param {number|string} categoryId
 * @param {Object} payload - { name, description }
 */
export async function updateCategory(categoryId, payload) {
  return await patchRequest(`/employee-store/categories/${categoryId}/`, payload);
}

/**
 * Elimina una categoría interna.
 * @param {number|string} categoryId
 */
export async function deleteCategory(categoryId) {
  return await deleteRequest(`/employee-store/categories/${categoryId}/`);
}

/**
 * Consulta la lista de subcategorías internas.
 * @param {Object} params - { category, search }
 */
export async function fetchSubCategories(params = {}) {
  const response = await getRequest('/employee-store/subcategories/', params);
  return extractList(response);
}

/**
 * Crea una nueva subcategoría interna.
 * @param {Object} payload - { category, name, description }
 */
export async function createSubCategory(payload) {
  return await postRequest('/employee-store/subcategories/', payload);
}

/**
 * Actualiza una subcategoría interna.
 * @param {number|string} subcategoryId
 * @param {Object} payload - { category, name, description }
 */
export async function updateSubCategory(subcategoryId, payload) {
  return await patchRequest(`/employee-store/subcategories/${subcategoryId}/`, payload);
}

/**
 * Elimina una subcategoría interna.
 * @param {number|string} subcategoryId
 */
export async function deleteSubCategory(subcategoryId) {
  return await deleteRequest(`/employee-store/subcategories/${subcategoryId}/`);
}

/* ==========================================================================
   3. EMPLEADOS Y CUENTAS POR COBRAR (EMPLOYEE PROFILES)
   ========================================================================== */

/**
 * Consulta la lista de perfiles de empleados con búsqueda.
 * @param {Object} params - { search, department, is_active }
 */
export async function fetchEmployees(params = {}) {
  const response = await getRequest('/employee-store/employees/', params);
  return extractList(response);
}

/**
 * Obtiene el detalle de un perfil de empleado.
 * @param {number|string} employeeId
 */
export async function fetchEmployee(employeeId) {
  return await getRequest(`/employee-store/employees/${employeeId}/`);
}

/**
 * Obtiene el estado de cuenta detallado de un empleado (deuda, órdenes y abonos).
 * @param {number|string} employeeId
 */
export async function fetchEmployeeStatement(employeeId) {
  return await getRequest(`/employee-store/employees/${employeeId}/statement/`);
}

/**
 * Registra un nuevo perfil de empleado.
 * @param {Object} payload
 */
export async function createEmployee(payload) {
  return await postRequest('/employee-store/employees/', payload);
}

/**
 * Actualiza parcialmente los datos de un empleado.
 * @param {number|string} employeeId
 * @param {Object} payload
 */
export async function updateEmployee(employeeId, payload) {
  return await patchRequest(`/employee-store/employees/${employeeId}/`, payload);
}

/* ==========================================================================
   4. ÓRDENES DE CONSUMO INTERNO (INTERNAL ORDERS)
   ========================================================================== */

/**
 * Consulta el historial de órdenes de consumo interno con filtros.
 * @param {Object} params - { search, status, start_date, end_date }
 */
export async function fetchOrders(params = {}) {
  const response = await getRequest('/employee-store/orders/', params);
  return extractList(response);
}

/**
 * Obtiene el detalle de una orden interna específica por ID.
 * @param {number|string} orderId
 */
export async function fetchOrder(orderId) {
  return await getRequest(`/employee-store/orders/${orderId}/`);
}

/**
 * Registra y despacha una orden de consumo en tienda interna de forma atómica.
 * @param {Object} payload - { employee_id, items: [{ barcode, product_id, quantity }], notes, is_admin_override }
 */
export async function createInternalOrder(payload) {
  return await postRequest('/employee-store/orders/', payload);
}

/**
 * Actualiza el estado de una orden interna (UNDELIVERED, DELIVERED, PAID, CANCELLED).
 * @param {number|string} orderId
 * @param {string} status
 * @param {string} notes
 */
export async function updateOrderStatus(orderId, status, notes = '') {
  const payload = { status };
  if (notes) payload.notes = notes;
  return await patchRequest(`/employee-store/orders/${orderId}/`, payload);
}

/**
 * Cancela una orden de consumo (revirtiendo stock en almacén).
 * @param {number|string} orderId
 * @param {string} notes
 */
export async function cancelOrder(orderId, notes = '') {
  return await updateOrderStatus(orderId, 'CANCELLED', notes || 'Cancelado desde panel de auditoría');
}


/* ==========================================================================
   5. ABONOS Y PAGOS DE DEUDA (DEBT PAYMENTS)
   ========================================================================== */

/**
 * Consulta el historial de abonos y pagos de deuda.
 * @param {Object} params - { search, employee }
 */
export async function fetchPayments(params = {}) {
  const response = await getRequest('/employee-store/payments/', params);
  return extractList(response);
}

/**
 * Registra un abono o descuento de nómina para amortizar la deuda del trabajador.
 * @param {Object} payload - { employee, amount, payment_type, reference, notes }
 */
export async function createDebtPayment(payload) {
  return await postRequest('/employee-store/payments/', payload);
}

/* ==========================================================================
   6. REPORTES Y CORTES DE NÓMINA (SETTLEMENT REPORTS)
   ========================================================================== */

/**
 * Genera el reporte consolidado de corte quincenal / mensual para nómina.
 * @param {Object} params - { start_date, end_date, employee_id }
 */
export async function fetchSettlementReport(params = {}) {
  return await getRequest('/employee-store/reports/settlement/', params);
}
