/**
 * ==========================================================================
 * TUESTANTE ADMIN - MÓDULO DE SERVICIOS API PARA PAGOS (PAYMENT.API.JS)
 * ==========================================================================
 * Declara las funciones de comunicación con los endpoints de Pagos y Comprobantes
 * del sistema TuEstante OMS.
 * 
 * IMPORTA las funciones y conexiones centralizadas desde /js/api.js.
 * Incluye soporte de doble moneda (USD y VES) tanto con tasas históricas 
 * registradas en el backend como con conversión en tiempo real.
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

import { 
  getDualPrice, 
  formatUSD, 
  formatVES, 
  convertUsdToVes 
} from '../../js/service/currency-converter.service.js';

/**
 * ==========================================================================
 * DATOS MOCK DE RESPALDO (Comprobantes y Pagos del Sistema TuEstante)
 * ==========================================================================
 */
export const MOCK_PAYMENTS = [
  {
    id: 89,
    payment_code: "#PAG-089",
    order_id: 125,
    order_code: "#00125",
    client: {
      id: 1,
      name: "Juan Pérez",
      email: "juan@email.com",
      phone: "+58 412 1234567"
    },
    payment_stage: "initial",
    payment_stage_label: "Pago Inicial",
    stage_badge_class: "badge-stage-initial",
    amount: 175.00,
    amount_ves: 6387.50, // Monto registrado en backend
    exchange_rate: 36.50, // Tasa histórica al momento del pago
    order_total: 350.00,
    order_total_ves: 12775.00,
    currency: "USD",
    formatted_amount: "$175.00",
    formatted_amount_ves: "Bs. 6.387,50",
    formatted_order_total: "$350.00",
    formatted_order_total_ves: "Bs. 12.775,00",
    payment_method: "mobile_payment",
    payment_method_label: "Pago Móvil",
    bank_name: "Banco de Venezuela",
    reference_number: "84920491",
    receipt_file_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
    receipt_filename: "comprobante_pagomovil_849204.jpg",
    status: "review",
    status_label: "En revisión",
    status_badge_class: "badge-status-review",
    created_at: "2026-08-31T09:45:00",
    formatted_date: "31/08/2026",
    formatted_time: "09:45",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: "",
    notes: "Abono inicial correspondiente a la fabricación de 1 estante industrial y 1 casillero locker.",
    order_summary: {
      id: 125,
      order_code: "#00125",
      status: "manufacturing",
      status_label: "En fabricación",
      status_badge_class: "badge-manufacturing",
      total_amount: 350.00,
      total_amount_ves: 12775.00,
      exchange_rate: 36.50,
      items_count: 2,
      created_at: "2026-08-31T08:00:00",
      items: [
        {
          id: 1,
          product_name: "Estante Metálico Industrial 5 Niveles",
          quantity: 1,
          unit_price_usd: 200.00,
          unit_price_ves: 7300.00,
          total_price_usd: 200.00,
          total_price_ves: 7300.00,
          notes: "Color gris plomo, acabado satinado reforzado"
        },
        {
          id: 2,
          product_name: "Casillero Locker 4 Puertas",
          quantity: 1,
          unit_price_usd: 150.00,
          unit_price_ves: 5475.00,
          total_price_usd: 150.00,
          total_price_ves: 5475.00,
          notes: "Cerradura con llave maestra individual"
        }
      ]
    }
  },
  {
    id: 88,
    payment_code: "#PAG-088",
    order_id: 124,
    order_code: "#00124",
    client: {
      id: 2,
      name: "María López",
      email: "maria@email.com",
      phone: "+58 424 9876543"
    },
    payment_stage: "initial",
    payment_stage_label: "Pago Inicial",
    stage_badge_class: "badge-stage-initial",
    amount: 140.00,
    amount_ves: 5110.00,
    exchange_rate: 36.50,
    order_total: 280.00,
    order_total_ves: 10220.00,
    currency: "USD",
    formatted_amount: "$140.00",
    formatted_amount_ves: "Bs. 5.110,00",
    formatted_order_total: "$280.00",
    formatted_order_total_ves: "Bs. 10.220,00",
    payment_method: "transfer",
    payment_method_label: "Transferencia Bancaria",
    bank_name: "Banesco Banco Universal",
    reference_number: "0029481023",
    receipt_file_url: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=800&q=80",
    receipt_filename: "transferencia_banesco_002948.pdf",
    status: "review",
    status_label: "En revisión",
    status_badge_class: "badge-status-review",
    created_at: "2026-08-31T08:30:00",
    formatted_date: "31/08/2026",
    formatted_time: "08:30",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: "",
    notes: "Transferencia directa de cuenta jurídica a Banesco.",
    order_summary: {
      id: 124,
      order_code: "#00124",
      status: "payment_review",
      status_label: "Pago en revisión",
      status_badge_class: "badge-payment-review",
      total_amount: 280.00,
      total_amount_ves: 10220.00,
      exchange_rate: 36.50,
      items_count: 1,
      created_at: "2026-08-31T07:30:00",
      items: [
        {
          id: 3,
          product_name: "Gabinete Organizador de Herramientas",
          quantity: 1,
          unit_price_usd: 280.00,
          unit_price_ves: 10220.00,
          total_price_usd: 280.00,
          total_price_ves: 10220.00,
          notes: "Reforzado con cerradura de seguridad central"
        }
      ]
    }
  },
  {
    id: 87,
    payment_code: "#PAG-087",
    order_id: 123,
    order_code: "#00123",
    client: {
      id: 3,
      name: "Pedro Díaz",
      email: "pedro@email.com",
      phone: "+58 414 5556677"
    },
    payment_stage: "final",
    payment_stage_label: "Pago Final (Saldo)",
    stage_badge_class: "badge-stage-final",
    amount: 95.00,
    amount_ves: 3467.50,
    exchange_rate: 36.50,
    order_total: 190.00,
    order_total_ves: 6935.00,
    currency: "USD",
    formatted_amount: "$95.00",
    formatted_amount_ves: "Bs. 3.467,50",
    formatted_order_total: "$190.00",
    formatted_order_total_ves: "Bs. 6.935,00",
    payment_method: "zelle",
    payment_method_label: "Zelle",
    bank_name: "Chase Bank",
    reference_number: "ZLL-90381928",
    receipt_file_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80",
    receipt_filename: "zelle_confirmacion_pedro.png",
    status: "review",
    status_label: "En revisión",
    status_badge_class: "badge-status-review",
    created_at: "2026-08-30T18:20:00",
    formatted_date: "30/08/2026",
    formatted_time: "18:20",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: "",
    notes: "Saldo restante para liberar el despacho de estanterías ranuradas.",
    order_summary: {
      id: 123,
      order_code: "#00123",
      status: "waiting_final_payment",
      status_label: "Esperando pago final",
      status_badge_class: "badge-waiting-final",
      total_amount: 190.00,
      total_amount_ves: 6935.00,
      exchange_rate: 36.50,
      items_count: 3,
      created_at: "2026-08-30T10:00:00",
      items: [
        {
          id: 4,
          product_name: "Estantería Liviana Ranurada 4 Repisas",
          quantity: 2,
          unit_price_usd: 70.00,
          unit_price_ves: 2555.00,
          total_price_usd: 140.00,
          total_price_ves: 5110.00,
          notes: "Color blanco electrostático"
        },
        {
          id: 5,
          product_name: "Caja Gavetero Plástico Porta Piezas",
          quantity: 1,
          unit_price_usd: 50.00,
          unit_price_ves: 1825.00,
          total_price_usd: 50.00,
          total_price_ves: 1825.00,
          notes: "Azul rey con porta etiquetas frontal"
        }
      ]
    }
  },
  {
    id: 86,
    payment_code: "#PAG-086",
    order_id: 122,
    order_code: "#00122",
    client: {
      id: 4,
      name: "Ana Torres",
      email: "ana@email.com",
      phone: "+58 416 3332211"
    },
    payment_stage: "final",
    payment_stage_label: "Pago Final (Saldo)",
    stage_badge_class: "badge-stage-final",
    amount: 225.00,
    amount_ves: 8190.00, // Histórico guardado en backend
    exchange_rate: 36.40,
    order_total: 450.00,
    order_total_ves: 16380.00,
    currency: "USD",
    formatted_amount: "$225.00",
    formatted_amount_ves: "Bs. 8.190,00",
    formatted_order_total: "$450.00",
    formatted_order_total_ves: "Bs. 16.380,00",
    payment_method: "transfer",
    payment_method_label: "Transferencia Bancaria",
    bank_name: "Banco Mercantil",
    reference_number: "MERC-4819028",
    receipt_file_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
    receipt_filename: "recibo_mercantil_final.jpg",
    status: "approved",
    status_label: "Aprobado",
    status_badge_class: "badge-status-approved",
    created_at: "2026-08-30T15:10:00",
    formatted_date: "30/08/2026",
    formatted_time: "15:10",
    reviewed_by: "Carlos A. (Admin)",
    reviewed_at: "2026-08-30T15:45:00",
    rejection_reason: "",
    notes: "Aprobado exitosamente. Se procedió a preparar guía de despacho.",
    order_summary: {
      id: 122,
      order_code: "#00122",
      status: "shipped",
      status_label: "Enviado",
      status_badge_class: "badge-shipped",
      total_amount: 450.00,
      total_amount_ves: 16380.00,
      exchange_rate: 36.40,
      items_count: 1,
      created_at: "2026-08-25T09:15:00",
      items: [
        {
          id: 6,
          product_name: "Mesa de Trabajo de Acero con Repisas",
          quantity: 1,
          unit_price_usd: 450.00,
          unit_price_ves: 16380.00,
          total_price_usd: 450.00,
          total_price_ves: 16380.00,
          notes: "Cubierta en acero inoxidable 304 calibre 18"
        }
      ]
    }
  },
  {
    id: 85,
    payment_code: "#PAG-085",
    order_id: 122,
    order_code: "#00122",
    client: {
      id: 4,
      name: "Ana Torres",
      email: "ana@email.com",
      phone: "+58 416 3332211"
    },
    payment_stage: "initial",
    payment_stage_label: "Pago Inicial",
    stage_badge_class: "badge-stage-initial",
    amount: 225.00,
    amount_ves: 8190.00,
    exchange_rate: 36.40,
    order_total: 450.00,
    order_total_ves: 16380.00,
    currency: "USD",
    formatted_amount: "$225.00",
    formatted_amount_ves: "Bs. 8.190,00",
    formatted_order_total: "$450.00",
    formatted_order_total_ves: "Bs. 16.380,00",
    payment_method: "transfer",
    payment_method_label: "Transferencia Bancaria",
    bank_name: "Banco Mercantil",
    reference_number: "MERC-4811002",
    receipt_file_url: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=800&q=80",
    receipt_filename: "recibo_mercantil_inicial.jpg",
    status: "approved",
    status_label: "Aprobado",
    status_badge_class: "badge-status-approved",
    created_at: "2026-08-25T11:00:00",
    formatted_date: "25/08/2026",
    formatted_time: "11:00",
    reviewed_by: "Carlos A. (Admin)",
    reviewed_at: "2026-08-25T11:30:00",
    rejection_reason: "",
    notes: "Abono inicial aprobado. Se emitió Orden de Fabricación.",
    order_summary: {
      id: 122,
      order_code: "#00122",
      status: "shipped",
      status_label: "Enviado",
      status_badge_class: "badge-shipped",
      total_amount: 450.00,
      total_amount_ves: 16380.00,
      exchange_rate: 36.40,
      items_count: 1,
      items: [
        {
          id: 6,
          product_name: "Mesa de Trabajo de Acero con Repisas",
          quantity: 1,
          unit_price_usd: 450.00,
          unit_price_ves: 16380.00,
          total_price_usd: 450.00,
          total_price_ves: 16380.00,
          notes: "Cubierta en acero inoxidable 304 calibre 18"
        }
      ]
    }
  },
  {
    id: 84,
    payment_code: "#PAG-084",
    order_id: 120,
    order_code: "#00120",
    client: {
      id: 5,
      name: "Carla Ruiz",
      email: "carla@email.com",
      phone: "+58 412 8889900"
    },
    payment_stage: "initial",
    payment_stage_label: "Pago Inicial",
    stage_badge_class: "badge-stage-initial",
    amount: 150.00,
    amount_ves: 5460.00,
    exchange_rate: 36.40,
    order_total: 300.00,
    order_total_ves: 10920.00,
    currency: "USD",
    formatted_amount: "$150.00",
    formatted_amount_ves: "Bs. 5.460,00",
    formatted_order_total: "$300.00",
    formatted_order_total_ves: "Bs. 10.920,00",
    payment_method: "mobile_payment",
    payment_method_label: "Pago Móvil",
    bank_name: "Banesco Banco Universal",
    reference_number: "99201948",
    receipt_file_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80",
    receipt_filename: "pagomovil_carla_banesco.png",
    status: "rejected",
    status_label: "Rechazado",
    status_badge_class: "badge-status-rejected",
    created_at: "2026-08-29T19:30:00",
    formatted_date: "29/08/2026",
    formatted_time: "19:30",
    reviewed_by: "Carlos A. (Admin)",
    reviewed_at: "2026-08-29T20:00:00",
    rejection_reason: "Referencia bancaria no encontrada en el estado de cuenta. Por favor verificar los datos o enviar captura completa.",
    notes: "Comprobante rechazado por incongruencia de referencia.",
    order_summary: {
      id: 120,
      order_code: "#00120",
      status: "pending_payment",
      status_label: "Pendiente de pago",
      status_badge_class: "badge-pending-payment",
      total_amount: 300.00,
      total_amount_ves: 10920.00,
      exchange_rate: 36.40,
      items_count: 1,
      items: [
        {
          id: 9,
          product_name: "Lockers Escolar 6 Casilleros",
          quantity: 1,
          unit_price_usd: 300.00,
          unit_price_ves: 10920.00,
          total_price_usd: 300.00,
          total_price_ves: 10920.00,
          notes: "Pintura electrostática azul y blanco"
        }
      ]
    }
  },
  {
    id: 83,
    payment_code: "#PAG-083",
    order_id: 119,
    order_code: "#00119",
    client: {
      id: 6,
      name: "Diego Silva",
      email: "diego@email.com",
      phone: "+58 414 4443322"
    },
    payment_stage: "final",
    payment_stage_label: "Pago Final (Saldo)",
    stage_badge_class: "badge-stage-final",
    amount: 300.00,
    amount_ves: 10890.00,
    exchange_rate: 36.30,
    order_total: 600.00,
    order_total_ves: 21780.00,
    currency: "USD",
    formatted_amount: "$300.00",
    formatted_amount_ves: "Bs. 10.890,00",
    formatted_order_total: "$600.00",
    formatted_order_total_ves: "Bs. 21.780,00",
    payment_method: "cash",
    payment_method_label: "Efectivo USD",
    bank_name: "Pago en Tienda / Taller",
    reference_number: "REC-EFEC-049",
    receipt_file_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
    receipt_filename: "recibo_caja_efectivo.pdf",
    status: "approved",
    status_label: "Aprobado",
    status_badge_class: "badge-status-approved",
    created_at: "2026-08-28T16:00:00",
    formatted_date: "28/08/2026",
    formatted_time: "16:00",
    reviewed_by: "Carlos A. (Admin)",
    reviewed_at: "2026-08-28T16:15:00",
    rejection_reason: "",
    notes: "Cobro en efectivo verificado en caja del taller.",
    order_summary: {
      id: 119,
      order_code: "#00119",
      status: "completed",
      status_label: "Finalizado",
      status_badge_class: "badge-completed",
      total_amount: 600.00,
      total_amount_ves: 21780.00,
      exchange_rate: 36.30,
      items_count: 4,
      items: [
        {
          id: 10,
          product_name: "Estante Mezzanina Doble Altura",
          quantity: 2,
          unit_price_usd: 250.00,
          unit_price_ves: 9075.00,
          total_price_usd: 500.00,
          total_price_ves: 18150.00,
          notes: "Incluye escalerilla de acceso galvanizada"
        },
        {
          id: 11,
          product_name: "Set de Divisores Metálicos",
          quantity: 2,
          unit_price_usd: 50.00,
          unit_price_ves: 1815.00,
          total_price_usd: 100.00,
          total_price_ves: 3630.00,
          notes: "Galvanizado de alta resistencia"
        }
      ]
    }
  }
];

