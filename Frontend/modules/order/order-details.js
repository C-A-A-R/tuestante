/**
 * ==========================================================================
 * LÓGICA DE DETALLES DEL PEDIDO Y GESTIÓN DE PAGOS - TUESTANTE
 * Maneja la visualización de la orden, métodos de pago, historial de pagos,
 * modal flotante de comprobantes, envío de pagos y notificaciones Toast.
 * ==========================================================================
 */

import { obtenerPedidoPorId } from './orders.api.js';
import { obtenerPagos, registrarPago } from './payment.api.js';
import { obtenerFacturaPorOrden } from './invoice.api.js';
import { getAccessToken, getCurrentUser } from '../../js/storage.js';
import { resolveImageUrl, extractList } from '../../js/api.js';
import { showToast, showSuccessToast, showErrorToast, showWarningToast, showInfoToast } from '../../components/toast/toast.js';
import { 
    openWhatsApp, 
    buildOrderWhatsAppMessage, 
    buildCashPaymentWhatsAppMessage,
    buildOtherPaymentMethodsWhatsAppMessage,
    calculateOrderPaymentBreakdown, 
    getExchangeRateDetails, 
    formatVES, 
    formatUSD 
} from '../../js/service/index.js';
import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';

// Cargar componentes Navbar / Footer
async function loadComponent(elementId, filePath) {
    try {
        const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
            const html = await response.text();
            const el = document.getElementById(elementId);
            if (el) el.innerHTML = html;
        }
    } catch (err) {
        console.error(`Error al cargar ${filePath}:`, err);
    }
}

// Diccionario de Estados de Pedido
const ORDER_STATUS_CONFIG = {
    'pending_initial_payment': { label: 'Pendiente de pago inicial', className: 'status-pending' },
    'initial_payment_review': { label: 'Pago inicial en revisión', className: 'status-review' },
    'manufacturing': { label: 'En fabricación', className: 'status-manufacturing' },
    'waiting_final_payment': { label: 'Esperando pago final', className: 'status-pending' },
    'final_payment_review': { label: 'Pago final en revisión', className: 'status-review' },
    'shipped': { label: 'Enviado / En camino', className: 'status-shipped' },
    'finalized': { label: 'Finalizado / Entregado', className: 'status-finalized' },
    'returned_manufacturing': { label: 'En refabricación', className: 'status-manufacturing' },
    'cancelled': { label: 'Cancelado', className: 'status-cancelled' }
};

// Diccionario de Métodos de Pago
const PAYMENT_METHOD_LABELS = {
    'transfer': 'Transferencia bancaria',
    'mobile_payment': 'Pago móvil',
    'cash': 'Efectivo en sede',
    'other': 'Zelle / Divisas / Otro'
};

// Diccionario de Estados de Pago
const PAYMENT_STATUS_CONFIG = {
    'pending': { label: 'Pendiente de revisión', className: 'status-review' },
    'approved': { label: 'Aprobado', className: 'status-approved' },
    'rejected': { label: 'Rechazado', className: 'status-rejected' }
};

let currentOrderData = null;
let currentPaymentsList = [];

/**
 * Carga y renderiza todos los datos del pedido desde la API.
 * @param {string|number} orderId ID del pedido
 */
