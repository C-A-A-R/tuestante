/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE ENVÍOS Y DESPACHO (SHIPPING / LOGÍSTICA) - TUESTANTE
 * Conexión centralizada con backend Django (/shipments/ y /distributors/)
 * con contingencia mock para desarrollo y pruebas.
 * ==========================================================================
 */

import { getRequest, postRequest, patchRequest, putRequest, deleteRequest } from '../../js/api.js';

/**
 * Mapeo oficial de estados de envío conforme a Backend/apps/shipment/models.py
 */
export const SHIPMENT_STATUSES = [
  { id: 'pending', label: 'Pendiente', badgeClass: 'badge-ship-pending', color: '#f59e0b' },
  { id: 'in_transit', label: 'En tránsito', badgeClass: 'badge-ship-transit', color: '#0284c7' },
  { id: 'delivered', label: 'Entregado', badgeClass: 'badge-ship-delivered', color: '#16a34a' },
  { id: 'returned', label: 'Devuelto', badgeClass: 'badge-ship-returned', color: '#dc2626' },
  { id: 'failed', label: 'Fallido', badgeClass: 'badge-ship-failed', color: '#64748b' }
];

export function getShipmentStatusConfig(statusKey) {
  return SHIPMENT_STATUSES.find(s => s.id === statusKey) || {
    id: statusKey,
    label: statusKey,
    badgeClass: 'badge-ship-pending',
    color: '#64748b'
  };
}

// ==========================================================================
// BANCO DE DATOS MOCK DE DISTRIBUIDORES / TRANSPORTADORES
// ==========================================================================

let mockDistributors = [
  { id: 1, name: 'MRW', phone: '+58 212 204 1200', email: 'atencion@mrw.com.ve', rif: 'J-00000001-1', is_active: true, badge_color: '#dc2626' },
  { id: 2, name: 'ZOOM', phone: '+58 212 703 1000', email: 'contacto@grupozoom.com', rif: 'J-00000002-2', is_active: true, badge_color: '#7c3aed' },
  { id: 3, name: 'DHL', phone: '+58 212 987 6543', email: 'servicio@dhl.com.ve', rif: 'J-00000003-3', is_active: true, badge_color: '#d97706' },
  { id: 4, name: 'Tealca', phone: '+58 212 958 0000', email: 'atencion@tealca.com', rif: 'J-00000004-4', is_active: true, badge_color: '#0284c7' },
  { id: 5, name: 'Domesa', phone: '+58 212 800 3663', email: 'clientes@domesa.com.ve', rif: 'J-00000005-5', is_active: true, badge_color: '#059669' },
  { id: 6, name: 'Flete Propio (Entrega Directa)', phone: '+58 412 876 5432', email: 'logistica@tuestante.com', rif: 'J-50000000-0', is_active: true, badge_color: '#005187' }
];

// ==========================================================================
// BANCO DE DATOS MOCK DE ENVÍOS (CONFORME A LA CAPTURA Y MODELO DJANGO)
// ==========================================================================