/**
 * ==========================================================================
 * MÉTODOS Y SERVICIOS API PARA EL MÓDULO DE PAGOS
 * ==========================================================================
 */

/**
 * Obtiene el listado de comprobantes y pagos registrados con soporte de filtros y doble moneda.
 * @param {Object} filters Opciones de filtrado
 * @returns {Promise<{results: Array, total: number, page: number, total_pages: number}>}
 */
export async function getPayments(filters = {}) {
  try {
    const queryParams = {};
    if (filters.search) queryParams.search = filters.search;
    if (filters.status && filters.status !== 'all') queryParams.status = filters.status;
    if (filters.stage && filters.stage !== 'all') queryParams.payment_stage = filters.stage;
    if (filters.payment_method && filters.payment_method !== 'all') queryParams.payment_method = filters.payment_method;
    if (filters.date_from) queryParams.date_from = filters.date_from;
    if (filters.date_to) queryParams.date_to = filters.date_to;
    if (filters.page) queryParams.page = filters.page;
    if (filters.page_size) queryParams.page_size = filters.page_size;

    const data = await getRequest('/payments/', queryParams, { auth: true });
    if (data && (Array.isArray(data) || Array.isArray(data.results))) {
      const results = extractList(data);
      return {
        results,
        total: data.count || results.length,
        page: filters.page || 1,
        total_pages: Math.max(1, Math.ceil((data.count || results.length) / (filters.page_size || 8)))
      };
    }
  } catch (error) {
    console.warn('[TuEstante Payment API] Endpoint no disponible o backend offline. Usando datos Mock estructurados:', error.message);
  }

  // --- LÓGICA DE FILTRADO LOCAL SOBRE LOS DATOS MOCK ---
  let filtered = [...MOCK_PAYMENTS];

  if (filters.search) {
    const term = filters.search.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.payment_code.toLowerCase().includes(term) ||
      p.order_code.toLowerCase().includes(term) ||
      p.client.name.toLowerCase().includes(term) ||
      p.client.email.toLowerCase().includes(term) ||
      p.reference_number.toLowerCase().includes(term) ||
      p.bank_name.toLowerCase().includes(term)
    );
  }

  if (filters.status && filters.status !== 'all' && filters.status !== 'todos') {
    filtered = filtered.filter(p => p.status === filters.status);
  }

  if (filters.stage && filters.stage !== 'all' && filters.stage !== 'todos') {
    filtered = filtered.filter(p => p.payment_stage === filters.stage);
  }

  if (filters.payment_method && filters.payment_method !== 'all') {
    filtered = filtered.filter(p => p.payment_method === filters.payment_method);
  }

  if (filters.date_from) {
    filtered = filtered.filter(p => p.created_at >= filters.date_from);
  }
  if (filters.date_to) {
    filtered = filtered.filter(p => p.created_at <= `${filters.date_to}T23:59:59`);
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
 * Obtiene el detalle de un comprobante de pago específico por su ID.
 * @param {number|string} paymentId ID del pago
 * @returns {Promise<Object>}
 */
export async function getPaymentById(paymentId) {
  try {
    const data = await getRequest(`/payments/${paymentId}/`, {}, { auth: true });
    if (data) return data;
  } catch (error) {
    console.warn(`[TuEstante Payment API] Fallback a datos mock para comprobante #${paymentId}:`, error.message);
  }

  return MOCK_PAYMENTS.find(p => p.id === parseInt(paymentId, 10)) || MOCK_PAYMENTS[0];
}

/**
 * Obtiene el resumen detallado de la orden asociada a un pago,
 * incluyendo la lista de productos y el desglose de montos en USD y Bolívares.
 * Si ya fue pagado, usa los montos registrados en el backend; si no, calcula con la tasa actual.
 * 
 * @param {number|string} orderId ID o código del pedido
 * @returns {Promise<Object>} Resumen completo de la orden con productos y montos duales
 */
export async function getOrderSummaryForPayment(orderId) {
  const numOrderId = parseInt(orderId, 10);
  const strOrderId = String(orderId);

  try {
    const data = await getRequest(`/orders/${orderId}/`, {}, { auth: true });
    if (data) return data;
  } catch (error) {
    // Fallback a datos mock asociados
  }

  // Buscar todos los comprobantes asociados a este pedido
  const relatedPayments = MOCK_PAYMENTS.filter(p => p.order_id === numOrderId || p.order_code === strOrderId);
  
  // Priorizar un pago aprobado, o en su defecto el primer comprobante registrado
  const registeredPayment = relatedPayments.find(p => p.status === 'approved') || relatedPayments[0];

  const basePayment = relatedPayments[0];
  if (basePayment && basePayment.order_summary) {
    return {
      ...basePayment.order_summary,
      id: basePayment.order_id,
      order_code: basePayment.order_code,
      client: basePayment.client,
      related_payments: relatedPayments,
      registered_payment: registeredPayment ? {
        payment_code: registeredPayment.payment_code,
        formatted_date: registeredPayment.formatted_date,
        exchange_rate: registeredPayment.exchange_rate || 36.50,
        status: registeredPayment.status,
        status_label: registeredPayment.status_label,
        payment_stage_label: registeredPayment.payment_stage_label,
        amount: registeredPayment.amount,
        amount_ves: registeredPayment.amount_ves
      } : null,
      is_paid: relatedPayments.some(p => p.status === 'approved'),
      has_registered_payment: !!registeredPayment,
      registered_rate: registeredPayment ? registeredPayment.exchange_rate : null,
      amount_paid_usd: relatedPayments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0),
      amount_paid_ves: relatedPayments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_ves || (p.amount * (p.exchange_rate || 36.50))), 0)
    };
  }

  // Fallback genérico estructurado
  return {
    id: numOrderId || 125,
    order_code: strOrderId.startsWith('#') ? strOrderId : `#00${numOrderId || 125}`,
    client: { name: "Juan Pérez", email: "juan@email.com", phone: "+58 412 1234567" },
    status: "manufacturing",
    status_label: "En fabricación",
    status_badge_class: "badge-manufacturing",
    total_amount: 350.00,
    total_amount_ves: 12775.00,
    exchange_rate: 36.50,
    is_paid: false,
    has_registered_payment: false,
    registered_rate: null,
    items: [
      { id: 1, product_name: "Estante Metálico Industrial 5 Niveles", quantity: 1, unit_price_usd: 200.00, total_price_usd: 200.00, notes: "Gris Plomo" },
      { id: 2, product_name: "Casillero Locker 4 Puertas", quantity: 1, unit_price_usd: 150.00, total_price_usd: 150.00, notes: "Cerradura de llave" }
    ]
  };
}

