/**
 * ==========================================================================
 * TUESTANTE ADMIN - MÓDULO DE SERVICIOS API PARA PEDIDOS (ORDER.API.JS)
 * ==========================================================================
 * Declara las funciones de comunicación con los endpoints de Pedidos, Pagos
 * y Fabricación. Consume el cliente centralizado importando desde /js/api.js.
 */

import { 
  getRequest, 
  postRequest, 
  patchRequest, 
  putRequest, 
  deleteRequest, 
  extractList, 
  resolveImageUrl 
} from '../../js/api.js';

/**
 * ==========================================================================
 * DATOS MOCK DE RESPALDO (Fieles a la captura de pantalla para desarrollo)
 * ==========================================================================
 */
export const MOCK_ORDERS = [
  {
    id: 125,
    order_code: "#00125",
    client: {
      name: "Juan Pérez",
      email: "juan@email.com",
      phone: "+58 412 123 4567"
    },
    shipping_address: {
      line1: "Av. Principal, Casa #123",
      city_state: "San Cristóbal, Táchira",
      country: "Venezuela"
    },
    payment_method: "Transferencia / Pago móvil",
    items: [
      { 
        id: 1, 
        product_name: "Estante Modelo A", 
        specs: "Color: Roble | Tamaño: Mediano", 
        quantity: 2, 
        unit_price: 150.00, 
        total_price: 300.00, 
        image: "../../assets/images/logo.jpeg",
        notes: "Acabado madera natural barnizada" 
      },
      { 
        id: 2, 
        product_name: "Accesorio X", 
        specs: "Color: Negro | Material: Metal", 
        quantity: 1, 
        unit_price: 50.00, 
        total_price: 50.00, 
        image: "../../assets/images/logo.jpeg",
        notes: "Ganchos reforzados para colgar herramientas" 
      }
    ],
    items_count: 3,
    total_amount: 350.00,
    payment_info: {
      status_label: "Pago inicial aprobado",
      paid_amount: 175.00,
      total_amount: 350.00,
      percentage: 50,
      stage: "initial_approved",
      color_class: "payment-half-approved"
    },
    payments_list: [
      {
        id: 201,
        title: "Pago inicial",
        amount: 175.00,
        status: "approved",
        status_label: "Aprobado",
        date: "31/08/2026 - 11:20 AM",
        payment_method: "Pago móvil Banesco",
        reference: "REF-849204",
        receipt_url: "../../assets/images/logo.jpeg"
      },
      {
        id: 202,
        title: "Pago final",
        amount: 175.00,
        status: "pending",
        status_label: "Pendiente",
        date: "-",
        payment_method: "-",
        reference: "-",
        receipt_url: null
      }
    ],
    timeline_steps: [
      { id: "pending_payment", label: "Pendiente de pago", date: "31/08/2026 - 10:32 AM", status: "completed" },
      { id: "initial_review", label: "Pago inicial en revisión", date: "31/08/2026 - 11:05 AM", status: "completed" },
      { id: "initial_approved", label: "Pago inicial aprobado", date: "31/08/2026 - 11:20 AM", status: "completed" },
      { id: "manufacturing", label: "En fabricación", date: "31/08/2026 - 02:45 PM", status: "completed" },
      { id: "waiting_final_payment", label: "Esperando pago final", date: "01/09/2026 - 10:00 AM (En curso)", status: "current" },
      { id: "final_review", label: "Pago final en revisión", date: "Pendiente", status: "pending" },
      { id: "shipped", label: "Enviado", date: "Pendiente", status: "pending" },
      { id: "completed", label: "Finalizado", date: "Pendiente", status: "pending" },
      { id: "refunded", label: "Devuelto", date: "No aplica", status: "pending" }
    ],
    status: "manufacturing",
    status_label: "En fabricación",
    status_badge_class: "badge-manufacturing",
    created_at: "2026-08-31T10:32:00",
    formatted_date: "31 de agosto de 2026",
    formatted_time: "10:32 AM",
    client_notes: "Por favor, entregar en la tarde. Gracias!",
    internal_notes: "Revisar stock de accesorios antes de fabricar.",
    notes: "Por favor, entregar en la tarde. Gracias!"
  },
  {
    id: 124,
    order_code: "#00124",
    client: {
      name: "María López",
      email: "maria@email.com",
      phone: "+58 424 9876543"
    },
    items: [
      { id: 3, product_name: "Gabinete Organizador de Herramientas", quantity: 1, unit_price: 280.00, total_price: 280.00, notes: "Reforzado con cerradura de seguridad" }
    ],
    items_count: 1,
    total_amount: 280.00,
    payment_info: {
      status_label: "En revisión",
      paid_amount: 140.00,
      total_amount: 280.00,
      percentage: 50,
      stage: "review",
      color_class: "payment-in-review"
    },
    status: "payment_review",
    status_label: "Pago en revisión",
    status_badge_class: "badge-payment-review",
    created_at: "2026-08-31T09:45:00",
    formatted_date: "31/08/2026",
    formatted_time: "09:45",
    notes: "Comprobante bancario Banco de Venezuela Nro Ref: 849204."
  },
  {
    id: 123,
    order_code: "#00123",
    client: {
      name: "Pedro Díaz",
      email: "pedro@email.com",
      phone: "+58 414 5556677"
    },
    items: [
      { id: 4, product_name: "Estantería Liviana Ranurada", quantity: 2, unit_price: 70.00, total_price: 140.00, notes: "Color blanco" },
      { id: 5, product_name: "Caja Gavetero Plástico Porta Piezas", quantity: 1, unit_price: 50.00, total_price: 50.00, notes: "Azul" }
    ],
    items_count: 3,
    total_amount: 190.00,
    payment_info: {
      status_label: "Pendiente",
      paid_amount: 95.00,
      total_amount: 190.00,
      percentage: 50,
      stage: "waiting_final",
      color_class: "payment-pending"
    },
    status: "waiting_final_payment",
    status_label: "Esperando pago final",
    status_badge_class: "badge-waiting-final",
    created_at: "2026-08-30T18:20:00",
    formatted_date: "30/08/2026",
    formatted_time: "18:20",
    notes: "Fabricación terminada con éxito. Listo para despachar al recibir el saldo restante."
  },
  {
    id: 122,
    order_code: "#00122",
    client: {
      name: "Ana Torres",
      email: "ana@email.com",
      phone: "+58 416 3332211"
    },
    items: [
      { id: 6, product_name: "Mesa de Trabajo de Acero con Repisas", quantity: 1, unit_price: 450.00, total_price: 450.00, notes: "Cubierta en acero inoxidable 304" }
    ],
    items_count: 1,
    total_amount: 450.00,
    payment_info: {
      status_label: "Completo",
      paid_amount: 450.00,
      total_amount: 450.00,
      percentage: 100,
      stage: "completed",
      color_class: "payment-complete"
    },
    status: "shipped",
    status_label: "Enviado",
    status_badge_class: "badge-shipped",
    created_at: "2026-08-30T16:10:00",
    formatted_date: "30/08/2026",
    formatted_time: "16:10",
    notes: "Guía de despacho Tealca Nro: TLC-99201948."
  },
  {
    id: 121,
    order_code: "#00121",
    client: {
      name: "Luis Ramírez",
      email: "luis@email.com",
      phone: "+58 426 7778899"
    },
    items: [
      { id: 7, product_name: "Armario Metálico 2 Puertas Batientes", quantity: 1, unit_price: 180.00, total_price: 180.00, notes: "Cerradura de 3 puntos" },
      { id: 8, product_name: "Bandeja Adicional Reforzada", quantity: 1, unit_price: 40.00, total_price: 40.00, notes: "Gris" }
    ],
    items_count: 2,
    total_amount: 220.00,
    payment_info: {
      status_label: "Pendiente",
      paid_amount: 110.00,
      total_amount: 220.00,
      percentage: 0,
      stage: "pending_initial",
      color_class: "payment-pending"
    },
    status: "pending_payment",
    status_label: "Pendiente de pago",
    status_badge_class: "badge-pending-payment",
    created_at: "2026-08-30T11:05:00",
    formatted_date: "30/08/2026",
    formatted_time: "11:05",
    notes: "Esperando confirmación del primer abono inicial."
  },
  {
    id: 120,
    order_code: "#00120",
    client: {
      name: "Carla Ruiz",
      email: "carla@email.com",
      phone: "+58 412 8889900"
    },
    items: [
      { id: 9, product_name: "Lockers Escolar 6 Casilleros", quantity: 1, unit_price: 300.00, total_price: 300.00, notes: "Pintura electrostática azul y blanco" }
    ],
    items_count: 1,
    total_amount: 300.00,
    payment_info: {
      status_label: "Pago inicial aprobado",
      paid_amount: 150.00,
      total_amount: 300.00,
      percentage: 50,
      stage: "initial_review",
      color_class: "payment-half-approved"
    },
    status: "initial_review",
    status_label: "Pago inicial en revisión",
    status_badge_class: "badge-initial-review",
    created_at: "2026-08-29T20:15:00",
    formatted_date: "29/08/2026",
    formatted_time: "20:15",
    notes: "Abono inicial reportado por Pago Móvil Banco Banesco."
  },
  {
    id: 119,
    order_code: "#00119",
    client: {
      name: "Diego Silva",
      email: "diego@email.com",
      phone: "+58 414 4443322"
    },
    items: [
      { id: 10, product_name: "Estante Mezzanina Doble Altura", quantity: 2, unit_price: 250.00, total_price: 500.00, notes: "Incluye escalerilla de acceso" },
      { id: 11, product_name: "Set de Divisores Metálicos", quantity: 2, unit_price: 50.00, total_price: 100.00, notes: "Galvanizado" }
    ],
    items_count: 4,
    total_amount: 600.00,
    payment_info: {
      status_label: "Completo",
      paid_amount: 600.00,
      total_amount: 600.00,
      percentage: 100,
      stage: "completed",
      color_class: "payment-complete"
    },
    status: "completed",
    status_label: "Finalizado",
    status_badge_class: "badge-completed",
    created_at: "2026-08-29T15:40:00",
    formatted_date: "29/08/2026",
    formatted_time: "15:40",
    notes: "Pedido entregado e instalado satisfactoriamente en almacén del cliente."
  },
  {
    id: 118,
    order_code: "#00118",
    client: {
      name: "Sofía Gómez",
      email: "sofia@email.com",
      phone: "+58 424 1112233"
    },
    items: [
      { id: 12, product_name: "Archivador Metálico 4 Gavetas", quantity: 1, unit_price: 150.00, total_price: 150.00, notes: "Cerradura central y correderas telescópicas" }
    ],
    items_count: 1,
    total_amount: 150.00,
    payment_info: {
      status_label: "Pagado",
      paid_amount: 150.00,
      total_amount: 150.00,
      percentage: 100,
      stage: "refunded",
      color_class: "payment-complete"
    },
    status: "refunded",
    status_label: "Devuelto",
    status_badge_class: "badge-refunded",
    created_at: "2026-08-28T13:25:00",
    formatted_date: "28/08/2026",
    formatted_time: "13:25",
    notes: "Cliente canceló el pedido por cambio de sede comercial."
  }
];