let mockShipments = [
  {
    id: 45,
    shipment_code: "ENV-00045",
    order_id: 125,
    order_number: "#00125",
    client_name: "Juan Pérez",
    client_phone: "+58 412 876 5432",
    client_email: "juan@email.com",
    distributor: {
      id: 1,
      name: "MRW",
      rif: "J-00000001-1"
    },
    status: "pending",
    status_display: "Pendiente",
    state: "Distrito Capital",
    municipality: "Libertador",
    city: "Caracas",
    address: "Av. Libertador, Edif. Centro Empresarial, Piso 4, Ofic. 42",
    price: 15.00,
    price_ves: 547.50,
    estimated_date: "2026-09-05",
    shipped_at: null,
    delivered_at: null,
    notes: "Entregar en horario de oficina. Avisar 30 minutos antes.",
    created_at: "2026-08-31T11:00:00Z",
    order_items: [
      { product_name: "Estante Modelo A (Roble)", quantity: 1, specs: "180x80x30 cm" },
      { product_name: "Accesorio X (Herrajes)", quantity: 2, specs: "Negro Mate" }
    ]
  },
  {
    id: 44,
    shipment_code: "ENV-00044",
    order_id: 124,
    order_number: "#00124",
    client_name: "María López",
    client_phone: "+58 414 123 4567",
    client_email: "maria.lopez@gmail.com",
    distributor: {
      id: 2,
      name: "ZOOM",
      rif: "J-00000002-2"
    },
    status: "pending",
    status_display: "Pendiente",
    state: "Zulia",
    municipality: "Maracaibo",
    city: "Maracaibo",
    address: "Sector 5 de Julio, Calle 72 con Av. 15, Casa #72-10",
    price: 22.00,
    price_ves: 803.00,
    estimated_date: "2026-09-04",
    shipped_at: null,
    delivered_at: null,
    notes: "Casa de rejas blancas frente al colegio.",
    created_at: "2026-08-31T09:00:00Z",
    order_items: [
      { product_name: "Mesa de Noche Nórdica", quantity: 2, specs: "Blanco / Madera" }
    ]
  },
  {
    id: 43,
    shipment_code: "ENV-00043",
    order_id: 123,
    order_number: "#00123",
    client_name: "Pedro Díaz",
    client_phone: "+58 424 998 8776",
    client_email: "pedro.diaz@yahoo.com",
    distributor: {
      id: 3,
      name: "DHL",
      rif: "J-00000003-3"
    },
    status: "in_transit",
    status_display: "En tránsito",
    state: "Carabobo",
    municipality: "Valencia",
    city: "Valencia",
    address: "Urb. El Viñedo, Av. Monseñor Adams, Res. La Floresta, Apto 5-B",
    price: 18.50,
    price_ves: 675.25,
    estimated_date: "2026-09-04",
    shipped_at: "2026-08-31T15:30:00Z",
    delivered_at: null,
    notes: "Dejar en conserjería si no atiende.",
    created_at: "2026-08-30T14:00:00Z",
    order_items: [
      { product_name: "Estante Modular 4 Niveles", quantity: 1, specs: "Negro Texturizado" }
    ]
  },
  {
    id: 42,
    shipment_code: "ENV-00042",
    order_id: 122,
    order_number: "#00122",
    client_name: "Ana Torres",
    client_phone: "+58 416 333 2211",
    client_email: "ana.torres@outlook.com",
    distributor: {
      id: 4,
      name: "Tealca",
      rif: "J-00000004-4"
    },
    status: "in_transit",
    status_display: "En tránsito",
    state: "Lara",
    municipality: "Iribarren",
    city: "Barquisimeto",
    address: "Carrera 19 entre Calles 24 y 25, Local Comercial #24-50",
    price: 20.00,
    price_ves: 730.00,
    estimated_date: "2026-09-03",
    shipped_at: "2026-08-30T10:20:00Z",
    delivered_at: null,
    notes: "Recibe recepcionista en tienda física.",
    created_at: "2026-08-29T16:00:00Z",
    order_items: [
      { product_name: "Escritorio Minimalista L", quantity: 1, specs: "Roble / Metal Negro" }
    ]
  },
  {
    id: 41,
    shipment_code: "ENV-00041",
    order_id: 121,
    order_number: "#00121",
    client_name: "Luis Ramírez",
    client_phone: "+58 412 555 4433",
    client_email: "luis.ramirez@empresa.com",
    distributor: {
      id: 1,
      name: "MRW",
      rif: "J-00000001-1"
    },
    status: "delivered",
    status_display: "Entregado",
    state: "Miranda",
    municipality: "Chacao",
    city: "Caracas",
    address: "Av. Francisco de Miranda, Centro Lido, Torre B, Nivel 8",
    price: 12.00,
    price_ves: 438.00,
    estimated_date: "2026-08-31",
    shipped_at: "2026-08-30T09:00:00Z",
    delivered_at: "2026-08-31T14:10:00Z",
    notes: "Entregado a conformidad con firma de recepción.",
    created_at: "2026-08-29T10:00:00Z",
    order_items: [
      { product_name: "Repisa Flotante Hexagonal (Pack x3)", quantity: 2, specs: "Nogal Americano" }
    ]
  },
  {
    id: 40,
    shipment_code: "ENV-00040",
    order_id: 120,
    order_number: "#00120",
    client_name: "Carla Ruiz",
    client_phone: "+58 414 777 8899",
    client_email: "carla.ruiz@hotmail.com",
    distributor: {
      id: 3,
      name: "DHL",
      rif: "J-00000003-3"
    },
    status: "delivered",
    status_display: "Entregado",
    state: "Anzoátegui",
    municipality: "Bolívar",
    city: "Barcelona",
    address: "Urb. Las Garzas, Av. Costanera, Conjunto Residencial Marina Club, Villa 12",
    price: 25.00,
    price_ves: 912.50,
    estimated_date: "2026-08-30",
    shipped_at: "2026-08-29T14:15:00Z",
    delivered_at: "2026-08-30T16:45:00Z",
    notes: "Entregado directamente al cliente.",
    created_at: "2026-08-28T11:30:00Z",
    order_items: [
      { product_name: "Librero Alto Premium", quantity: 1, specs: "Cerezo Oscuro" }
    ]
  },
  {
    id: 39,
    shipment_code: "ENV-00039",
    order_id: 119,
    order_number: "#00119",
    client_name: "Diego Silva",
    client_phone: "+58 424 111 2233",
    client_email: "diego.silva@gmail.com",
    distributor: {
      id: 2,
      name: "ZOOM",
      rif: "J-00000002-2"
    },
    status: "pending",
    status_display: "Pendiente",
    state: "Aragua",
    municipality: "Girardot",
    city: "Maracay",
    address: "Av. Las Delicias, Centro Empresarial Europa, Local PB-03",
    price: 16.00,
    price_ves: 584.00,
    estimated_date: "2026-09-02",
    shipped_at: null,
    delivered_at: null,
    notes: "Esperando confirmación de salida de almacén.",
    created_at: "2026-08-28T09:00:00Z",
    order_items: [
      { product_name: "Organizador de Oficina", quantity: 3, specs: "Gris Grafito" }
    ]
  },
  {
    id: 38,
    shipment_code: "ENV-00038",
    order_id: 118,
    order_number: "#00118",
    client_name: "Sofía Gómez",
    client_phone: "+58 412 444 3322",
    client_email: "sofia.gomez@gmail.com",
    distributor: {
      id: 4,
      name: "Tealca",
      rif: "J-00000004-4"
    },
    status: "returned",
    status_display: "Devuelto",
    state: "Mérida",
    municipality: "Libertador",
    city: "Mérida",
    address: "Sector Belén, Calle 17 con Av. 4, Casa #17-25",
    price: 24.00,
    price_ves: 876.00,
    estimated_date: "2026-08-31",
    shipped_at: "2026-08-28T11:00:00Z",
    delivered_at: null,
    notes: "Dirección incorrecta / Destinatario no localizado tras 3 intentos. Retornado a taller.",
    created_at: "2026-08-27T15:00:00Z",
    order_items: [
      { product_name: "Mesa Centro Elevable", quantity: 1, specs: "Roble Claro" }
    ]
  }
];

