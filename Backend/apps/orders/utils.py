import re
from decimal import Decimal
import logging
from django.utils import timezone
from pyBCV import Currency

logger = logging.getLogger(__name__)


def fetch_bcv_usd_rate():
    """
    Consulta la tasa oficial USD en tiempo real directamente desde pyBCV.
    Maneja formatos numéricos y fallbacks internos.
    """
    # 1. Intento primario con currency_code='USD'
    try:
        bcv = Currency()
        rate = bcv.get_rate(currency_code='USD')
        if isinstance(rate, str):
            rate = rate.replace(',', '.').strip()
        val = Decimal(str(rate)).quantize(Decimal('0.0001'))
        if val > Decimal('0.00'):
            return val
    except Exception as e:
        logger.warning(f"Intento primario pyBCV (currency_code='USD') falló: {e}")

    # 2. Intento secundario: consulta del diccionario completo
    try:
        bcv = Currency()
        rates_dict = bcv.get_rate()
        if isinstance(rates_dict, dict) and 'USD' in rates_dict:
            usd_str = str(rates_dict['USD']).replace(',', '.').strip()
            val = Decimal(usd_str).quantize(Decimal('0.0001'))
            if val > Decimal('0.00'):
                return val
    except Exception as e:
        logger.error(f"Error crítico al consultar pyBCV: {e}")

    return None


def get_or_create_daily_exchange_rate(target_date=None):
    """
    Obtiene o almacena la tasa de cambio oficial para una fecha específica (por defecto hoy).

    REGLA DE NEGOCIO:
    En Venezuela, el BCV actualiza en horas de la tarde (aprox. 4:30 PM - 5:00 PM) la tasa
    con fecha valor del día siguiente hábil. Para evitar inconsistencias o que pedidos del
    mismo día en la tarde utilicen una tasa distinta a la fijada en la mañana, esta función:
      1. Revisa si ya existe una tasa registrada para la fecha solicitada en la BD.
         Si existe, la retorna directamente (GARANTIZA que se use una sola tasa por día).
      2. Si no existe registro para el día, consulta pyBCV y la almacena de inmediato en la BD.
      3. Si pyBCV no responde o falla la red, toma como contingencia la última tasa oficial
         registrada en la base de datos histórica.
    """
    from apps.orders.models import ExchangeRate

    if target_date is None:
        target_date = timezone.localdate()

    # 1. Verificar si ya existe tasa registrada para este día
    existing = ExchangeRate.objects.filter(date=target_date, is_deleted=False).first()
    if existing:
        return existing

    # 2. Consultar nueva tasa oficial desde pyBCV
    rate_val = fetch_bcv_usd_rate()
    if rate_val and rate_val > Decimal('0.00'):
        try:
            exchange_record, created = ExchangeRate.objects.get_or_create(
                date=target_date,
                defaults={
                    'rate': rate_val,
                    'source': 'BCV',
                    'is_manual': False,
                    'notes': f'Registrada automáticamente el {timezone.now().strftime("%d/%m/%Y %H:%M")}'
                }
            )
            return exchange_record
        except Exception as ex:
            logger.error(f"Error al guardar ExchangeRate para {target_date}: {ex}")
            # Si hubo condición de carrera en creación simultánea, buscar de nuevo
            return ExchangeRate.objects.filter(date=target_date).first()

    # 3. Fallback: usar la última tasa histórica disponible en la BD
    latest = ExchangeRate.objects.filter(is_deleted=False).order_by('-date').first()
    if latest:
        logger.info(f"Usando última tasa registrada ({latest.date}: {latest.rate}) como fallback para {target_date}.")
        return latest

    return None


def get_bcv_usd_rate(target_date=None):
    """
    Retorna el valor numérico Decimal de la tasa BCV del día.
    Utiliza el registro persistente diario para evitar cambios intra-día.
    """
    rate_obj = get_or_create_daily_exchange_rate(target_date)
    if rate_obj:
        return rate_obj.rate
    return Decimal('0.00')


def generate_order_number():
    """
    Genera un número de orden único correlativo para el año en curso
    siguiendo el formato ORD-nnnn-año (ej. ORD-0001-2026).
    """
    from apps.orders.models import Order

    year = timezone.now().year
    prefix = "ORD-"
    suffix = f"-{year}"

    last_order = (
        Order.objects.filter(order_number__startswith=prefix, order_number__endswith=suffix)
        .order_by('-id')
        .first()
    )

    if last_order and last_order.order_number:
        match = re.match(r'^ORD-(\d+)-\d{4}$', last_order.order_number)
        if match:
            new_seq = int(match.group(1)) + 1
        else:
            new_seq = Order.objects.filter(order_number__endswith=suffix).count() + 1
    else:
        new_seq = 1

    order_number = f"ORD-{new_seq:04d}-{year}"
    while Order.objects.filter(order_number=order_number).exists():
        new_seq += 1
        order_number = f"ORD-{new_seq:04d}-{year}"

    return order_number