/**
 * Registra un nuevo comprobante de pago en el sistema.
 * @param {FormData|Object} paymentPayload 
 * @returns {Promise<Object>}
 */
export async function createPayment(paymentPayload) {
  try {
    return await postRequest('/payments/', paymentPayload, { auth: true });
  } catch (error) {
    console.warn('[TuEstante Payment API] Simulación local de registro de pago:', error.message);
    
    const isForm = typeof FormData !== 'undefined' && paymentPayload instanceof FormData;
    const orderCode = isForm ? (paymentPayload.get('order_code') || '#00125') : (paymentPayload.order_code || '#00125');
    const orderId = isForm ? parseInt(paymentPayload.get('order') || 125, 10) : (paymentPayload.order || 125);
    const amount = isForm ? parseFloat(paymentPayload.get('amount') || 100) : (paymentPayload.amount || 100);
    const stage = isForm ? (paymentPayload.get('payment_stage') || 'initial') : (paymentPayload.payment_stage || 'initial');
    const method = isForm ? (paymentPayload.get('payment_method') || 'mobile_payment') : (paymentPayload.payment_method || 'mobile_payment');
    const reference = isForm ? (paymentPayload.get('reference_number') || 'REF-NUEVA') : (paymentPayload.reference_number || 'REF-NUEVA');
    const bank = isForm ? (paymentPayload.get('bank_name') || 'Banco de Venezuela') : (paymentPayload.bank_name || 'Banco de Venezuela');
    const notes = isForm ? (paymentPayload.get('notes') || '') : (paymentPayload.notes || '');

    // Calcular bolívares con tasa estimada o convertidor
    const approxVes = Number((amount * 36.50).toFixed(2));

    const newId = Date.now();
    const newPayment = {
      id: newId,
      payment_code: `#PAG-0${Math.floor(100 + Math.random() * 900)}`,
      order_id: orderId,
      order_code: orderCode,
      client: {
        id: 1,
        name: "Juan Pérez",
        email: "juan@email.com",
        phone: "+58 412 1234567"
      },
      payment_stage: stage,
      payment_stage_label: stage === 'initial' ? 'Pago Inicial' : 'Pago Final (Saldo)',
      stage_badge_class: stage === 'initial' ? 'badge-stage-initial' : 'badge-stage-final',
      amount: amount,
      amount_ves: approxVes,
      exchange_rate: 36.50,
      order_total: amount * 2,
      order_total_ves: approxVes * 2,
      currency: "USD",
      formatted_amount: `$${amount.toFixed(2)}`,
      formatted_amount_ves: formatVES(approxVes),
      formatted_order_total: `$${(amount * 2).toFixed(2)}`,
      formatted_order_total_ves: formatVES(approxVes * 2),
      payment_method: method,
      payment_method_label: method === 'mobile_payment' ? 'Pago Móvil' : method === 'transfer' ? 'Transferencia' : method === 'zelle' ? 'Zelle' : 'Efectivo',
      bank_name: bank,
      reference_number: reference,
      receipt_file_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
      receipt_filename: "comprobante_adjunto.jpg",
      status: "review",
      status_label: "En revisión",
      status_badge_class: "badge-status-review",
      created_at: new Date().toISOString(),
      formatted_date: new Date().toLocaleDateString('es-ES'),
      formatted_time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: "",
      notes: notes,
      order_summary: {
        id: orderId,
        order_code: orderCode,
        status: "payment_review",
        status_label: "Pago en revisión",
        status_badge_class: "badge-payment-review",
        total_amount: amount * 2,
        total_amount_ves: approxVes * 2,
        exchange_rate: 36.50,
        items: [
          {
            id: 1,
            product_name: "Estante Metálico Personalizado",
            quantity: 1,
            unit_price_usd: amount * 2,
            unit_price_ves: approxVes * 2,
            total_price_usd: amount * 2,
            total_price_ves: approxVes * 2,
            notes: notes || "Pedido registrado manualmente"
          }
        ]
      }
    };

    MOCK_PAYMENTS.unshift(newPayment);
    return newPayment;
  }
}