/**
 * ==========================================================================
 * SERVICIOS API PARA EL MÓDULO DE PEDIDOS
 * ==========================================================================
 */

const ORDER_STATUS_LABELS = {
  pending_initial_payment: 'Pendiente de pago',
  initial_payment_review: 'Pago inicial en revisión',
  manufacturing: 'En fabricación',
  waiting_final_payment: 'Esperando pago final',
  final_payment_review: 'Pago final en revisión',
  shipped: 'Enviado',
  finalized: 'Finalizado',
  returned_manufacturing: 'Devuelto / En refabricación',
  cancelled: 'Cancelado'
};

export function normalizeOrder(order = {}) {
  const client = typeof order.user === 'string'
    ? { name: order.user, email: '', phone: '' }
    : (order.client || order.user || {});
  const details = order.details || [];
  const items = details.flatMap(detail => (detail.order_products || []).length
    ? detail.order_products.map(orderProduct => ({
      id: orderProduct.id,
      product_id: orderProduct.product?.id,
      product_name: orderProduct.product?.product_name || 'Producto',
      specs: orderProduct.product?.description || detail.notes || 'Especificación estándar',
      quantity: detail.quantity || 1,
      unit_price: Number(detail.unit_price || orderProduct.price_at_order || 0),
      total_price: Number(detail.final_price || 0),
      image: orderProduct.product?.image_url ? resolveImageUrl(orderProduct.product.image_url) : (orderProduct.product?.image ? resolveImageUrl(orderProduct.product.image) : '../../assets/images/logo.jpeg'),
      notes: detail.notes || ''
    }))
    : [{
      id: detail.id,
      product_name: 'Producto',
      specs: detail.notes || 'Especificación estándar',
      quantity: detail.quantity || 1,
      unit_price: Number(detail.unit_price || 0),
      total_price: Number(detail.final_price || 0),
      image: '../../assets/images/logo.jpeg',
      notes: detail.notes || ''
    }]
  );
  const total = Number(order.total_price ?? order.total_amount ?? 0);
  const bcvRate = Number(order.bcv_rate || 0);
  const totalBs = Number(order.total_price_bs ?? (bcvRate > 0 ? (total * bcvRate) : 0));

  // 1. Dirección de envío normalizada
  const shipment = (order.shipments && order.shipments[0]) || {};
  const shipping_address = order.shipping_address || {
    line1: shipment.address || 'No registrada',
    address: shipment.address || 'No registrada',
    city: shipment.city || '',
    municipality: shipment.municipality || '',
    state: shipment.state || '',
    city_state: [shipment.city, shipment.municipality, shipment.state].filter(Boolean).join(', ') || 'No registrada',
    country: 'Venezuela'
  };

  // 2. Método de pago
  const payment_method = order.payment_method_label || order.payment_method || (shipment.distributor_name ? `Flete / ${shipment.distributor_name}` : 'Transferencia / Pago móvil');

  // 3. Lista de pagos normalizada a partir de payment_summary o order.payments
  const payments_list = [];
  const rawPayments = Array.isArray(order.payments) ? order.payments : [];

  if (order.payment_summary) {
    const ps = order.payment_summary;
    if (ps.initial) {
      payments_list.push({
        id: ps.initial.id || 201,
        payment_stage: 'initial',
        title: 'Pago inicial (50%)',
        amount_usd: Number(ps.initial.amount_usd || 0),
        amount_bs: Number(ps.initial.amount_bs || 0),
        rate_applied: bcvRate,
        status: ps.initial.status,
        status_label: ps.initial.status_label,
        date: ps.initial.created_at ? (typeof ps.initial.created_at === 'string' && ps.initial.created_at.includes('T') ? new Date(ps.initial.created_at).toLocaleDateString('es-ES') : ps.initial.created_at) : '-',
        payment_method: ps.initial.payment_method || 'Pago Móvil / Transferencia',
        reference: ps.initial.reference || '-',
        receipt_url: ps.initial.receipt_url ? resolveImageUrl(ps.initial.receipt_url) : null,
        is_edited: false
      });
    }
    if (ps.final) {
      payments_list.push({
        id: ps.final.id || 202,
        payment_stage: 'final',
        title: 'Pago final (50%)',
        amount_usd: Number(ps.final.amount_usd || 0),
        amount_bs: Number(ps.final.amount_bs || 0),
        rate_applied: bcvRate,
        status: ps.final.status,
        status_label: ps.final.status_label,
        date: ps.final.created_at ? (typeof ps.final.created_at === 'string' && ps.final.created_at.includes('T') ? new Date(ps.final.created_at).toLocaleDateString('es-ES') : ps.final.created_at) : '-',
        payment_method: ps.final.payment_method || 'Pago Móvil / Transferencia',
        reference: ps.final.reference || '-',
        receipt_url: ps.final.receipt_url ? resolveImageUrl(ps.final.receipt_url) : null,
        is_edited: false
      });
    }
  } else {
    // Si no vino payment_summary, construir desde rawPayments
    const initPay = rawPayments.find(p => p.payment_stage === 'initial');
    const finalPay = rawPayments.find(p => p.payment_stage === 'final');
    const half = Number((total / 2).toFixed(2));

    payments_list.push({
      id: initPay?.id || 201,
      payment_stage: 'initial',
      title: 'Pago inicial (50%)',
      amount_usd: Number(initPay?.amount || half),
      amount_bs: Number((Number(initPay?.amount || half) * (bcvRate || 1)).toFixed(2)),
      rate_applied: bcvRate,
      status: initPay ? initPay.status : 'unregistered',
      status_label: initPay ? (initPay.status_label || (initPay.status === 'approved' ? 'Aprobado' : 'Pendiente de revisión')) : 'Pendiente por registrar',
      date: initPay?.created_at ? new Date(initPay.created_at).toLocaleDateString('es-ES') : '-',
      payment_method: initPay?.payment_method_label || initPay?.payment_method || 'Pago Móvil',
      reference: initPay?.reference_number || '-',
      receipt_url: initPay?.receipt_file_url ? resolveImageUrl(initPay.receipt_file_url) : null,
      is_edited: false
    });

    payments_list.push({
      id: finalPay?.id || 202,
      payment_stage: 'final',
      title: 'Pago final (50%)',
      amount_usd: Number(finalPay?.amount || (total - half)),
      amount_bs: Number((Number(finalPay?.amount || (total - half)) * (bcvRate || 1)).toFixed(2)),
      rate_applied: bcvRate,
      status: finalPay ? finalPay.status : 'unregistered',
      status_label: finalPay ? (finalPay.status_label || (finalPay.status === 'approved' ? 'Aprobado' : 'Pendiente de revisión')) : 'Pendiente por registrar',
      date: finalPay?.created_at ? new Date(finalPay.created_at).toLocaleDateString('es-ES') : '-',
      payment_method: finalPay?.payment_method_label || finalPay?.payment_method || 'Pago Móvil',
      reference: finalPay?.reference_number || '-',
      receipt_url: finalPay?.receipt_file_url ? resolveImageUrl(finalPay.receipt_file_url) : null,
      is_edited: false
    });
  }

  // 4. Stepper timeline
  let timeline_steps = [];
  if (Array.isArray(order.timeline) && order.timeline.length > 0) {
    timeline_steps = order.timeline.map(t => ({
      id: t.status_key,
      label: t.label,
      status: t.state, // 'completed' | 'current' | 'pending'
      date: t.date_display
    }));
  } else {
    const FLOW = [
      { id: 'pending_initial_payment', label: 'Pendiente de pago' },
      { id: 'initial_payment_review', label: 'Pago inicial en revisión' },
      { id: 'manufacturing', label: 'En fabricación' },
      { id: 'waiting_final_payment', label: 'Esperando pago final' },
      { id: 'final_payment_review', label: 'Pago final en revisión' },
      { id: 'shipped', label: 'Enviado' },
      { id: 'finalized', label: 'Finalizado' }
    ];
    const currentIdx = FLOW.findIndex(f => f.id === order.status);
    timeline_steps = FLOW.map((f, idx) => ({
      id: f.id,
      label: f.label,
      status: currentIdx === -1 ? 'pending' : idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'pending',
      date: idx < currentIdx ? 'Completado' : idx === currentIdx ? 'En curso' : 'Pendiente'
    }));
  }

  return {
    ...order,
    order_code: order.order_code || order.order_number || `#${String(order.id || '').padStart(5, '0')}`,
    client,
    shipping_address,
    payment_method,
    items,
    items_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    total_amount: total,
    total_amount_bs: totalBs,
    bcv_rate: bcvRate,
    payments_list,
    timeline_steps,
    status_label: order.status_label || ORDER_STATUS_LABELS[order.status] || order.status,
    status_badge_class: {
      'pending_initial_payment': 'badge-pending-payment',
      'initial_payment_review': 'badge-payment-review',
      'manufacturing': 'badge-manufacturing',
      'waiting_final_payment': 'badge-waiting-final',
      'final_payment_review': 'badge-payment-review',
      'shipped': 'badge-shipped',
      'finalized': 'badge-approved',
      'returned_manufacturing': 'badge-pending',
      'cancelled': 'badge-pending'
    }[order.status] || 'badge-manufacturing',
    formatted_date: order.created_at ? new Date(order.created_at).toLocaleDateString('es-ES') : '',
    formatted_time: order.created_at ? new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''
  };
}