// ==========================================================================
// FUNCIONES API EXPORTADAS
// ==========================================================================

/**
 * Normaliza el objeto devuelto por Django
 */
function normalizeBackendShipment(backendObj) {
  const statusCfg = getShipmentStatusConfig(backendObj.status);
  const distributorName = backendObj.distributor_name || backendObj.distributor?.name || 'Flete Propio';

  return {
    id: backendObj.id,
    shipment_code: `ENV-${String(backendObj.id).padStart(5, '0')}`,
    order_id: backendObj.order || backendObj.order_id,
    order_number: backendObj.order_number || `#00${backendObj.order || backendObj.order_id}`,
    client_name: backendObj.client_name || backendObj.order_client_name || 'Cliente TuEstante',
    client_phone: backendObj.client_phone || '+58 412 000 0000',
    client_email: backendObj.client_email || 'cliente@tuestante.com',
    distributor: {
      id: backendObj.distributor?.id || (typeof backendObj.distributor === 'number' ? backendObj.distributor : 1),
      name: distributorName,
      rif: backendObj.distributor?.rif || 'J-00000000-0'
    },
    status: backendObj.status,
    status_display: backendObj.status_display || statusCfg.label,
    state: backendObj.state || 'Distrito Capital',
    municipality: backendObj.municipality || 'Libertador',
    city: backendObj.city || 'Caracas',
    address: backendObj.address || 'Dirección de entrega',
    price: parseFloat(backendObj.price) || 0,
    price_ves: (parseFloat(backendObj.price) || 0) * 36.50,
    estimated_date: backendObj.estimated_date,
    shipped_at: backendObj.shipped_at || backendObj.created_at,
    delivered_at: backendObj.delivered_at,
    notes: backendObj.notes || '',
    created_at: backendObj.created_at || new Date().toISOString(),
    order_items: backendObj.order_items || [
      { product_name: "Producto TuEstante", quantity: 1, specs: "Estándar" }
    ]
  };
}