/**
 * Revisa un comprobante de pago: lo aprueba o lo rechaza con motivo.
 * @param {number|string} paymentId ID del pago
 * @param {'approved'|'rejected'} status Estado ('approved' o 'rejected')
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
    console.warn(`[TuEstante Payment API] Simulación local de revisión de pago #${paymentId} (${status}):`, error.message);
    
    const payment = MOCK_PAYMENTS.find(p => p.id === parseInt(paymentId, 10));
    if (payment) {
      payment.status = status;
      payment.status_label = status === 'approved' ? 'Aprobado' : 'Rechazado';
      payment.status_badge_class = status === 'approved' ? 'badge-status-approved' : 'badge-status-rejected';
      payment.reviewed_by = "Carlos A. (Admin)";
      payment.reviewed_at = new Date().toISOString();
      payment.rejection_reason = status === 'rejected' ? rejectionReason : '';

      // Si se aprueba, sincronizar el estado del pedido asociado
      if (payment.order_summary) {
        if (status === 'approved') {
          if (payment.payment_stage === 'initial') {
            payment.order_summary.status = 'manufacturing';
            payment.order_summary.status_label = 'En fabricación';
            payment.order_summary.status_badge_class = 'badge-manufacturing';
          } else {
            payment.order_summary.status = 'shipped';
            payment.order_summary.status_label = 'Enviado';
            payment.order_summary.status_badge_class = 'badge-shipped';
          }
        }
      }
    }

    return { 
      success: true, 
      paymentId, 
      status, 
      message: status === 'approved' 
        ? (payment?.payment_stage === 'initial' 
            ? 'Pago Inicial aprobado. El pedido pasó al taller y se generó su Orden de Fabricación.' 
            : 'Saldo Final aprobado. El pedido está listo para despacho y envío.') 
        : 'Comprobante rechazado. Se registró el motivo para el cliente.' 
    };
  }
}

/**
 * Obtiene las métricas KPI agregadas para el resumen del módulo de pagos.
 * @returns {Promise<Object>}
 */