/**
 * Obtiene el listado de pedidos desde el backend con soporte para filtros y paginación.
 * En caso de no haber conexión o error de red, retorna los datos de respaldo (MOCK_ORDERS).
 * 
 * @param {Object} [filters={}] Filtros de búsqueda (search, status, date_from, date_to, page, page_size)
 * @returns {Promise<{results: Array, total: number, page: number, total_pages: number}>}
 */
export async function getOrders(filters = {}) {
  try {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.status && filters.status !== 'all' && filters.status !== 'todos') params.status = filters.status;
    if (filters.date_from) params.created_after = filters.date_from;
    if (filters.date_to) params.created_before = filters.date_to;
    if (filters.page) params.page = filters.page;
    if (filters.page_size) params.page_size = filters.page_size;

    const response = await getRequest('/orders/', params, { auth: true });
    const list = extractList(response);

    if (list && list.length > 0) {
      return {
        results: list.map(normalizeOrder),
        total: response.count || list.length,
        page: filters.page || 1,
        total_pages: Math.ceil((response.count || list.length) / (filters.page_size || 8))
      };
    }
    return {
      results: [],
      total: 0,
      page: filters.page || 1,
      total_pages: 1
    };
  } catch (error) {
    throw error;
  }

  // Fallback con filtro local sobre los datos Mock
  let filtered = [...MOCK_ORDERS];

  // Filtro por término de búsqueda (código, cliente, email, teléfono)
  if (filters.search) {
    const term = filters.search.toLowerCase().trim();
    filtered = filtered.filter(o => 
      o.order_code.toLowerCase().includes(term) ||
      o.client.name.toLowerCase().includes(term) ||
      o.client.email.toLowerCase().includes(term) ||
      (o.client.phone && o.client.phone.includes(term))
    );
  }

  // Filtro por Estado
  if (filters.status && filters.status !== 'all' && filters.status !== 'todos') {
    filtered = filtered.filter(o => o.status === filters.status);
  }

  // Filtro por Rango de Fechas
  if (filters.date_from) {
    filtered = filtered.filter(o => o.created_at >= filters.date_from);
  }
  if (filters.date_to) {
    filtered = filtered.filter(o => o.created_at <= `${filters.date_to}T23:59:59`);
  }

  const pageSize = filters.page_size || 8;
  const page = filters.page || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedResults = filtered.slice(startIndex, startIndex + pageSize);

  return {
    results: paginatedResults,
    total: filtered.length,
    page: page,
    total_pages: Math.max(1, Math.ceil(filtered.length / pageSize))
  };
}