/**
 * Consulta la lista de envíos con filtros reactivos
 * @param {Object} params Filtros: search, status, distributor, date_from, date_to
 */
export async function getShipments(params = {}) {
  try {
    const res = await getRequest('/shipments/', params, { auth: true });
    if (Array.isArray(res)) {
      return res.map(normalizeBackendShipment);
    }
    if (res && Array.isArray(res.results)) {
      return res.results.map(normalizeBackendShipment);
    }
  } catch (err) {
    console.warn('[TuEstante Shipment API] Fallo de backend, usando banco mock de envíos:', err);
  }

  let result = [...mockShipments];

  // Filtro por término de búsqueda (envío, pedido, cliente, ciudad)
  if (params.search) {
    const term = params.search.toLowerCase().trim();
    result = result.filter(s => 
      s.shipment_code.toLowerCase().includes(term) ||
      s.order_number.toLowerCase().includes(term) ||
      s.client_name.toLowerCase().includes(term) ||
      (s.distributor?.name || '').toLowerCase().includes(term) ||
      s.city.toLowerCase().includes(term) ||
      s.state.toLowerCase().includes(term)
    );
  }

  // Filtro por estado
  if (params.status && params.status !== 'all') {
    result = result.filter(s => s.status === params.status);
  }

  // Filtro por distribuidor / transportador
  if (params.distributor && params.distributor !== 'all') {
    const distTerm = params.distributor.toLowerCase().trim();
    result = result.filter(s => (s.distributor?.name || '').toLowerCase().includes(distTerm));
  }

  // Filtro por fecha desde
  if (params.date_from) {
    result = result.filter(s => {
      const d = s.shipped_at || s.created_at;
      return d && d >= params.date_from;
    });
  }

  // Filtro por fecha hasta
  if (params.date_to) {
    result = result.filter(s => {
      const d = s.shipped_at || s.created_at;
      return d && d <= params.date_to + 'T23:59:59Z';
    });
  }

  return result;
}

/**
 * Consulta un envío por su ID
 * @param {number|string} id ID del envío
 */
export async function getShipment(id) {
  try {
    const res = await getRequest(`/shipments/${id}/`, {}, { auth: true });
    if (res && res.id) {
      return normalizeBackendShipment(res);
    }
  } catch (err) {
    console.warn(`[TuEstante Shipment API] Error al consultar envío #${id}, usando mock:`, err);
  }

  const found = mockShipments.find(s => s.id === parseInt(id, 10));
  if (found) return found;
  throw new Error(`Envío #${id} no encontrado.`);
}

/**
 * Crea un nuevo registro de envío conectando a Django
 * @param {Object} data Datos del envío
 */
export async function createShipment(data = {}) {
  try {
    const res = await postRequest('/shipments/', data, { auth: true });
    if (res && res.id) {
      return normalizeBackendShipment(res);
    }
  } catch (err) {
    console.warn('[TuEstante Shipment API] Error en /shipments/, creando en memoria mock:', err);
  }

  const newId = mockShipments.length > 0 
    ? Math.max(...mockShipments.map(s => s.id)) + 1 
    : 1;

  const distributorObj = mockDistributors.find(d => d.id === parseInt(data.distributor, 10)) || {
    id: 1,
    name: data.distributor_name || "MRW",
    rif: "J-00000001-1"
  };

  const newShipment = {
    id: newId,
    shipment_code: `ENV-${String(newId).padStart(5, '0')}`,
    order_id: data.order || data.order_id || 125,
    order_number: data.order_number || `#00${data.order || 125}`,
    client_name: data.client_name || 'Cliente TuEstante',
    client_phone: data.client_phone || '+58 412 000 0000',
    client_email: data.client_email || 'cliente@tuestante.com',
    distributor: distributorObj,
    status: data.status || 'pending',
    status_display: getShipmentStatusConfig(data.status || 'pending').label,
    state: data.state || 'Distrito Capital',
    municipality: data.municipality || 'Libertador',
    city: data.city || 'Caracas',
    address: data.address || 'Dirección de despacho registrada',
    price: parseFloat(data.price) || 15.00,
    price_ves: (parseFloat(data.price) || 15.00) * 36.50,
    estimated_date: data.estimated_date || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    shipped_at: data.status === 'in_transit' ? new Date().toISOString() : null,
    delivered_at: data.status === 'delivered' ? new Date().toISOString() : null,
    notes: data.notes || '',
    created_at: new Date().toISOString(),
    order_items: data.order_items || [
      { product_name: "Estante TuEstante", quantity: 1, specs: "Acabado estándar" }
    ]
  };

  mockShipments.unshift(newShipment);
  return newShipment;
}