export async function getPaymentMetrics() {
  try {
    const data = await getRequest('/payments/statistics/', {}, { auth: true });
    if (data) return data;
  } catch (error) {
    // Fallback con cálculo local
  }

  const inReviewCount = MOCK_PAYMENTS.filter(p => p.status === 'review').length;
  const approvedCount = MOCK_PAYMENTS.filter(p => p.status === 'approved').length;
  const rejectedCount = MOCK_PAYMENTS.filter(p => p.status === 'rejected').length;
  const initialCount = MOCK_PAYMENTS.filter(p => p.payment_stage === 'initial').length;
  const finalCount = MOCK_PAYMENTS.filter(p => p.payment_stage === 'final').length;
  
  const totalAmountApproved = MOCK_PAYMENTS
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalAmountVes = MOCK_PAYMENTS
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + (p.amount_ves || (p.amount * (p.exchange_rate || 36.50))), 0);

  return {
    totalRevenue: totalAmountApproved,
    totalRevenueVes: totalAmountVes,
    formattedTotalRevenue: `$${totalAmountApproved.toFixed(2)}`,
    formattedTotalRevenueVes: formatVES(totalAmountVes),
    inReviewCount,
    approvedCount,
    rejectedCount,
    initialStageCount: initialCount,
    finalStageCount: finalCount,
    totalVouchers: MOCK_PAYMENTS.length
  };
}

