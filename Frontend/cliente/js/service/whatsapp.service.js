/**
 * ==========================================================================
 * SERVICIO REUTILIZABLE DE ENLACES Y CONTACTO DE WHATSAPP - TUESTANTE
 * Proporciona métodos para generar URLs de WhatsApp, abrir chats directos
 * y construir mensajes estructurados para pedidos, productos, pagos y soporte.
 * ==========================================================================
 */

// Teléfono oficial de WhatsApp de TuEstante (formato internacional sin signos + ni espacios)
export const DEFAULT_WHATSAPP_PHONE = '584266272286';

/**
 * Genera una URL válida de WhatsApp (wa.me) con el mensaje codificado.
 * @param {Object} options Parámetros para el enlace.
 * @param {string} [options.phone] Número de teléfono destino en formato internacional (ej. '584261635221').
 * @param {string} [options.text=''] Mensaje a enviar en el chat.
 * @returns {string} URL completa de WhatsApp.
 */
export function generateWhatsAppLink({ phone = DEFAULT_WHATSAPP_PHONE, text = '' } = {}) {
    // Sanitizar número: dejar solo dígitos
    const cleanPhone = String(phone).replace(/\D/g, '') || DEFAULT_WHATSAPP_PHONE;
    const encodedText = encodeURIComponent(text.trim());
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Abre directamente una ventana o pestaña con el chat de WhatsApp configurado.
 * @param {Object} options Parámetros para abrir WhatsApp.
 * @param {string} [options.phone] Número de teléfono destino.
 * @param {string} [options.text=''] Mensaje a enviar.
 * @param {string} [options.target='_blank'] Destino de la ventana ('_blank', '_self').
 * @returns {Window|null} Referencia a la ventana abierta.
 */
export function openWhatsApp({ phone = DEFAULT_WHATSAPP_PHONE, text = '', target = '_blank' } = {}) {
    const url = generateWhatsAppLink({ phone, text });
    return window.open(url, target);
}

/**
 * Construye un mensaje pre-formateado para consultar o gestionar un pedido.
 * @param {Object} data Datos del pedido.
 * @param {string|number} data.orderNumber Número o ID del pedido (ej. '#ORD-0001-2026').
 * @param {string} [data.userName='Cliente'] Nombre del cliente.
 * @param {number|string} [data.totalUSD] Total de la orden en USD.
 * @param {number|string} [data.totalVES] Total de la orden en Bolívares (opcional).
 * @param {string} [data.status] Estado actual del pedido.
 * @param {string} [data.customNotes] Nota o consulta específica adicional.
 * @returns {string} Mensaje con formato listo para WhatsApp.
 */
export function buildOrderWhatsAppMessage({
    orderNumber = '',
    userName = 'Cliente',
    totalUSD = 0,
    totalVES = null,
    status = '',
    customNotes = ''
} = {}) {
    const lines = [
        `¡Hola TuEstante!`,
        ``,
        `Consulto sobre mi pedido *${orderNumber}* a nombre de *${userName}*.`,
    ];

    if (status) {
        lines.push(`*Estado actual:* ${status}`);
    }

    if (totalUSD) {
        const formattedUSD = `$${parseFloat(totalUSD).toFixed(2)}`;
        const vesText = totalVES ? ` (Aprox. Bs. ${parseFloat(totalVES).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';
        lines.push(`*Monto Total:* ${formattedUSD}${vesText}`);
    }

    if (customNotes) {
        lines.push(`*Detalle:* ${customNotes}`);
    } else {
        lines.push(``);
        lines.push(`¿Me podrían brindar información sobre el estado de fabricación y verificación de pago? ¡Muchas gracias!`);
    }

    return lines.join('\n');
}

/**
 * Construye un mensaje para consultar sobre un producto específico del catálogo.
 * @param {Object} data Datos del producto.
 * @param {string} data.productName Nombre del producto.
 * @param {number|string} [data.productPrice] Precio del producto en USD.
 * @param {string} [data.productUrl] Enlace al producto en la web.
 * @param {string} [data.userName='Cliente'] Nombre del cliente.
 * @returns {string} Mensaje estructurado.
 */
export function buildProductInquiryWhatsAppMessage({
    productName = 'Producto',
    productPrice = null,
    productUrl = '',
    userName = 'Cliente'
} = {}) {
    const lines = [
        `¡Hola TuEstante! Mi nombre es *${userName}*.`,
        `Estoy interesado(a) en el siguiente producto de su catálogo:`,
        `*${productName}*`
    ];

    if (productPrice) {
        lines.push(`*Precio de referencia:* $${parseFloat(productPrice).toFixed(2)}`);
    }

    if (productUrl) {
        lines.push(`*Enlace:* ${productUrl}`);
    }

    lines.push(``);
    lines.push(`¿Tienen disponibilidad o fabricación en medidas y colores personalizados? ¡Gracias!`);

    return lines.join('\n');
}

/**
 * Construye un mensaje para solicitar información sobre pago en efectivo en fábrica/sede.
 * @param {Object} data Datos de la orden.
 * @param {string|number} data.orderNumber Número de la orden.
 * @param {string} [data.userName='Cliente'] Nombre del cliente ("Soy ...").
 * @param {Array<Object>} [data.products=[]] Lista de productos de la orden.
 * @param {number|string} data.totalUSD Total de la orden en dólares (sin transformación).
 * @returns {string} Mensaje estructurado.
 */
export function buildCashPaymentWhatsAppMessage({
    orderNumber = '',
    userName = 'Cliente',
    products = [],
    totalUSD = 0
} = {}) {
    const formattedUSD = `$${parseFloat(totalUSD || 0).toFixed(2)} USD`;
    const lines = [
        `¡Hola TuEstante! Soy *${userName}*.`,
        ``,
        `Tengo la orden *${orderNumber}* con los siguientes productos:`
    ];

    if (Array.isArray(products) && products.length > 0) {
        products.forEach(p => {
            const name = p.name || p.product_name || 'Producto';
            const qty = p.quantity || p.qty || 1;
            const price = p.price ? ` ($${parseFloat(p.price).toFixed(2)})` : '';
            lines.push(`• ${qty}x *${name}*${price}`);
        });
    } else {
        lines.push(`• Productos registrados en mi pedido.`);
    }

    lines.push(``);
    lines.push(`*Total a pagar:* ${formattedUSD}`);
    lines.push(``);
    lines.push(`Deseo consultar más información sobre los pasos para realizar el pago en efectivo directamente en fábrica / sede central. ¿Me podrían indicar la dirección exacta y horarios de atención? ¡Muchas gracias!`);

    return lines.join('\n');
}

/**
 * Construye un mensaje para consultar sobre otros medios de pago disponibles.
 * @param {Object} data Datos de la orden.
 * @param {string|number} data.orderNumber Número de la orden.
 * @param {string} [data.userName='Cliente'] Nombre del cliente ("Soy ...").
 * @param {Array<Object>} [data.products=[]] Lista de productos de la orden.
 * @param {number|string} data.totalUSD Total de la orden en dólares (sin transformación).
 * @returns {string} Mensaje estructurado.
 */
export function buildOtherPaymentMethodsWhatsAppMessage({
    orderNumber = '',
    userName = 'Cliente',
    products = [],
    totalUSD = 0
} = {}) {
    const formattedUSD = `$${parseFloat(totalUSD || 0).toFixed(2)} USD`;
    const lines = [
        `¡Hola TuEstante! Soy *${userName}*.`,
        ``,
        `Tengo la orden *${orderNumber}* con los siguientes productos:`
    ];

    if (Array.isArray(products) && products.length > 0) {
        products.forEach(p => {
            const name = p.name || p.product_name || 'Producto';
            const qty = p.quantity || p.qty || 1;
            const price = p.price ? ` ($${parseFloat(p.price).toFixed(2)})` : '';
            lines.push(`• ${qty}x *${name}*${price}`);
        });
    } else {
        lines.push(`• Productos registrados en mi pedido.`);
    }

    lines.push(``);
    lines.push(`*Total a pagar:* ${formattedUSD}`);
    lines.push(``);
    lines.push(`Quisiera consultar si tienen disponible algún otro medio de pago alternativo para procesar mi orden. ¡Muchas gracias!`);

    return lines.join('\n');
}

/**
 * Construye un mensaje general de contacto y cotizaciones a medida.
 * @param {Object} data Datos de la consulta.
 * @param {string} [data.subject='Información General'] Asunto o tipo de proyecto.
 * @param {string} [data.userName='Cliente'] Nombre del cliente.
 * @param {string} [data.message=''] Mensaje o requerimientos.
 * @returns {string} Mensaje estructurado.
 */
export function buildGeneralContactWhatsAppMessage({
    subject = 'Información General',
    userName = 'Cliente',
    message = ''
} = {}) {
    const lines = [
        `¡Hola TuEstante! Mi nombre es *${userName}*.`,
        `Me comunico para solicitar información sobre: *${subject}*.`
    ];

    if (message) {
        lines.push(``);
        lines.push(`*Detalles:* ${message}`);
    }

    return lines.join('\n');
}