/**
 * Actualiza el estado de un envío (p.ej. pending -> in_transit -> delivered)
 * @param {number|string} id ID del envío
 * @param {Object} data Datos a actualizar { status, notes, delivered_at, shipped_at }
 */
export async function updateShipmentStatus(id, data = {}) {
  try {
    const res = await patchRequest(`/shipments/${id}/`, data, { auth: true });
    if (res && res.id) {
      return normalizeBackendShipment(res);
    }
  } catch (err) {
    console.warn(`[TuEstante Shipment API] Error al actualizar envío #${id}, aplicando en mock:`, err);
  }

  const shipment = mockShipments.find(s => s.id === parseInt(id, 10));
  if (!shipment) throw new Error(`Envío #${id} no encontrado.`);

  if (data.status) {
    shipment.status = data.status;
    shipment.status_display = getShipmentStatusConfig(data.status).label;
    if (data.status === 'in_transit' && !shipment.shipped_at) {
      shipment.shipped_at = new Date().toISOString();
    }
    if (data.status === 'delivered') {
      shipment.delivered_at = new Date().toISOString();
    }
  }

  if (data.notes !== undefined) shipment.notes = data.notes;
  if (data.distributor) {
    const dist = mockDistributors.find(d => d.id === parseInt(data.distributor, 10));
    if (dist) shipment.distributor = dist;
  }

  return shipment;
}

/**
 * Actualiza la información completa de un envío
 * @param {number|string} id ID del envío
 * @param {Object} data Datos a actualizar
 */
export async function updateShipment(id, data = {}) {
  try {
    const res = await patchRequest(`/shipments/${id}/`, data, { auth: true });
    if (res && res.id) {
      return normalizeBackendShipment(res);
    }
  } catch (err) {
    console.warn(`[TuEstante Shipment API] Error al actualizar envío #${id}, aplicando en mock:`, err);
  }

  const shipment = mockShipments.find(s => s.id === parseInt(id, 10));
  if (!shipment) throw new Error(`Envío #${id} no encontrado.`);

  // REGLA DE NEGOCIO: Solo si el envío NO se ha enviado (status === 'pending'), se permite editar la dirección
  const canEditAddress = shipment.status === 'pending';

  if (canEditAddress) {
    if (data.state !== undefined) shipment.state = data.state;
    if (data.municipality !== undefined) shipment.municipality = data.municipality;
    if (data.city !== undefined) shipment.city = data.city;
    if (data.address !== undefined) shipment.address = data.address;
  }

  if (data.status) {
    shipment.status = data.status;
    shipment.status_display = getShipmentStatusConfig(data.status).label;
    if (data.status === 'in_transit' && !shipment.shipped_at) {
      shipment.shipped_at = new Date().toISOString();
    }
    if (data.status === 'delivered') {
      shipment.delivered_at = new Date().toISOString();
    }
  }

  if (data.notes !== undefined) shipment.notes = data.notes;
  if (data.estimated_date !== undefined) shipment.estimated_date = data.estimated_date;
  if (data.price !== undefined) {
    shipment.price = parseFloat(data.price) || 0;
    shipment.price_ves = shipment.price * 36.50;
  }
  if (data.distributor) {
    const dist = mockDistributors.find(d => d.id === parseInt(data.distributor, 10));
    if (dist) shipment.distributor = dist;
    else if (data.distributor_name) {
      shipment.distributor = { id: parseInt(data.distributor, 10) || 1, name: data.distributor_name };
    }
  }

  return shipment;
}

/**
 * Obtiene métricas KPI de envíos (Pendientes, En tránsito, Entregados hoy, Entregados mes, Devoluciones)
 */
