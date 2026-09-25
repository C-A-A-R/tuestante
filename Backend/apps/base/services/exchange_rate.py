"""
Servicio para consulta y conversión con la Tasa Oficial del Banco Central de Venezuela (BCV).
Utiliza el registro persistente de tasas de cambio oficial en orders/utils con respaldo
en pyBCV y DolarAPI como contingencia, con sistema de caché en Django para alta disponibilidad.
"""

from decimal import Decimal
import logging
import urllib.request
import json
from typing import Dict, Any
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_KEY_BCV_RATE = 'tuestante_bcv_official_rate_val'
CACHE_KEY_BCV_DETAILS = 'tuestante_bcv_official_details'
CACHE_TIMEOUT = 60 * 60 * 6  # 6 horas de caché


def get_bcv_rate() -> Decimal:
    """
    Obtiene la tasa de cambio oficial del BCV (USD -> VES) como Decimal.
    """
    cached_rate = cache.get(CACHE_KEY_BCV_RATE)
    if cached_rate:
        try:
            return Decimal(str(cached_rate))
        except Exception:
            pass

    details = get_exchange_rate_details()
    return Decimal(str(details.get('rate', '848.55')))


def get_exchange_rate_details() -> Dict[str, Any]:
    """
    Obtiene detalles de la tasa de cambio actual (tasa, fuente, fecha).
    Prioriza el modelo persistente diario de orders, pyBCV y contingencia DolarAPI.
    """
    cached_details = cache.get(CACHE_KEY_BCV_DETAILS)
    if cached_details:
        return cached_details

    rate_found = None
    source = 'BCV Oficial'

    # 1. Intentar obtener la tasa persistida del día desde orders.utils
    try:
        from apps.orders.utils import get_or_create_daily_exchange_rate
        rate_obj = get_or_create_daily_exchange_rate()
        if rate_obj and rate_obj.rate and rate_obj.rate > Decimal('0.00'):
            rate_found = rate_obj.rate
            source = rate_obj.source or 'BCV Oficial'
    except Exception as e:
        logger.warning(f"Error consultando orders.utils.get_or_create_daily_exchange_rate: {e}")

    # 2. Proveedor Primario directo: pyBCV si aún no hay tasa
    if not rate_found:
        try:
            from pyBCV import Currency
            bcv = Currency()
            rate_raw = bcv.get_rate(currency_code='USD')
            if rate_raw:
                clean_str = str(rate_raw).replace(',', '.').strip()
                val = Decimal(clean_str)
                if val > 0:
                    rate_found = val
                    source = 'BCV Oficial (pyBCV)'
        except Exception as e:
            logger.warning(f"Error consultando pyBCV: {e}")

    # 3. Proveedor de Contingencia: DolarAPI (Oficial BCV)
    if not rate_found:
        try:
            url = 'https://ve.dolarapi.com/v1/dolares/oficial'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (TuEstante API)'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                promedio = data.get('promedio') or data.get('price') or data.get('valor')
                if promedio:
                    val = Decimal(str(promedio))
                    if val > 0:
                        rate_found = val
                        source = f"BCV Oficial ({data.get('fuente', 'dolarapi')})"
        except Exception as e:
            logger.warning(f"Error consultando contingencia DolarAPI: {e}")

    # 4. Fallback de seguridad
    if not rate_found:
        rate_found = Decimal('848.55')
        source = 'Tasa Referencial TuEstante (Fallback)'

    details = {
        'rate': float(rate_found),
        'rate_decimal': str(rate_found),
        'source': source,
        'currency': 'USD'
    }

    cache.set(CACHE_KEY_BCV_RATE, str(rate_found), CACHE_TIMEOUT)
    cache.set(CACHE_KEY_BCV_DETAILS, details, CACHE_TIMEOUT)

    return details