async function loadOrderData(orderId) {
    try {
        const order = await obtenerPedidoPorId(orderId);
        if (!order) {
            showErrorToast('Error', 'No se pudo encontrar el pedido especificado.');
            return;
        }

        currentOrderData = order;

        // Obtener pagos asociados
        let payments = [];
        if (Array.isArray(order.payments) && order.payments.length > 0) {
            payments = order.payments;
        } else {
            try {
                const paymentsResponse = await obtenerPagos({ order: orderId });
                const fetched = extractList(paymentsResponse);
                if (Array.isArray(fetched)) {
                    payments = fetched.filter(p => String(p.order) === String(orderId));
                }
            } catch (pErr) {
                console.warn('No se pudieron consultar pagos independientes:', pErr);
            }
        }
        currentPaymentsList = payments;

        // 1. Renderizar Cabecera (Número de Pedido y Estado)
        renderHeader(order);

        // 2. Consultar Factura Oficial o calcular conversión en Bolívares (Tasa Oficial BCV)
        let paymentBreakdown = null;
        let invoiceData = null;

        if (order.status === 'finalized') {
            try {
                const invResponse = await obtenerFacturaPorOrden(orderId);
                const invoices = extractList(invResponse);
                if (Array.isArray(invoices) && invoices.length > 0) {
                    invoiceData = invoices[0];
                }
            } catch (invErr) {
                console.warn('No se pudo consultar la factura oficial de la orden finalizada:', invErr);
            }
        }

        try {
            paymentBreakdown = await calculateOrderPaymentBreakdown(order.total_price);
            const rateTextEl = document.getElementById('exchange-rate-text');
            const totalVesEl = document.getElementById('order-total-ves');

            if (invoiceData) {
                // Si la orden ya finalizó, reflejar los datos de la factura generada
                if (rateTextEl) {
                    rateTextEl.textContent = `Factura Fiscal: ${invoiceData.invoice_number}`;
                }
                if (totalVesEl) {
                    totalVesEl.textContent = `$${parseFloat(invoiceData.total).toFixed(2)} USD (Facturado)`;
                }
            } else {
                if (rateTextEl && paymentBreakdown) {
                    rateTextEl.textContent = `Tasa BCV: Bs. ${paymentBreakdown.exchangeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por $`;
                }
                if (totalVesEl && paymentBreakdown) {
                    totalVesEl.textContent = paymentBreakdown.total.formattedVes;
                }
            }
        } catch (convErr) {
            console.warn('No se pudo calcular la conversión a Bolívares o procesar factura:', convErr);
        }

        // 3. Renderizar Datos de Envío
        renderShipping(order);

        // 4. Renderizar Resumen de Productos
        renderSummary(order, paymentBreakdown);

        // 5. Renderizar Pagos Registrados
        renderExistingPayments(payments);

        // 6. Configurar Formulario de Pago
        setupPaymentFormState(order, payments, paymentBreakdown);

        // 7. Configurar Botón WhatsApp con conversiones
        setupWhatsappButton(order, paymentBreakdown);

    } catch (err) {
        console.error('Error al cargar la información de la orden:', err);
        showErrorToast('Error al cargar pedido', 'Ocurrió un error al obtener los detalles del pedido.');
    }
}

/**
 * Renderiza el número de pedido y su badge de estado en la cabecera superior.
 */
function renderHeader(order) {
    const orderNumberEl = document.getElementById('order-number');
    const statusBadgeEl = document.getElementById('order-status-badge');

    if (orderNumberEl) {
        const formattedNumber = order.order_number || `#PED-${String(order.id).padStart(4, '0')}`;
        orderNumberEl.textContent = formattedNumber;
    }

    if (statusBadgeEl) {
        const statusKey = order.status || 'pending_initial_payment';
        const config = ORDER_STATUS_CONFIG[statusKey] || { label: statusKey, className: 'status-pending' };
        
        statusBadgeEl.textContent = config.label;
        statusBadgeEl.className = `status-badge ${config.className}`;
    }
}

/**
 * Renderiza los datos de envío y entrega.
 */
function renderShipping(order) {
    const locationEl = document.getElementById('shipping-location');
    const addressEl = document.getElementById('shipping-address');
    const providerEl = document.getElementById('shipping-provider');
    const statusBadgeEl = document.getElementById('shipping-status-badge');

    const shipment = (order.shipments && order.shipments.length > 0) ? order.shipments[0] : null;

    if (shipment) {
        const locationParts = [shipment.city, shipment.municipality, shipment.state].filter(Boolean);
        if (locationEl) {
            locationEl.textContent = locationParts.length > 0 ? locationParts.join(', ') : 'Venezuela';
        }

        if (addressEl) {
            addressEl.textContent = shipment.address || order.notes || 'Dirección registrada en sistema';
        }

        if (providerEl) {
            let providerName = shipment.distributor_name || shipment.distributor?.name;
            if (!providerName && shipment.notes && shipment.notes.includes('Transporte:')) {
                const match = shipment.notes.match(/Transporte:\s*([^)]+)/);
                if (match) providerName = match[1].trim();
            }
            providerEl.textContent = providerName || 'Transporte Asignado';
        }

        if (statusBadgeEl) {
            const shipStatusMap = {
                'pending': 'Pendiente de despacho',
                'in_transit': 'En camino / Despachado',
                'delivered': 'Entregado al cliente',
                'returned': 'Devuelto a fábrica',
                'failed': 'Fallo en entrega'
            };
            statusBadgeEl.textContent = shipStatusMap[shipment.status] || 'Pendiente de fabricación';
        }
    } else {
        if (locationEl) locationEl.textContent = 'Registrada en pedido';
        if (addressEl) addressEl.textContent = order.notes || 'Dirección no especificada';
        if (providerEl) providerEl.textContent = 'Transporte TuEstante / Empresa de Envíos';
        if (statusBadgeEl) statusBadgeEl.textContent = 'Pendiente de fabricación';
    }
}