/**
 * Obtiene el detalle de un pedido específico por su ID.
 * @param {number|string} orderId ID del pedido
 * @returns {Promise<Object>}
 */
export async function getOrderById(orderId) {
  try {
    const data = await getRequest(`/orders/${orderId}/`, {}, { auth: true });
    if (data) {
      if ((!data.payments || data.payments.length === 0) && !data.payment_summary) {
        try {
          const payData = await getRequest('/payments/', { order_id: orderId }, { auth: true });
          const payList = extractList(payData);
          if (payList && payList.length > 0) {
            data.payments = payList;
          }
        } catch (pErr) {
          console.warn('[order.api] Error al consultar pagos secundarios:', pErr);
        }
      }
      return normalizeOrder(data);
    }
  } catch (error) {
    throw error;
  }
  return null;
}

/**
 * Consulta la tasa de cambio oficial del día persistida en el backend.
 * @returns {Promise<{date: string, rate: number, formatted_rate: string, source: string}|null>}
 */
export async function getDailyExchangeRate() {
  try {
    return await getRequest('/orders/current_rate/', {}, { auth: false });
  } catch (error) {
    console.warn('[order.api] Error al obtener tasa diaria:', error);
    return null;
  }
}

/**
 * Crea un nuevo pedido en el sistema.
 * @param {Object} orderPayload Datos del pedido (items, client_id, notes)
 * @returns {Promise<Object>}
 */