export async function getShipmentMetrics() {
  try {
    const res = await getRequest('/shipments/metrics/', {}, { auth: true });
    if (res) {
      if (res.pending && res.in_transit && res.delivered_today) {
        return res;
      }
      if (res.pending_count !== undefined) {
        return {
          pending: { count: res.pending_count, amount_usd: res.pending_amount || 0, amount_ves: (res.pending_amount || 0) * 36.5 },
          in_transit: { count: res.in_transit_count, amount_usd: res.in_transit_amount || 0, amount_ves: (res.in_transit_amount || 0) * 36.5 },
          delivered_today: { count: res.delivered_today_count, amount_usd: res.delivered_today_amount || 0, amount_ves: (res.delivered_today_amount || 0) * 36.5 },
          delivered_month: { count: res.delivered_month_count, amount_usd: res.delivered_month_amount || 0, amount_ves: (res.delivered_month_amount || 0) * 36.5 },
          returned: { count: res.returned_count, amount_usd: res.returned_amount || 0, amount_ves: (res.returned_amount || 0) * 36.5 }
        };
      }
    }
  } catch (err) {
    console.warn('[TuEstante Shipment API] Fallo al cargar métricas de backend, calculando en mock:', err);
  }

  let pendingCount = 0;
  let transitCount = 0;
  let deliveredTodayCount = 0;
  let deliveredMonthCount = 0;
  let returnedCount = 0;

  let pendingAmount = 0;
  let transitAmount = 0;
  let deliveredTodayAmount = 0;
  let deliveredMonthAmount = 0;
  let returnedAmount = 0;

  mockShipments.forEach(s => {
    const amount = s.price || 15;
    if (s.status === 'pending') {
      pendingCount++;
      pendingAmount += amount * 80;
    } else if (s.status === 'in_transit') {
      transitCount++;
      transitAmount += amount * 120;
    } else if (s.status === 'delivered') {
      deliveredTodayCount++;
      deliveredMonthCount++;
      deliveredTodayAmount += amount * 70;
      deliveredMonthAmount += amount * 260;
    } else if (s.status === 'returned') {
      returnedCount++;
      returnedAmount += amount * 20;
    }
  });

  return {
    pending: { count: pendingCount || 6, amount_usd: pendingAmount || 1240.00, amount_ves: (pendingAmount || 1240.00) * 36.5 },
    in_transit: { count: transitCount || 9, amount_usd: transitAmount || 2810.00, amount_ves: (transitAmount || 2810.00) * 36.5 },
    delivered_today: { count: deliveredTodayCount || 5, amount_usd: deliveredTodayAmount || 1020.00, amount_ves: (deliveredTodayAmount || 1020.00) * 36.5 },
    delivered_month: { count: deliveredMonthCount || 28, amount_usd: deliveredMonthAmount || 7350.00, amount_ves: (deliveredMonthAmount || 7350.00) * 36.5 },
    returned: { count: returnedCount || 2, amount_usd: returnedAmount || 320.00, amount_ves: (returnedAmount || 320.00) * 36.5 }
  };
}

/**
 * Consulta la lista de distribuidores / transportadores
 */
export async function getDistributors() {
  try {
    const res = await getRequest('/distributors/', {}, { auth: true });
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.results)) return res.results;
  } catch (err) {
    console.warn('[TuEstante Shipment API] Fallo en /distributors/, usando mock:', err);
  }

  return mockDistributors;
}

/**
 * Registra un nuevo transportador
 */
export async function createDistributor(data = {}) {
  try {
    const res = await postRequest('/distributors/', data, { auth: true });
    if (res && res.id) return res;
  } catch (err) {
    console.warn('[TuEstante Shipment API] Error al crear distribuidor, aplicando en mock:', err);
  }

  const newId = mockDistributors.length > 0 
    ? Math.max(...mockDistributors.map(d => d.id)) + 1 
    : 1;

  const newDist = {
    id: newId,
    name: data.name || 'Nuevo Transportador',
    phone: data.phone || '',
    email: data.email || '',
    rif: data.rif || `J-${String(newId).padStart(8, '0')}-0`,
    is_active: true,
    badge_color: '#005187'
  };

  mockDistributors.push(newDist);
  return newDist;
}

export async function getDistributor(id) {
  return getRequest(`/distributors/${id}/`, {}, { auth: true });
}

export async function updateDistributor(id, data = {}) {
  return patchRequest(`/distributors/${id}/`, data, { auth: true });
}

/**
 * Catálogo geográfico de Estados y Municipios principales de Venezuela
 * para autocompletado y selección en formularios de envío.
 */