/**
 * Renderiza la lista de productos y totales en el resumen de la orden.
 */
function renderSummary(order) {
    const itemsListEl = document.getElementById('order-items-list');
    const subtotalEl = document.getElementById('order-subtotal');
    const totalPriceEl = document.getElementById('order-total-price');

    const totalPrice = parseFloat(order.total_price) || 0;

    if (subtotalEl) subtotalEl.textContent = `$${totalPrice.toFixed(2)}`;
    if (totalPriceEl) totalPriceEl.textContent = `$${totalPrice.toFixed(2)}`;

    if (!itemsListEl) return;

    if (Array.isArray(order.details) && order.details.length > 0) {
        itemsListEl.innerHTML = order.details.map(detail => {
            const prod = detail.order_products?.[0]?.product;
            const prodName = prod?.product_name || prod?.name || 'Producto TuEstante';
            const qty = detail.quantity || 1;
            const unitPrice = parseFloat(detail.unit_price) || (prod?.price ? parseFloat(prod.price) : 0);
            const lineTotal = parseFloat(detail.final_price) || (unitPrice * qty);
            const notes = detail.notes ? detail.notes.trim() : '';

            return `
                <div class="order-item-row">
                    <div class="order-item-details">
                        <span class="order-item-name">${escapeHtml(prodName)}</span>
                        ${notes ? `<span class="order-item-specs">${escapeHtml(notes)}</span>` : ''}
                    </div>
                    <div class="order-item-price-calc">
                        <span class="order-item-total">$${lineTotal.toFixed(2)}</span>
                        <span style="font-size: 0.78rem; color: #64748b;">${qty} x $${unitPrice.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        itemsListEl.innerHTML = '<p class="loading-items-text">Sin productos registrados en el detalle.</p>';
    }
}

/**
 * Renderiza la sección de pagos registrados con el botón para ver comprobante.
 */
function renderExistingPayments(payments) {
    const sectionEl = document.getElementById('existing-payments-section');
    const listEl = document.getElementById('payments-list');

    if (!sectionEl || !listEl) return;

    if (!payments || payments.length === 0) {
        sectionEl.style.display = 'none';
        listEl.innerHTML = '';
        return;
    }

    sectionEl.style.display = 'block';

    listEl.innerHTML = payments.map((payment, index) => {
        const stageLabel = payment.payment_stage === 'initial' ? 'Pago Inicial (50%)' : 'Pago Final (Saldo Restante)';
        const methodLabel = PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || 'Transferencia';
        const statusInfo = PAYMENT_STATUS_CONFIG[payment.status] || { label: payment.status || 'Pendiente', className: 'status-pending' };
        const amount = parseFloat(payment.amount) || 0;
        const refNumber = payment.reference_number || 'N/A';
        const formattedDate = payment.created_at ? new Date(payment.created_at).toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
        const hasReceipt = Boolean(payment.receipt_file);

        return `
            <div class="payment-record-card" data-payment-id="${payment.id}">
                <div class="payment-record-header">
                    <span class="payment-stage-title">${stageLabel}</span>
                    <span class="status-badge ${statusInfo.className}">${statusInfo.label}</span>
                </div>

                <div class="payment-record-grid">
                    <div class="record-item">
                        <span class="record-lbl">Monto Registrado:</span>
                        <span class="record-val amount">$${amount.toFixed(2)}</span>
                    </div>
                    <div class="record-item">
                        <span class="record-lbl">N° Referencia:</span>
                        <span class="record-val">${escapeHtml(refNumber)}</span>
                    </div>
                    <div class="record-item">
                        <span class="record-lbl">Método:</span>
                        <span class="record-val">${escapeHtml(methodLabel)}</span>
                    </div>
                    <div class="record-item">
                        <span class="record-lbl">Fecha de Envío:</span>
                        <span class="record-val">${formattedDate}</span>
                    </div>
                </div>

                ${payment.rejection_reason ? `
                    <div class="payment-rejection-box">
                        <strong>Motivo de Rechazo por Administración:</strong>
                        ${escapeHtml(payment.rejection_reason)}
                    </div>
                ` : ''}

                ${hasReceipt ? `
                    <button type="button" class="btn-view-receipt" data-payment-idx="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>Ver Comprobante de Pago</span>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    // Asignar eventos de clic a los botones de ver comprobante
    const viewButtons = listEl.querySelectorAll('.btn-view-receipt');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.paymentIdx, 10);
            if (!isNaN(idx) && payments[idx]) {
                openReceiptModal(payments[idx]);
            }
        });
    });
}

/**
 * Ajusta los valores y la visibilidad del formulario de pago según el estado de la orden y pagos previos.
 * Deduce la etapa del backend sin consultar al usuario y establece el monto inicial en Bolívares (50%).
 */
function setupPaymentFormState(order, payments, paymentBreakdown = null) {
    const formSection = document.getElementById('payment-form-section');
    const formTitle = document.getElementById('payment-form-title');
    const stageHiddenInput = document.getElementById('payment-stage');
    const stageTextEl = document.getElementById('payment-stage-text');
    const amountInput = document.getElementById('payment-amount');
    const suggestedHint = document.getElementById('suggested-amount-hint');
    const reviewNotice = document.getElementById('payment-in-review-notice');

    if (!formSection || !amountInput) return;

    const hasPendingReviewPayment = payments.some(p => p.status === 'pending');
    const hasApprovedInitial = payments.some(p => p.payment_stage === 'initial' && p.status === 'approved');
    const hasApprovedFinal = payments.some(p => p.payment_stage === 'final' && p.status === 'approved');

    let deducedStage = 'initial';
    let stageTitleText = 'Pago Inicial (50% Requerido)';
    let minAllowedVes = 0;
    let maxAllowedVes = 0;
    let suggestedVes = 0;

    // Deducción automática de la etapa de pago
    if (order.status === 'waiting_final_payment' || order.status === 'final_payment_review' || hasApprovedInitial) {
        deducedStage = 'final';
        stageTitleText = 'Pago Final (Saldo Restante 50%)';
        if (formTitle) formTitle.textContent = 'Registrar Comprobante de Pago Final (50%)';
        
        if (paymentBreakdown) {
            minAllowedVes = paymentBreakdown.finalPayment.rawVes;
            maxAllowedVes = paymentBreakdown.finalPayment.rawVes;
            suggestedVes = paymentBreakdown.finalPayment.rawVes;
        }
    } else {
        deducedStage = 'initial';
        stageTitleText = 'Pago Inicial (50% Requerido)';
        if (formTitle) formTitle.textContent = 'Registrar Comprobante de Pago Inicial (50%)';
        
        if (paymentBreakdown) {
            minAllowedVes = paymentBreakdown.initialPayment.rawVes;
            maxAllowedVes = paymentBreakdown.total.rawVes;
            suggestedVes = paymentBreakdown.initialPayment.rawVes;
        }
    }

    if (stageHiddenInput) stageHiddenInput.value = deducedStage;
    if (stageTextEl) stageTextEl.textContent = stageTitleText;

    // Llenar monto sugerido en Bolívares (50%) y configurar límites de validación
    if (suggestedVes > 0) {
        amountInput.value = suggestedVes.toFixed(2);
        amountInput.min = minAllowedVes.toFixed(2);
        amountInput.max = maxAllowedVes.toFixed(2);
        amountInput.dataset.minVes = String(minAllowedVes);
        amountInput.dataset.maxVes = String(maxAllowedVes);
    }

    if (suggestedHint && paymentBreakdown) {
        if (deducedStage === 'final') {
            suggestedHint.textContent = `Monto restante exacto (50%): ${paymentBreakdown.finalPayment.formattedVes} (Equivalente: ${paymentBreakdown.finalPayment.formattedUsd})`;
        } else {
            suggestedHint.textContent = `Monto inicial (50%): ${paymentBreakdown.initialPayment.formattedVes} (${paymentBreakdown.initialPayment.formattedUsd}) | Máximo permitido (100%): ${paymentBreakdown.total.formattedVes}`;
        }
    }

    // Actualización dinámica de equivalencia mientras el usuario escribe
    amountInput.oninput = () => {
        const val = parseFloat(amountInput.value);
        if (!isNaN(val) && paymentBreakdown && paymentBreakdown.exchangeRate > 0) {
            const usdEquiv = (val / paymentBreakdown.exchangeRate).toFixed(2);
            if (suggestedHint) {
                suggestedHint.textContent = `Monto ingresado: Bs. ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Aprox. $${usdEquiv} USD)`;
            }
        }
    };

    // Mostrar aviso de revisión o formulario
    if (hasPendingReviewPayment || order.status === 'initial_payment_review' || order.status === 'final_payment_review') {
        if (reviewNotice) reviewNotice.style.display = 'flex';
    } else {
        if (reviewNotice) reviewNotice.style.display = 'none';
    }

    // Si ya completó todos los pagos requeridos
    if (hasApprovedFinal || order.status === 'finalized' || order.status === 'shipped') {
        formSection.style.display = 'none';
    } else {
        formSection.style.display = 'block';
    }
}

/**
 * Abre el modal flotante en el centro de la pantalla para ver el comprobante.
 */
function openReceiptModal(payment) {
    const modalOverlay = document.getElementById('receipt-modal-overlay');
    const titleEl = document.getElementById('receipt-modal-title');
    const metaEl = document.getElementById('receipt-modal-meta');
    const imgEl = document.getElementById('receipt-modal-image');
    const pdfEl = document.getElementById('receipt-modal-pdf');
    const downloadBtn = document.getElementById('receipt-modal-download-btn');

    if (!modalOverlay || !payment.receipt_file) return;

    const fileUrl = resolveImageUrl(payment.receipt_file);
    const isPdf = fileUrl.toLowerCase().endsWith('.pdf') || (payment.receipt_file.toLowerCase && payment.receipt_file.toLowerCase().endsWith('.pdf'));

    const stageText = payment.payment_stage === 'initial' ? 'Pago Inicial (50%)' : 'Pago Final';
    if (titleEl) titleEl.textContent = `Comprobante de ${stageText}`;
    if (metaEl) metaEl.textContent = `Referencia: #${payment.reference_number || 'N/A'} — Monto: $${parseFloat(payment.amount || 0).toFixed(2)}`;

    if (downloadBtn) {
        downloadBtn.href = fileUrl;
    }

    if (isPdf) {
        if (imgEl) imgEl.style.display = 'none';
        if (pdfEl) pdfEl.style.display = 'flex';
    } else {
        if (pdfEl) pdfEl.style.display = 'none';
        if (imgEl) {
            imgEl.style.display = 'block';
            imgEl.src = fileUrl;
        }
    }

    modalOverlay.classList.add('active');
    modalOverlay.setAttribute('aria-hidden', 'false');
}

/**
 * Cierra el modal flotante de comprobante.
 */
function closeReceiptModal() {
    const modalOverlay = document.getElementById('receipt-modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
        modalOverlay.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Configura los eventos del modal flotante (cerrar al hacer clic en botón, fuera del modal o con tecla Escape).
 */
function setupReceiptModalEvents() {
    const modalOverlay = document.getElementById('receipt-modal-overlay');
    const closeBtn = document.getElementById('receipt-modal-close-btn');
    const dismissBtn = document.getElementById('receipt-modal-dismiss-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeReceiptModal);
    if (dismissBtn) dismissBtn.addEventListener('click', closeReceiptModal);

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeReceiptModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
            closeReceiptModal();
        }
    });
}

/**
 * Configura el área de subida de archivos (Dropzone) y previsualización.
 */
function setupDropzone() {
    const dropzone = document.getElementById('receipt-dropzone');
    const fileInput = document.getElementById('payment-receipt-file');
    const placeholder = document.getElementById('dropzone-placeholder');
    const preview = document.getElementById('dropzone-preview');
    const previewImg = document.getElementById('preview-img');
    const previewFilename = document.getElementById('preview-filename');
    const previewFilesize = document.getElementById('preview-filesize');
    const btnRemove = document.getElementById('btn-remove-preview');

    if (!dropzone || !fileInput) return;

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            fileInput.files = files;
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleFileSelect(fileInput.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file) return;

        // Validar tamaño máximo (10 MB)
        if (file.size > 10 * 1024 * 1024) {
            showErrorToast('Archivo demasiado pesado', 'El comprobante no debe superar los 10 MB.');
            resetFileInput();
            return;
        }

        const fileName = file.name;
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

        if (previewFilename) previewFilename.textContent = fileName;
        if (previewFilesize) previewFilesize.textContent = `${fileSizeMB} MB`;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (previewImg) previewImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            if (previewImg) previewImg.src = '../../assets/images/productos/estante-blanco.jpeg';
        }

        if (placeholder) placeholder.style.display = 'none';
        if (preview) preview.style.display = 'flex';
    }

    function resetFileInput() {
        fileInput.value = '';
        if (placeholder) placeholder.style.display = 'flex';
        if (preview) preview.style.display = 'none';
        if (previewImg) previewImg.src = '';
    }

    if (btnRemove) {
        btnRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            resetFileInput();
        });
    }
}