export async function createOrder(orderPayload) {
  try {
    return await postRequest('/orders/', orderPayload, { auth: true });
  } catch (error) {
    throw error;
    
    // Simular nuevo pedido local con estructura compatible con Django model
    const newId = Date.now();
    const orderNumber = `ORD-000${Math.floor(10 + Math.random() * 90)}-2026`;
    const clientData = orderPayload.client || {
      name: "Cliente Nuevo",
      email: "cliente@email.com",
      phone: "+58 412 000 0000"
    };

    const items = (orderPayload.items || orderPayload.details || []).map((it, idx) => {
      const unitPrice = parseFloat(it.unit_price || it.price || 0);
      const qty = parseInt(it.quantity || 1, 10);
      return {
        id: idx + 1,
        product_id: it.product || it.product_id || 1,
        product_name: it.product_name || it.name || "Producto Personalizado",
        specs: it.notes || it.specs || "Especificación estándar",
        quantity: qty,
        unit_price: unitPrice,
        total_price: unitPrice * qty,
        final_price: unitPrice * qty,
        image: it.image || "../../assets/images/logo.jpeg",
        notes: it.notes || ""
      };
    });

    const calculatedTotal = items.reduce((acc, it) => acc + it.total_price, 0);
    const totalAmount = parseFloat(orderPayload.total_price || orderPayload.total_amount || calculatedTotal || 0);
    const initialDeposit = totalAmount * 0.5;

    const initialStatus = orderPayload.status || 'pending_initial_payment';
    const statusMap = {
      'pending_initial_payment': { label: 'Pendiente de pago inicial', badge: 'badge-pending-payment' },
      'initial_payment_review': { label: 'Pago inicial en revisión', badge: 'badge-initial-review' },
      'manufacturing': { label: 'En fabricación', badge: 'badge-manufacturing' },
      'waiting_final_payment': { label: 'Esperando pago final', badge: 'badge-waiting-final' },
      'final_payment_review': { label: 'Pago final en revisión', badge: 'badge-initial-review' },
      'shipped': { label: 'Enviado', badge: 'badge-shipped' },
      'finalized': { label: 'Finalizado', badge: 'badge-completed' },
      'returned_manufacturing': { label: 'Devuelto / En refabricación', badge: 'badge-refunded' },
      'cancelled': { label: 'Cancelado', badge: 'badge-refunded' }
    };

    const statusInfo = statusMap[initialStatus] || { label: 'Pendiente de pago inicial', badge: 'badge-pending-payment' };

    const newOrder = {
      id: newId,
      order_number: orderNumber,
      order_code: `#${orderNumber.slice(-8)}`,
      user: orderPayload.user || clientData.id || 1,
      client: clientData,
      shipping_address: orderPayload.shipping_address || {
        state: "Táchira",
        municipality: "San Cristóbal",
        city: "San Cristóbal",
        address: "Av. Principal, Sector Centro",
        line1: "Av. Principal, Sector Centro",
        city_state: "San Cristóbal, San Cristóbal, Edo. Táchira",
        country: "Venezuela"
      },
      payment_method: orderPayload.payment_method || "Transferencia / Pago móvil",
      items: items,
      details: items,
      items_count: items.length,
      total_price: totalAmount,
      total_amount: totalAmount,
      status: initialStatus,
      status_label: statusInfo.label,
      status_badge_class: statusInfo.badge,
      payment_info: {
        status_label: "Pendiente",
        paid_amount: 0.00,
        total_amount: totalAmount,
        percentage: 0,
        stage: "pending_initial",
        color_class: "payment-pending"
      },
      payments_list: [
        {
          id: Date.now() + 1,
          title: "Pago inicial",
          amount_usd: initialDeposit,
          amount_bs: null,
          rate_applied: null,
          status: "pending",
          status_label: "Pendiente",
          date: "-",
          payment_method: "-",
          reference: "-",
          receipt_url: null,
          is_edited: false
        },
        {
          id: Date.now() + 2,
          title: "Pago final",
          amount_usd: initialDeposit,
          amount_bs: null,
          rate_applied: null,
          status: "pending",
          status_label: "Pendiente",
          date: "-",
          payment_method: "-",
          reference: "-",
          receipt_url: null,
          is_edited: false
        }
      ],
      timeline_steps: [
        { id: "pending_initial_payment", label: "Pendiente de pago inicial", date: `${new Date().toLocaleDateString('es-ES')} • ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} (Actual)`, status: "current" },
        { id: "initial_payment_review", label: "Pago inicial en revisión", date: "Pendiente", status: "pending" },
        { id: "manufacturing", label: "En fabricación", date: "Pendiente", status: "pending" },
        { id: "waiting_final_payment", label: "Esperando pago final", date: "Pendiente", status: "pending" },
        { id: "final_payment_review", label: "Pago final en revisión", date: "Pendiente", status: "pending" },
        { id: "shipped", label: "Enviado", date: "Pendiente", status: "pending" },
        { id: "finalized", label: "Finalizado", date: "Pendiente", status: "pending" }
      ],
      created_at: new Date().toISOString(),
      formatted_date: new Date().toLocaleDateString('es-ES'),
      formatted_time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      notes: orderPayload.notes || "",
      internal_notes: orderPayload.internal_notes || ""
    };

    MOCK_ORDERS.unshift(newOrder);
    return newOrder;
  }
}

