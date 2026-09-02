/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIO PRINCIPAL DEL INDEX / DASHBOARD (INDEX.SERVICE.JS)
 * ==========================================================================
 * Proporciona y centraliza los datos para la pantalla principal (KPIs,
 * distribución de estados para el gráfico Donut y listado de pedidos recientes).
 * 
 * Estructurado para que en el futuro importe directamente las funciones de
 * los submódulos API (ej. orders.api.js, payments.api.js, shipping.api.js).
 * Actualmente opera con datos mock de alta fidelidad sincronizados con el diseño.
 */

// NOTA PARA FUTURA INTEGRACIÓN:
// Descomentar y enlazar con los módulos correspondientes una vez creados:
// import { fetchOrdersList, fetchOrdersStatistics } from '../modules/order/orders.api.js';
// import { fetchPaymentsSummary } from '../modules/payment/payments.api.js';

/**
 * 1. Obtiene el resumen de métricas para las 6 tarjetas KPI superiores
 * @returns {Promise<Object>} Conjunto de métricas para las tarjetas
 */
export async function getIndexKpiMetrics() {
  // Simulación de latencia de red (fácilmente sustituible por llamadas reales al backend)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        todayOrders: {
          id: 'today-orders',
          title: 'Pedidos hoy',
          value: 18,
          trend: '↑ 12% vs ayer',
          trendType: 'positive',
          iconType: 'cart',
          colorScheme: 'blue',
          actionUrl: 'modules/order/orders.html?filter=today'
        },
        pendingPayment: {
          id: 'pending-payment',
          title: 'Pendientes pago',
          value: 7,
          actionText: 'Ver detalles',
          iconType: 'clock',
          colorScheme: 'orange',
          actionUrl: 'modules/order/orders.html?status=pending_initial_payment'
        },
        inManufacturing: {
          id: 'in-manufacturing',
          title: 'En fabricación',
          value: 5,
          actionText: 'Ver detalles',
          iconType: 'factory',
          colorScheme: 'purple',
          actionUrl: 'modules/order/orders.html?status=manufacturing'
        },
        reviewPayment: {
          id: 'review-payment',
          title: 'Pagos en revisión',
          value: 3,
          actionText: 'Ver detalles',
          iconType: 'credit-card',
          colorScheme: 'amber',
          actionUrl: 'modules/payment/payments.html?status=review'
        },
        waitingFinalPayment: {
          id: 'waiting-final-payment',
          title: 'Esperando pago final',
          value: 4,
          actionText: 'Ver detalles',
          iconType: 'dollar',
          colorScheme: 'cyan',
          actionUrl: 'modules/order/orders.html?status=waiting_final_payment'
        },
        shippedOrders: {
          id: 'shipped-orders',
          title: 'Enviados',
          value: 8,
          actionText: 'Ver detalles',
          iconType: 'truck',
          colorScheme: 'green',
          actionUrl: 'modules/shipping/shipping.html?status=shipped'
        }
      });
    }, 50);
  });
}

/**
 * 2. Obtiene la distribución de pedidos por estado para el gráfico Donut
 * @returns {Promise<{total: number, items: Array<Object>}>}
 */
export async function getOrderStatusDistribution() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const items = [
        {
          id: 'pending_initial_payment',
          label: 'Pendiente de pago',
          count: 7,
          color: '#f59e0b', // Ámbar / Naranja
          percentage: 15.56
        },
        {
          id: 'initial_payment_review',
          label: 'Pago en revisión',
          count: 3,
          color: '#f87171', // Salmón / Coral
          percentage: 6.67
        },
        {
          id: 'manufacturing',
          label: 'En fabricación',
          count: 5,
          color: '#8b5cf6', // Púrpura
          percentage: 11.11
        },
        {
          id: 'waiting_final_payment',
          label: 'Esperando pago final',
          count: 4,
          color: '#0ea5e9', // Cian / Celeste
          percentage: 8.89
        },
        {
          id: 'final_payment_review',
          label: 'Pago final en revisión',
          count: 2,
          color: '#10b981', // Verde Esmeralda
          percentage: 4.44
        },
        {
          id: 'shipped',
          label: 'Enviados',
          count: 8,
          color: '#4d82bc', // Azul acero TuEstante
          percentage: 17.78
        },
        {
          id: 'finalized',
          label: 'Finalizados',
          count: 14,
          color: '#005187', // Azul corporativo oscuro TuEstante
          percentage: 31.11
        },
        {
          id: 'returned_manufacturing',
          label: 'Devueltos',
          count: 2,
          color: '#ec4899', // Rosa / Fucsia
          percentage: 4.44
        }
      ];

      const total = items.reduce((sum, item) => sum + item.count, 0);

      resolve({
        total, // 45
        items
      });
    }, 50);
  });
}

/**
 * 3. Obtiene la lista de pedidos recientes para la tabla principal
 * @param {number} [limit=5] Cantidad máxima de registros
 * @returns {Promise<Array<Object>>} Lista de pedidos estructurados
 */
export async function getRecentOrders(limit = 5) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const orders = [
        {
          id: 125,
          orderCode: '#00125',
          clientName: 'Juan Pérez',
          clientEmail: 'juan.perez@example.com',
          total: 350.00,
          currency: '$',
          formattedTotal: '$350.00',
          status: 'manufacturing',
          statusLabel: 'En fabricación',
          badgeVariant: 'badge-manufacturing',
          date: '31/08/2026 10:30',
          itemsCount: 2
        },
        {
          id: 124,
          orderCode: '#00124',
          clientName: 'María López',
          clientEmail: 'maria.lopez@example.com',
          total: 280.00,
          currency: '$',
          formattedTotal: '$280.00',
          status: 'initial_payment_review',
          statusLabel: 'Pago en revisión',
          badgeVariant: 'badge-payment-review',
          date: '31/08/2026 09:45',
          itemsCount: 1
        },
        {
          id: 123,
          orderCode: '#00123',
          clientName: 'Pedro Díaz',
          clientEmail: 'pedro.diaz@example.com',
          total: 190.00,
          currency: '$',
          formattedTotal: '$190.00',
          status: 'waiting_final_payment',
          statusLabel: 'Esperando pago final',
          badgeVariant: 'badge-waiting-final',
          date: '30/08/2026 18:20',
          itemsCount: 1
        },
        {
          id: 122,
          orderCode: '#00122',
          clientName: 'Ana Torres',
          clientEmail: 'ana.torres@example.com',
          total: 450.00,
          currency: '$',
          formattedTotal: '$450.00',
          status: 'shipped',
          statusLabel: 'Enviado',
          badgeVariant: 'badge-shipped',
          date: '30/08/2026 16:10',
          itemsCount: 3
        },
        {
          id: 121,
          orderCode: '#00121',
          clientName: 'Luis Ramírez',
          clientEmail: 'luis.ramirez@example.com',
          total: 220.00,
          currency: '$',
          formattedTotal: '$220.00',
          status: 'pending_initial_payment',
          statusLabel: 'Pendiente de pago',
          badgeVariant: 'badge-pending-payment',
          date: '30/08/2026 11:05',
          itemsCount: 2
        }
      ];

      resolve(orders.slice(0, limit));
    }, 50);
  });
}