/**
 * Configura el envío del formulario de pago hacia la API.
 */
function setupPaymentFormSubmit(orderId) {
    const form = document.getElementById('payment-submission-form');
    const btnSubmit = document.getElementById('btn-submit-payment');

    if (!form || !btnSubmit) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const stage = document.getElementById('payment-stage')?.value;
        const method = document.getElementById('payment-method')?.value;
        const amount = document.getElementById('payment-amount')?.value;
        const reference = document.getElementById('payment-reference')?.value?.trim();
        const fileInput = document.getElementById('payment-receipt-file');
        const notes = document.getElementById('payment-notes')?.value?.trim();

        const amountInput = document.getElementById('payment-amount');
        const minVes = parseFloat(amountInput?.dataset?.minVes || '0');
        const maxVes = parseFloat(amountInput?.dataset?.maxVes || '0');
        const amountNum = parseFloat(amount);

        // Validaciones del cliente
        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            showWarningToast('Monto Inválido', 'Por favor ingresa un monto numérico válido en Bolívares (Bs.).');
            amountInput?.focus();
            return;
        }

        // Validación de monto mínimo (50%)
        if (minVes > 0 && amountNum < (minVes - 0.05)) {
            const minFormatted = `Bs. ${minVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            showWarningToast('Monto Insuficiente', `El monto mínimo de pago requerido es del 50% (${minFormatted}).`);
            amountInput?.focus();
            return;
        }

        // Validación de monto máximo (100%)
        if (maxVes > 0 && amountNum > (maxVes + 0.05)) {
            const maxFormatted = `Bs. ${maxVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            showWarningToast('Monto Excedido', `El monto ingresado no puede superar el total de la orden (${maxFormatted}).`);
            amountInput?.focus();
            return;
        }

        if (!reference) {
            showWarningToast('Referencia Obligatoria', 'Por favor ingresa el número de referencia bancaria.');
            document.getElementById('payment-reference')?.focus();
            return;
        }

        if (!fileInput.files || fileInput.files.length === 0) {
            showWarningToast('Comprobante Obligatorio', 'Debes adjuntar una foto o documento del comprobante de pago.');
            return;
        }

        // Construir FormData
        const formData = new FormData();
        formData.append('order', orderId);
        formData.append('payment_stage', stage);
        formData.append('payment_method', method);
        formData.append('amount', amount);
        formData.append('reference_number', reference);
        formData.append('receipt_file', fileInput.files[0]);
        if (notes) formData.append('notes', notes);

        // Estado de carga en el botón
        btnSubmit.disabled = true;
        const originalBtnHtml = btnSubmit.innerHTML;
        btnSubmit.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
            <span>Enviando Comprobante...</span>
        `;

        try {
            await registrarPago(formData);

            showSuccessToast('¡Comprobante Registrado con Éxito!', 'Hemos recibido tu comprobante de pago. Pasará a revisión por el equipo administrativo.', 7000);

            // Limpiar formulario y preview
            form.reset();
            const btnRemove = document.getElementById('btn-remove-preview');
            if (btnRemove) btnRemove.click();

            // Recargar datos de la orden y pagos
            await loadOrderData(orderId);

        } catch (error) {
            console.error('Error al registrar el pago:', error);
            const errorMsg = error?.data?.detail || error?.data?.error || error?.message || 'No se pudo registrar el pago. Verifica los datos e intenta nuevamente.';
            showErrorToast('Error al Registrar Pago', errorMsg, 7000);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnHtml;
        }
    });
}

/**
 * Configura los botones y enlaces de WhatsApp para contactar a soporte,
 * consultar pago en efectivo en fábrica y solicitar otros medios de pago.
 */
function setupWhatsappButton(order, paymentBreakdown = null) {
    const currentUser = getCurrentUser();
    const userName = currentUser?.first_name ? `${currentUser.first_name} ${currentUser.first_last_name || ''}`.trim() : 'Cliente';
    const orderNum = order.order_number || `#PED-${String(order.id).padStart(4, '0')}`;
    const totalUSD = parseFloat(order.total_price || 0);

    // Extraer lista resumida de productos para los mensajes
    const products = Array.isArray(order.details) ? order.details.map(d => {
        const prod = d.order_products?.[0]?.product;
        return {
            name: prod?.product_name || prod?.name || 'Mueble TuEstante',
            quantity: d.quantity || 1,
            price: parseFloat(d.final_price || d.unit_price || prod?.price || 0)
        };
    }) : [];

    // 1. Botón Principal del Resumen de la Orden
    const btnWhatsapp = document.getElementById('btn-order-whatsapp');
    if (btnWhatsapp) {
        btnWhatsapp.onclick = () => {
            const statusLabel = ORDER_STATUS_CONFIG[order.status]?.label || order.status;
            const message = buildOrderWhatsAppMessage({
                orderNumber: orderNum,
                userName: userName,
                totalUSD: totalUSD,
                totalVES: paymentBreakdown?.total?.rawVes,
                status: statusLabel
            });
            openWhatsApp({ text: message });
        };
    }

    // 2. Enlace Directo para Pago en Efectivo (Fábrica / Sede)
    const linkCash = document.getElementById('link-whatsapp-cash');
    if (linkCash) {
        linkCash.onclick = (e) => {
            e.preventDefault();
            const message = buildCashPaymentWhatsAppMessage({
                orderNumber: orderNum,
                userName: userName,
                products: products,
                totalUSD: totalUSD
            });
            openWhatsApp({ text: message });
        };
    }

    // 3. Enlace Directo para Consultar Otros Medios de Pago
    const linkOther = document.getElementById('link-whatsapp-other');
    if (linkOther) {
        linkOther.onclick = (e) => {
            e.preventDefault();
            const message = buildOtherPaymentMethodsWhatsAppMessage({
                orderNumber: orderNum,
                userName: userName,
                products: products,
                totalUSD: totalUSD
            });
            openWhatsApp({ text: message });
        };
    }
}

