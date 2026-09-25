/**
 * ==========================================================================
 * SERVICIO DE CONSULTA DE TASA DE CAMBIO (USD -> BS) - TUESTANTE
 * Consulta la tasa oficial del Banco Central de Venezuela (BCV) y monitores
 * en tiempo real con sistema de caché en localStorage y mecanismos de contingencia.
 * Documentación API: DolarAPI / pyDolarVenezuela / consulta-dolar-venezuela
 * ==========================================================================
 */

import { API_BASE_URL } from '../config.js';

const CACHE_KEY = 'tuestante_exchange_rate_cache';
const FALLBACK_DEFAULT_RATE = 791.32; // Tasa de contingencia en caso de fallo de red

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD según la zona horaria local.
 */
function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Obtiene la tasa de cambio oficial del Dólar (BCV) en Bolívares (Bs.).
 * @param {boolean} [forceRefresh=false] Si es true, ignora la caché y consulta la API directamente.
 * @returns {Promise<number>} Valor numérico de la tasa (ej. 791.32).
 */
export async function getOfficialRate(forceRefresh = false) {
    const details = await getExchangeRateDetails(forceRefresh);
    return details.rate || FALLBACK_DEFAULT_RATE;
}

/**
 * Obtiene los detalles completos de la tasa de cambio actual con metadatos.
 * Consulta la API solo si no existe caché del día de hoy o si se fuerza la actualización.
 * @param {boolean} [forceRefresh=false] Forzar actualización.
 * @returns {Promise<{ rate: number, source: string, lastUpdated: string, date: Date, isCached: boolean }>}
 */
export async function getExchangeRateDetails(forceRefresh = false) {
    // 1. Revisar si ya tenemos la tasa del día en caché local
    if (!forceRefresh) {
        const cached = getCachedRate();
        if (cached) {
            return {
                ...cached,
                isCached: true
            };
        }
    }

    // 2. Intentar consultar endpoint oficial de TuEstante Backend (pyBCV con caché Django)
    try {
        const backendEndpoint = `${API_BASE_URL}/payments/exchange-rate/`;
        const response = await fetch(backendEndpoint, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            const rate = parseFloat(data.rate || data.price || 0);

            if (rate > 0) {
                const details = {
                    rate,
                    source: data.source || 'BCV Oficial (pyBCV)',
                    lastUpdated: data.lastUpdated || new Date().toISOString(),
                    date: new Date(),
                    cache_date: getTodayDateString()
                };
                saveRateToCache(details);
                return { ...details, isCached: false };
            }
        }
    } catch (err) {
        console.warn('Error al consultar tasa del backend TuEstante, probando contingencia externa:', err);
    }

    // 3. Contingencia externa 1: ve.dolarapi.com - Oficial BCV
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            const rate = parseFloat(data.promedio || data.price || data.valor || 0);

            if (rate > 0) {
                const details = {
                    rate,
                    source: data.fuente ? `BCV (${data.fuente})` : 'BCV Oficial',
                    lastUpdated: data.fechaActualizacion || new Date().toISOString(),
                    date: new Date(),
                    cache_date: getTodayDateString()
                };
                saveRateToCache(details);
                return { ...details, isCached: false };
            }
        }
    } catch (err) {
        console.warn('Error al consultar endpoint primario de tasa de cambio:', err);
    }

    // 3. Contingencia 1: Consultar lista general de monitores (ve.dolarapi.com/v1/dolares)
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                const bcvItem = data.find(d => d.fuente === 'oficial' || d.nombre?.toLowerCase().includes('oficial') || d.nombre?.toLowerCase().includes('bcv')) || data[0];
                if (bcvItem) {
                    const rate = parseFloat(bcvItem.promedio || bcvItem.price || 0);
                    if (rate > 0) {
                        const details = {
                            rate,
                            source: 'BCV Oficial',
                            lastUpdated: bcvItem.fechaActualizacion || new Date().toISOString(),
                            date: new Date(),
                            cache_date: getTodayDateString()
                        };
                        saveRateToCache(details);
                        return { ...details, isCached: false };
                    }
                }
            }
        }
    } catch (err) {
        console.warn('Error al consultar lista de monitores de respaldo:', err);
    }

    // 4. Contingencia 2: Usar última tasa guardada en caché aunque sea de un día anterior
    const expiredCache = getCachedRate(true);
    if (expiredCache && expiredCache.rate > 0) {
        return {
            ...expiredCache,
            isCached: true,
            isExpired: true
        };
    }

    // 5. Contingencia 3: Tasa por defecto
    return {
        rate: FALLBACK_DEFAULT_RATE,
        source: 'Tasa de Referencia TuEstante',
        lastUpdated: new Date().toISOString(),
        date: new Date(),
        isFallback: true
    };
}

/**
 * Consulta todas las tasas y monitores disponibles (BCV, Paralelo, etc.).
 * @returns {Promise<Array<Object>>} Lista de tasas.
 */
export async function getAllMonitors() {
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (err) {
        console.warn('No se pudo obtener la lista completa de monitores:', err);
    }
    return [];
}

/**
 * Lee la tasa guardada en localStorage si corresponde al día de hoy.
 * @param {boolean} [ignoreExpiry=false] Si es true, devuelve la tasa guardada aunque sea de otro día.
 */
function getCachedRate(ignoreExpiry = false) {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.rate) return null;

        const today = getTodayDateString();
        const cacheDate = parsed.cache_date;

        if (ignoreExpiry || cacheDate === today) {
            return {
                rate: parseFloat(parsed.rate),
                source: parsed.source || 'BCV Oficial',
                lastUpdated: parsed.lastUpdated || new Date().toISOString(),
                date: new Date(parsed.timestamp || Date.now()),
                cache_date: cacheDate
            };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Guarda la tasa actual en localStorage con fecha de calendario y timestamp.
 */
function saveRateToCache(details) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            rate: details.rate,
            source: details.source,
            lastUpdated: details.lastUpdated,
            cache_date: details.cache_date || getTodayDateString(),
            timestamp: Date.now()
        }));
    } catch (err) {
        console.warn('No se pudo guardar la tasa en caché de localStorage:', err);
    }
}

// Alias para exportación
export const getExchangeRate = getOfficialRate;
export const getBcvRate = getOfficialRate;