/**
 * Actualiza el estado de un pedido (ej. cancelar, avanzar de fase).
 * @param {number|string} orderId ID del pedido
 * @param {string} newStatus Nuevo código de estado
 * @param {string} [notes=''] Notas adicionales
 * @returns {Promise<Object>}
 */
export async function updateOrderStatus(orderId, newStatus, notes = '') {
  try {
    return await patchRequest(`/orders/${orderId}/`, { status: newStatus, notes }, { auth: true });
  } catch (error) {
    throw error;
    const order = MOCK_ORDERS.find(o => o.id === parseInt(orderId, 10));
    if (order) {
      order.status = newStatus;
    }
    return { success: true, orderId, newStatus };
  }
}

/**
 * Emite o regenera una Orden de Fabricación para el taller/fábrica.
 * @param {number|string} orderId ID del pedido
 * @returns {Promise<Object>}
 */
export async function issueManufacturingOrder(orderId) {
  try {
    return await postRequest(`/orders/${orderId}/issue_manufacturing_order/`, {}, { auth: true });
  } catch (error) {
    throw error;
    return { success: true, message: `Orden de fabricación emitida para el pedido #${orderId}` };
  }
}

/**
 * Revisa (aprueba o rechaza) un comprobante de pago de un pedido.
 * @param {number|string} paymentId ID del pago
 * @param {'approved'|'rejected'} status Estado de la revisión
 * @param {string} [rejectionReason=''] Motivo en caso de rechazo
 * @returns {Promise<Object>}
 */