/**
 * Sanitiza texto simple para evitar inyecciones HTML.
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Configura el copiado rápido al portapapeles para números de cuenta, teléfono y RIF.
 */
function setupCopyableFields() {
    const copyableElements = document.querySelectorAll('.copyable');
    copyableElements.forEach(el => {
        el.addEventListener('click', async () => {
            const textToCopy = el.dataset.copy || el.textContent.trim();
            if (!textToCopy) return;

            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(textToCopy);
                } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = textToCopy;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                }
                showSuccessToast('Copiado al Portapapeles', `Se ha copiado: ${textToCopy}`, 2500);
            } catch (err) {
                console.warn('No se pudo copiar automáticamente:', err);
                showInfoToast('Dato Bancario', textToCopy, 3000);
            }
        });
    });
}

// ============================================================================
// INICIALIZACIÓN PRINCIPAL
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificación de Autenticación
    const token = getAccessToken();
    if (!token) {
        window.location.href = `../auth/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    // 2. Cargar Componentes Navbar y Footer
    await loadComponent('navbar-placeholder', '../../components/navbar/navbar.html');
    initNavbar();

    await loadComponent('footer-placeholder', '../../components/footer/footer.html');
    initFooter();

    // 3. Obtener ID del Pedido de la URL
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    if (!orderId) {
        showWarningToast('Pedido no especificado', 'No se ha indicado un número de pedido para consultar.');
        return;
    }

    // 4. Inicializar eventos del modal, dropzone y copiado rápido
    setupReceiptModalEvents();
    setupDropzone();
    setupCopyableFields();
    setupPaymentFormSubmit(orderId);

    // 5. Cargar datos de la orden
    await loadOrderData(orderId);

    // 6. Si el usuario llega con parámetro de nuevo pedido (?new=1), mostrar notificación emergente de éxito
    if (params.get('new') === '1' || params.get('registered') === 'true') {
        showSuccessToast(
            '¡Pedido Registrado con Éxito!',
            'Tu pedido fue registrado en nuestro sistema. Ya puedes verificar los métodos de pago y registrar tu comprobante de pago inicial a continuación.',
            7000
        );

        // Limpiar parámetro 'new' de la URL sin recargar la página
        const newUrl = `${window.location.pathname}?id=${orderId}`;
        window.history.replaceState({}, document.title, newUrl);
    }
});
