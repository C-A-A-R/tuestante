/**
 * ==========================================================================
 * SERVICIO DE CONVERSIÓN Y FORMATEO DE MONEDAS (USD <-> VES) - TUESTANTE
 * Utiliza el servicio de tasa de cambio para transformar precios de productos,
 * facturas, totales de pedidos y cálculos de pago inicial/final a Bolívares (Bs.).
 * ==========================================================================
 */

import { getOfficialRate, getExchangeRateDetails } from './exchange-rate.service.js';
export { getOfficialRate, getExchangeRateDetails } from './exchange-rate.service.js';

/**
 * Convierte un monto en Dólares (USD) a Bolívares (VES).
 * @param {number|string} amountUSD Monto en dólares.
 * @param {number} [customRate] Tasa personalizada opcional (si no se especifica, consulta la tasa oficial).
 * @returns {Promise<number>} Monto convertido en Bolívares.
 */
export async function convertUsdToVes(amountUSD, customRate = null) {
    const numericUSD = parseFloat(amountUSD) || 0;
    const rate = customRate || await getOfficialRate();
    return Number((numericUSD * rate).toFixed(2));
}

/**
 * Convierte un monto en Bolívares (VES) a Dólares (USD).
 * @param {number|string} amountVES Monto en bolívares.
 * @param {number} [customRate] Tasa personalizada opcional.
 * @returns {Promise<number>} Monto convertido en dólares.
 */
export async function convertVesToUsd(amountVES, customRate = null) {
    const numericVES = parseFloat(amountVES) || 0;
    const rate = customRate || await getOfficialRate();
    if (rate <= 0) return 0;
    return Number((numericVES / rate).toFixed(2));
}

/**
 * Formatea un número como moneda en Dólares ($ 0.00).
 * @param {number|string} amount Monto numérico.
 * @returns {string} Texto formateado (ej. "$100.00").
 */
export function formatUSD(amount) {
    const num = parseFloat(amount) || 0;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formatea un número como moneda en Bolívares venezolanos (Bs. 0,00).
 * @param {number|string} amount Monto numérico en bolívares.
 * @returns {string} Texto formateado (ej. "Bs. 79.132,48").
 */
export function formatVES(amount) {
    const num = parseFloat(amount) || 0;
    return `Bs. ${num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Genera una representación dual de precio (Dólares y Bolívares).
 * @param {number|string} amountUSD Monto en dólares.
 * @param {number} [customRate] Tasa de cambio opcional.
 * @returns {Promise<{ usd: string, ves: string, rawUsd: number, rawVes: number, rate: number, rateSource: string }>}
 */
export async function getDualPrice(amountUSD, customRate = null) {
    const rawUsd = parseFloat(amountUSD) || 0;
    const details = customRate ? { rate: customRate, source: 'Personalizada' } : await getExchangeRateDetails();
    const rate = details.rate || 1;
    const rawVes = Number((rawUsd * rate).toFixed(2));

    return {
        usd: formatUSD(rawUsd),
        ves: formatVES(rawVes),
        rawUsd,
        rawVes,
        rate,
        rateSource: details.source || 'BCV Oficial'
    };
}

/**
 * Calcula el desglose de pagos (Pago Inicial y Pago Final) en USD y Bolívares.
 * @param {number|string} totalUSD Total de la orden en dólares.
 * @param {number} [customRate] Tasa de cambio opcional.
 * @returns {Promise<{
 *   total: { rawUsd: number, rawVes: number, formattedUsd: string, formattedVes: string },
 *   initialPayment: { rawUsd: number, rawVes: number, formattedUsd: string, formattedVes: string, percent: number },
 *   finalPayment: { rawUsd: number, rawVes: number, formattedUsd: string, formattedVes: string, percent: number },
 *   exchangeRate: number,
 *   source: string
 * }>}
 */
export async function calculateOrderPaymentBreakdown(totalUSD, customRate = null) {
    const rawTotalUsd = parseFloat(totalUSD) || 0;
    const details = customRate ? { rate: customRate, source: 'Manual' } : await getExchangeRateDetails();
    const rate = details.rate || 1;

    const rawTotalVes = Number((rawTotalUsd * rate).toFixed(2));
    const initialUsd = Number((rawTotalUsd * 0.5).toFixed(2));
    const initialVes = Number((initialUsd * rate).toFixed(2));
    const finalUsd = Number((rawTotalUsd - initialUsd).toFixed(2));
    const finalVes = Number((rawTotalVes - initialVes).toFixed(2));

    return {
        total: {
            rawUsd: rawTotalUsd,
            rawVes: rawTotalVes,
            formattedUsd: formatUSD(rawTotalUsd),
            formattedVes: formatVES(rawTotalVes)
        },
        initialPayment: {
            rawUsd: initialUsd,
            rawVes: initialVes,
            formattedUsd: formatUSD(initialUsd),
            formattedVes: formatVES(initialVes),
            percent: 50
        },
        finalPayment: {
            rawUsd: finalUsd,
            rawVes: finalVes,
            formattedUsd: formatUSD(finalUsd),
            formattedVes: formatVES(finalVes),
            percent: 50
        },
        exchangeRate: rate,
        source: details.source || 'BCV Oficial'
    };
}

// Alias para versatilidad en importaciones
export const usdToVes = convertUsdToVes;
export const vesToUsd = convertVesToUsd;
export const formatDualPrice = getDualPrice;