export async function reviewPayment(paymentId, status, rejectionReason = '') {
  try {
    return await postRequest(`/payments/${paymentId}/review/`, {
      status,
      rejection_reason: rejectionReason
    }, { auth: true });
  } catch (error) {
    throw error;
    return { success: true, paymentId, status };
  }
}

/**
 * Crea o registra un nuevo pago / comprobante para un pedido.
 * @param {FormData|Object} payload Datos del pago (multipart o JSON)
 * @returns {Promise<Object>}
 */
export async function createPayment(payload) {
  return await postRequest('/payments/', payload, { auth: true });
}

/**
 * Actualiza parcialmente un pago (monto, referencia, método, notas).
 * @param {number|string} paymentId ID del pago
 * @param {Object} payload Datos a actualizar
 * @returns {Promise<Object>}
 */
export async function updatePayment(paymentId, payload) {
  return await patchRequest(`/payments/${paymentId}/`, payload, { auth: true });
}

/**
 * Actualiza los datos generales de un pedido (notas, dirección de entrega).
 * @param {number|string} orderId ID del pedido
 * @param {Object} payload Datos a actualizar
 * @returns {Promise<Object>}
 */
export async function updateOrderDetails(orderId, payload) {
  return await patchRequest(`/orders/${orderId}/`, payload, { auth: true });
}