/**
 * Obtiene la lista de pedidos con pagos pendientes con soporte de búsqueda por número y fecha.
 * @returns {Promise<Array>}
 */
export async function getOrdersForPaymentSelect() {
  try {
    const data = await getRequest('/orders/', { status_in: 'pending_initial_payment,waiting_final_payment' }, { auth: true });
    return extractList(data);
  } catch (error) {
    return [
      { 
        id: 125, 
        order_code: "#00125", 
        client_name: "Juan Pérez", 
        client_email: "juan@email.com", 
        pending_stage: "initial", 
        pending_stage_label: "Pago Inicial", 
        amount_due: 175.00, 
        total_amount: 350.00, 
        formatted_date: "31/08/2026", 
        created_at: "2026-08-31" 
      },
      { 
        id: 124, 
        order_code: "#00124", 
        client_name: "María López", 
        client_email: "maria@email.com", 
        pending_stage: "initial", 
        pending_stage_label: "Pago Inicial", 
        amount_due: 140.00, 
        total_amount: 280.00, 
        formatted_date: "30/08/2026", 
        created_at: "2026-08-30" 
      },
      { 
        id: 123, 
        order_code: "#00123", 
        client_name: "Pedro Díaz", 
        client_email: "pedro@email.com", 
        pending_stage: "final", 
        pending_stage_label: "Pago Final (Saldo)", 
        amount_due: 95.00, 
        total_amount: 190.00, 
        formatted_date: "28/08/2026", 
        created_at: "2026-08-28" 
      },
      { 
        id: 121, 
        order_code: "#00121", 
        client_name: "Luis Ramírez", 
        client_email: "luis@email.com", 
        pending_stage: "initial", 
        pending_stage_label: "Pago Inicial", 
        amount_due: 110.00, 
        total_amount: 220.00, 
        formatted_date: "24/08/2026", 
        created_at: "2026-08-24" 
      },
      { 
        id: 120, 
        order_code: "#00120", 
        client_name: "Carla Ruiz", 
        client_email: "carla@email.com", 
        pending_stage: "final", 
        pending_stage_label: "Pago Final (Saldo)", 
        amount_due: 150.00, 
        total_amount: 300.00, 
        formatted_date: "20/08/2026", 
        created_at: "2026-08-20" 
      }
    ];
  }
}