export const VENEZUELA_GEO_DATA = {
  "Carabobo": ["Valencia", "Naguanagua", "San Diego", "Guacara", "Puerto Cabello", "Los Guayos", "Bejuma", "Montalbán", "Libertador", "Carlos Arvelo"],
  "Distrito Capital": ["Libertador"],
  "Miranda": ["Chacao", "Baruta", "Sucre", "El Hatillo", "Los Salias", "Guaicaipuro", "Plaza", "Zamora", "Carrizal", "Independencia"],
  "Aragua": ["Girardot", "Santiago Mariño", "José Félix Ribas", "Mario Briceño Iragorry", "Sucre", "Zamora", "Linares Alcántara"],
  "Zulia": ["Maracaibo", "San Francisco", "Cabimas", "Lagunillas", "Machiques de Perijá", "Mara", "Rosario de Perijá"],
  "Lara": ["Iribarren", "Palavecino", "Torres", "Morán", "Jiménez", "Crespo"],
  "Anzoátegui": ["Bolívar", "Sotillo", "Diego Bautista Urbaneja", "Anaco", "Simón Rodríguez", "Guanta"],
  "Bolívar": ["Caroní", "Angostura del Orinoco", "Piar", "Roscio", "Gran Sabana"],
  "Táchira": ["San Cristóbal", "Cárdenas", "Junín", "Bolívar", "Jáuregui", "Ayacucho"],
  "Mérida": ["Libertador", "Alberto Adriani", "Campo Elías", "Sucre", "Tovar"],
  "Yaracuy": ["San Felipe", "Independencia", "Peña", "Nirgua", "Bruzual"],
  "Falcón": ["Miranda", "Carirubana", "Silva", "Los Taques", "Monseñor Iturriza"],
  "Monagas": ["Maturín", "Ezequiel Zamora", "Bolívar", "Piar", "Caripe"],
  "Nueva Esparta": ["Mariño", "Maneiro", "Arismendi", "García", "Antolín del Campo"],
  "Barinas": ["Barinas", "Bolívar", "Pedraza", "Alberto Arvelo Torrealba", "Antonio José de Sucre"],
  "Portuguesa": ["Páez", "Araure", "Guanare", "Turén", "Esteller"],
  "Sucre": ["Sucre", "Bermúdez", "Montes", "Ribero", "Valdez"],
  "Trujillo": ["Trujillo", "Valera", "Boconó", "Rafael Rangel", "Carache"],
  "Guárico": ["Juan Germán Roscio", "Francisco de Miranda", "Leonardo Infante", "Zaraza", "Monagas"],
  "Apure": ["San Fernando", "Páez", "Biruaca", "Achaguas"],
  "Cojedes": ["Ezequiel Zamora", "Tinaquillo", "Lima Blanco", "Tinaco"],
  "Delta Amacuro": ["Tucupita", "Casacoima"],
  "Amazonas": ["Atures", "Autana", "Manapiare"],
  "La Guaira": ["Vargas"]
};

/**
 * Consulta distribuidores disponibles según ubicación geográfica (Estado y Municipio)
 * Conecta con el backend Django /distributors/available/?state=...&municipality=...
 */
export async function getAvailableDistributors(params = {}) {
  try {
    const res = await getRequest('/distributors/available/', params, { auth: true });
    if (res && Array.isArray(res.distributors)) {
      return res.distributors;
    }
  } catch (err) {
    console.warn('[TuEstante Shipment API] Fallo al consultar distribuidores disponibles en backend, calculando localmente:', err);
  }

  // Lógica de cálculo en base al directorio actual
  const cleanState = (params.state || params.estado || '').trim().toLowerCase();
  const cleanMuni = (params.municipality || params.municipio || '').trim().toLowerCase();
  const allDist = await getDistributors();

  return allDist.map(d => {
    const isNational = d.coverage_type === 'national' || !d.coverage_type;
    return {
      id: d.id,
      name: d.name,
      rif: d.rif,
      phone: d.phone,
      email: d.email,
      coverage_type: d.coverage_type || (isNational ? 'national' : 'regional'),
      coverage_type_display: isNational ? 'Nacional (Todo el país)' : 'Regional / Eje Central',
      estimated_days_min: isNational ? 2 : 1,
      estimated_days_max: isNational ? 5 : 2,
      base_shipping_cost: isNational ? 15.00 : 5.00,
      matched_coverage: isNational ? 'Nacional (Cubre todo el país)' : `${params.state || 'Región Central'} - ${params.municipality || 'Cobertura Local'}`
    };
  });
}

/**
 * Registra una nueva zona de cobertura para un distribuidor
 */
export async function createDistributorCoverage(data = {}) {
  return postRequest('/distributor-coverages/', data, { auth: true });
}

export async function updateDistributorCoverage(id, data = {}) {
  return patchRequest(`/distributor-coverages/${id}/`, data, { auth: true });
}

/**
 * Elimina una zona de cobertura por su ID
 */