/**
 * Obtiene la lista de clientes disponibles para asociar a nuevos pedidos.
 * @returns {Promise<Array>}
 */
export async function getClientsList() {
  try {
    const data = await getRequest('/user/', { is_active: true }, { auth: true });
    return extractList(data);
  } catch (error) {
    throw error;
    return [
      { 
        id: 1, 
        username: "juanp", 
        name: "Juan Pérez", 
        first_name: "Juan",
        first_last_name: "Pérez",
        identity_document: "V-18452369",
        email: "juan@email.com", 
        phone: "+58 412 123 4567"
      },
      { 
        id: 2, 
        username: "mariag", 
        name: "María González", 
        first_name: "María",
        first_last_name: "González",
        identity_document: "V-20185942",
        email: "maria.gonzalez@empresa.com", 
        phone: "+58 414 987 6543"
      },
      { 
        id: 3, 
        username: "carlosr", 
        name: "Carlos Rodríguez", 
        first_name: "Carlos",
        first_last_name: "Rodríguez",
        identity_document: "V-15894123",
        email: "carlos.prod@gmail.com", 
        phone: "+58 424 555 1234"
      },
      { 
        id: 4, 
        username: "inv_madera", 
        name: "Inversiones Madera & Acero C.A.", 
        first_name: "Inversiones Madera & Acero",
        first_last_name: "C.A.",
        identity_document: "J-31058492-1",
        email: "compras@maderayacero.com", 
        phone: "+58 212 900 1122"
      },
      { 
        id: 5, 
        username: "ana_torres", 
        name: "Ana Torres", 
        first_name: "Ana",
        first_last_name: "Torres",
        identity_document: "V-24789512",
        email: "ana.torres@gmail.com", 
        phone: "+58 416 333 2211"
      }
    ];
  }
}

/**
 * Obtiene la lista de productos del catálogo disponibles para agregar a pedidos.
 * @returns {Promise<Array>}
 */
export async function getProductsList() {
  try {
    const data = await getRequest('/products/products/', { is_active: true }, { auth: true });
    return extractList(data);
  } catch (error) {
    throw error;
    return [
      { 
        id: 1, 
        product_name: "Estante Modelo A (Modular)", 
        name: "Estante Modelo A (Modular)", 
        price: 150.00, 
        sku: "EST-MOD-A", 
        category: "Estantes Modulares",
        image: "../../assets/images/logo.jpeg",
        description: "Estante modular reforzado de 4 repisas regulables en altura."
      },
      { 
        id: 2, 
        product_name: "Estante Metálico Industrial 5 Niveles", 
        name: "Estante Metálico Industrial 5 Niveles", 
        price: 220.00, 
        sku: "EST-IND-5N", 
        category: "Línea Industrial",
        image: "../../assets/images/logo.jpeg",
        description: "Estructura de acero al carbono calibre 16 con capacidad de 250kg por nivel."
      },
      { 
        id: 3, 
        product_name: "Estantería Minimalista Roble / Metal", 
        name: "Estantería Minimalista Roble / Metal", 
        price: 180.00, 
        sku: "EST-MIN-ROB", 
        category: "Línea Hogar & Oficina",
        image: "../../assets/images/logo.jpeg",
        description: "Combinación de estructura negra mate y repisas en chapa de roble natural."
      },
      { 
        id: 4, 
        product_name: "Accesorio Organizador X (Ganchos Reforzados)", 
        name: "Accesorio Organizador X (Ganchos Reforzados)", 
        price: 50.00, 
        sku: "ACC-ORG-X", 
        category: "Accesorios",
        image: "../../assets/images/logo.jpeg",
        description: "Set de 8 ganchos de acero templado para colgado de herramientas."
      },
      { 
        id: 5, 
        product_name: "Bandeja Divisoria Ajustable", 
        name: "Bandeja Divisoria Ajustable", 
        price: 35.00, 
        sku: "ACC-BAN-DIV", 
        category: "Accesorios",
        image: "../../assets/images/logo.jpeg",
        description: "Bandeja corrediza galvanizada para clasificación de piezas pequeñas."
      },
      { 
        id: 6, 
        product_name: "Casillero Locker 4 Puertas", 
        name: "Casillero Locker 4 Puertas", 
        price: 290.00, 
        sku: "LCK-04-IND", 
        category: "Lockers",
        image: "../../assets/images/logo.jpeg",
        description: "Casillero metálico con portacandados y rejillas de ventilación."
      }
    ];
  }
}
