import { getRequest } from '../api.js';

let dashboardPromise;

function getDashboard() {
  if (!dashboardPromise) {
    dashboardPromise = getRequest('/orders/dashboard/', {}, { auth: true });
  }
  return dashboardPromise;
}

const CARD_CONFIG = {
  pendingPayment: {
    id: 'pending-payment', title: 'Pendientes pago', actionText: 'Ver detalles',
    iconType: 'clock', colorScheme: 'orange', actionUrl: 'modules/order/orders.html?status=pending_initial_payment'
  },
  inManufacturing: {
    id: 'in-manufacturing', title: 'En fabricación', actionText: 'Ver detalles',
    iconType: 'factory', colorScheme: 'purple', actionUrl: 'modules/order/orders.html?status=manufacturing'
  },
  reviewPayment: {
    id: 'review-payment', title: 'Pagos en revisión', actionText: 'Ver detalles',
    iconType: 'credit-card', colorScheme: 'amber', actionUrl: 'modules/payment/payments.html?status=pending'
  },
  totalOrdersYear: {
    id: 'total-orders-year', title: 'Pedidos este año', actionText: 'Ver pedidos',
    iconType: 'dollar', colorScheme: 'cyan', actionUrl: 'modules/order/orders.html'
  },
  shippedOrders: {
    id: 'shipped-orders', title: 'Enviados', actionText: 'Ver detalles',
    iconType: 'truck', colorScheme: 'green', actionUrl: 'modules/order/orders.html?status=shipped'
  }
};

export async function getIndexKpiMetrics() {
  const dashboard = await getDashboard();
  const metrics = dashboard.metrics || {};
  const yesterday = Number(metrics.yesterdayOrders || 0);
  const today = Number(metrics.todayOrders || 0);
  const trend = yesterday > 0
    ? `${today >= yesterday ? '↑' : '↓'} ${Math.abs(((today - yesterday) / yesterday) * 100).toFixed(1)}% vs ayer`
    : 'Sin comparación disponible';

  return {
    todayOrders: {
      id: 'today-orders', title: 'Pedidos hoy', value: today, trend,
      trendType: today >= yesterday ? 'positive' : 'negative', iconType: 'cart',
      colorScheme: 'blue', actionUrl: 'modules/order/orders.html?filter=today'
    },
    pendingPayment: { ...CARD_CONFIG.pendingPayment, value: Number(metrics.pendingPayment || 0) },
    inManufacturing: { ...CARD_CONFIG.inManufacturing, value: Number(metrics.inManufacturing || 0) },
    reviewPayment: { ...CARD_CONFIG.reviewPayment, value: Number(metrics.reviewPayment || 0) },
    totalOrdersYear: { ...CARD_CONFIG.totalOrdersYear, value: Number(metrics.totalOrdersYear || 0) },
    shippedOrders: { ...CARD_CONFIG.shippedOrders, value: Number(metrics.shippedOrders || 0) }
  };
}

export async function getOrderStatusDistribution() {
  const dashboard = await getDashboard();
  return dashboard.distribution || { total: 0, items: [] };
}

export async function getRecentOrders(limit = 5) {
  const dashboard = await getDashboard();
  return (dashboard.recentOrders || []).slice(0, limit);
}