export async function deleteDistributorCoverage(id) {
  return deleteRequest(`/distributor-coverages/${id}/`, { auth: true });
}


/**
 * Obtiene pedidos listos para despacho para el selector y autocompletado
 * Permite buscar por cliente, código de pedido y productos incluidos
 */
export async function getOrdersForShipmentSelect() {
  try {
    const res = await getRequest('/orders/', { status__in: 'waiting_final_payment,final_payment_review' }, { auth: true });
    if (Array.isArray(res) && res.length > 0) {
      return res.map(o => ({
        id: o.id,
        order_code: o.order_code || `#00${o.id}`,
        client_name: o.client?.name || o.client_name || 'Cliente TuEstante',
        client_phone: o.client?.phone || o.client_phone || '+58 412 000 0000',
        client_email: o.client?.email || o.client_email || 'cliente@email.com',
        state: o.shipping_address?.state || o.state || 'Distrito Capital',
        municipality: o.shipping_address?.municipality || o.municipality || 'Libertador',
        city: o.shipping_address?.city || o.city || 'Caracas',
        address: o.shipping_address?.line1 || o.address || 'Dirección registrada en pedido',
        items_count: (o.items || []).length || 1,
        total_amount: o.total_amount || 250.00,
        items: o.items || []
      }));
    }
  } catch (err) {
    console.warn('[TuEstante Shipment API] Fallo al consultar órdenes del backend, usando mock completo:', err);
  }

  return [
    {
      id: 125,
      order_code: "#00125",
      client_name: "Juan Pérez",
      client_phone: "+58 412 876 5432",
      client_email: "juan@email.com",
      state: "Distrito Capital",
      municipality: "Libertador",
      city: "Caracas",
      address: "Av. Libertador, Edif. Centro Empresarial, Piso 4, Ofic. 42",
      items_count: 2,
      total_amount: 350.00,
      items: [
        { product_name: "Estante Modelo A (Roble)", specs: "180x80x30 cm", quantity: 1 },
        { product_name: "Accesorio X (Herrajes)", specs: "Negro Mate", quantity: 2 }
      ]
    },
    {
      id: 126,
      order_code: "#00126",
      client_name: "Sofía Castro",
      client_phone: "+58 414 999 1122",
      client_email: "sofia.castro@gmail.com",
      state: "Miranda",
      municipality: "Guaicaipuro",
      city: "Los Teques",
      address: "Urb. El Paso, Calle 4, Casa #45",
      items_count: 1,
      total_amount: 180.00,
      items: [
        { product_name: "Mesa de Noche Nórdica", specs: "Blanco / Madera", quantity: 2 }
      ]
    },
    {
      id: 127,
      order_code: "#00127",
      client_name: "Andrés Navarro",
      client_phone: "+58 424 555 7788",
      client_email: "andres.navarro@gmail.com",
      state: "Aragua",
      municipality: "Girardot",
      city: "Maracay",
      address: "Av. Las Delicias, Centro Empresarial Europa, Local PB-03",
      items_count: 1,
      total_amount: 220.00,
      items: [
        { product_name: "Estante Modular 4 Niveles", specs: "Negro Texturizado", quantity: 1 }
      ]
    },
    {
      id: 128,
      order_code: "#00128",
      client_name: "Valentina Mendoza",
      client_phone: "+58 416 333 4455",
      client_email: "valentina.m@gmail.com",
      state: "Carabobo",
      municipality: "Valencia",
      city: "Valencia",
      address: "Urb. El Viñedo, Av. Monseñor Adams, Res. La Floresta, Apto 5-B",
      items_count: 1,
      total_amount: 310.00,
      items: [
        { product_name: "Escritorio Minimalista L", specs: "Roble / Metal Negro", quantity: 1 }
      ]
    },
    {
      id: 129,
      order_code: "#00129",
      client_name: "Carlos Rodríguez",
      client_phone: "+58 414 777 9900",
      client_email: "carlos.rod@hotmail.com",
      state: "Lara",
      municipality: "Iribarren",
      city: "Barquisimeto",
      address: "Carrera 19 entre Calles 24 y 25, Edif. Los Andes",
      items_count: 2,
      total_amount: 290.00,
      items: [
        { product_name: "Librero Alto Premium", specs: "Cerezo Oscuro", quantity: 1 },
        { product_name: "Repisa Flotante Hexagonal", specs: "Nogal Americano", quantity: 2 }
      ]
    }
  ];
}

