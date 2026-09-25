"""
Servicio de Personalización con IA mediante Gemini API y Salida Estructurada Pydantic.
Filtro heurístico de 0 tokens para notas no constructivas y llamada única atómica (~250 tokens)
para interpretar modificaciones físicas o estructurales sobre el diseño paramétrico.
"""

import json
import logging
import os
import re
import urllib.request
import urllib.error
from typing import Dict, Any, Tuple
from django.conf import settings

from apps.production.schemas.parametric_schema import (
    AICustomizationResponse,
    TechnicalDesignSchema
)

logger = logging.getLogger(__name__)


class AICustomizerService:
    """
    Gestiona la evaluación de notas de pedido:
    1. Filtro Heurístico local (0 Tokens): descarta notas vacías o puramente logísticas.
    2. Llamada Atómica con Gemini API (~250 Tokens): resuelve alteraciones físicas bajo esquema Pydantic.
    """

    # Expresión regular para detectar términos de alteración física o constructiva
    CONSTRUCTIVE_KEYWORDS_REGEX = re.compile(
        r'\b(\d+\s*(?:cm|mm|m|metro|centimetro|pulgada)s?|'
        r'alto|altura|ancho|profundidad|fondo|largo|medida|dimensiones|'
        r'color|pintura|pintar|tono|rojo|azul|verde|blanco|negro|gris|amarillo|#[0-9a-fA-F]{3,6}|'
        r'puerta|puertas|sin puerta|repisa|repisas|balda|baldas|estante|estantes|'
        r'rejilla|rejillas|ventilacion|cerradura|manija|manijas|tirador|'
        r'pata|patas|banca|asiento|columna|columnas|fila|filas|casillero|compartimento)\b',
        re.IGNORECASE
    )

    @classmethod
    def get_api_key(cls) -> str:
        """Obtiene la clave de API desde variables de entorno o settings."""
        return (
            os.getenv('GEMINI_API_KEY')
            or os.getenv('GEMENI_API_KEY')
            or getattr(settings, 'GEMINI_API_KEY', None)
            or getattr(settings, 'GEMENI_API_KEY', None)
            or ''
        ).strip()

    @classmethod
    def apply_customizations(
        cls,
        base_design: Dict[str, Any],
        notes: str
    ) -> Tuple[Dict[str, Any], bool, str]:
        """
        Aplica personalizaciones al diseño técnico base:
        - Si las notas están vacías: Retorna el diseño base inmediatamente (0 tokens).
        - Si las notas NO contienen términos constructivos: Retorna el diseño base inmediatamente (0 tokens).
        - Si las notas contienen términos constructivos: Invoca Gemini en una única llamada estructurada (~250 tokens).

        Retorna:
        - technical_design (dict): Diseño final (modificado o base).
        - has_physical_changes (bool): True si se aplicaron cambios físicos por IA.
        - message (str): Resumen o explicación del resultado.
        """
        cleaned_notes = str(notes or '').strip()
        if not cleaned_notes:
            return base_design, False, "Sin notas adicionales; se utiliza diseño estándar (0 tokens)."

        # Fase 2: Filtro Heurístico de Notas (0 tokens)
        if not cls.CONSTRUCTIVE_KEYWORDS_REGEX.search(cleaned_notes):
            return base_design, False, "Notas exclusivamente logísticas; se preserva diseño estándar (0 tokens consumidos)."

        api_key = cls.get_api_key()
        if not api_key:
            logger.warning("No se encontró GEMINI_API_KEY configurada. Utilizando diseño base.")
            return base_design, False, "GEMINI_API_KEY no configurada; diseño base utilizado."

        # Fase 3: Personalización Atómica con IA (Llamada única con Pydantic)
        try:
            return cls._call_gemini(base_design, cleaned_notes, api_key)
        except Exception as exc:
            logger.error(f"Error al procesar personalización con Gemini: {exc}")
            return base_design, False, f"Fallo al invocar IA ({str(exc)}); diseño base utilizado."

    @classmethod
    def _call_gemini(
        cls,
        base_design: Dict[str, Any],
        notes: str,
        api_key: str
    ) -> Tuple[Dict[str, Any], bool, str]:
        """
        Ejecuta la llamada estructurada atómica a Gemini bajo esquema Pydantic.
        """
        system_instruction = (
            "Eres el Ingeniero de Diseño y Manufactura de TuEstante (fábrica de mobiliario modular).\n"
            "Tu misión es analizar las notas de un pedido y ajustar el diseño paramétrico técnico recibido "
            "ÚNICAMENTE si el cliente solicita modificaciones físicas reales (dimensiones, colores, puertas, repisas, accesorios).\n\n"
            "REGLAS CRÍTICAS:\n"
            "1. CONVERSIÓN DE MEDIDAS A MILÍMETROS (mm):\n"
            "   - 'cm' -> multiplicar por 10 (ej. '180 cm' -> 1800 mm, '95 cm' -> 950 mm).\n"
            "   - 'm' o 'metros' -> multiplicar por 1000 (ej. '2 metros' -> 2000 mm).\n"
            "   - Números entre 40 y 300 sin unidad explícita: asume centímetros y conviértelos a mm.\n"
            "2. ARQUITECTURA MODULAR POR SECCIONES ('sections'):\n"
            "   - Cada sección en 'sections' debe mantener coherencia con las cotas totales.\n"
            "   - Si se cambia el color principal o de puertas, actualiza 'main_color' y los 'color_mapping' correspondientes.\n"
            "   - Si se solicitan cambios en compartimentos (filas/columnas), ajusta 'grid' y 'compartments'.\n"
            "3. PRESERVACIÓN:\n"
            "   - Si la nota no requiere cambiar un campo, consérvalo idéntico al diseño base.\n"
            "   - Si la nota no era física (has_physical_changes = false), devuelve el diseño base intacto.\n"
        )

        user_prompt = (
            f"DISEÑO BASE ORIGINAL:\n{json.dumps(base_design, ensure_ascii=False, indent=2)}\n\n"
            f"NOTAS DEL CLIENTE / TALLER:\n\"{notes}\"\n\n"
            "Genera la respuesta estructurada validada."
        )

        payload = {
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": [
                {
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json"
            }
        }

        configured_model = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
        models_to_try = [configured_model]
        if configured_model != 'gemini-2.5-flash':
            models_to_try.append('gemini-2.5-flash')

        res_data = None
        last_exception = None

        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            try:
                with urllib.request.urlopen(req, timeout=12) as response:
                    status_code = response.getcode()
                    if status_code != 200:
                        raise RuntimeError(f"API Gemini ({model}) devolvió código {status_code}")
                    res_body = response.read().decode('utf-8')
                    res_data = json.loads(res_body)
                    break
            except urllib.error.HTTPError as http_err:
                error_msg = http_err.read().decode('utf-8') if http_err.fp else str(http_err)
                last_exception = RuntimeError(f"API Gemini ({model}) error HTTP {http_err.code}: {error_msg}")
                if http_err.code == 404:
                    continue
                raise last_exception
            except urllib.error.URLError as url_err:
                raise RuntimeError(f"Error de conexión con API Gemini ({model}): {url_err.reason}")

        if not res_data:
            if last_exception:
                raise last_exception
            raise RuntimeError("No se obtuvo respuesta de la API de Gemini.")

        candidates = res_data.get('candidates', [])
        if not candidates:
            raise RuntimeError("Respuesta vacía de la API de Gemini.")

        raw_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        if not raw_text:
            raise RuntimeError("No se encontró texto en la respuesta de Gemini.")

        parsed = json.loads(raw_text)
        validated_response = AICustomizationResponse.model_validate(parsed)

        custom_dict = validated_response.technical_design.to_dict()

        # Asegurar retrocompatibilidad en campos de primer nivel
        if 'dimensions_total_mm' in custom_dict:
            custom_dict['dimensions_mm'] = {
                'height': custom_dict['dimensions_total_mm'].get('height', 1800),
                'width': custom_dict['dimensions_total_mm'].get('width', 900),
                'depth': custom_dict['dimensions_total_mm'].get('max_depth', 400)
            }

        # Conservar compartments si no venían en la respuesta
        if not custom_dict.get('compartments') and base_design.get('compartments'):
            custom_dict['compartments'] = base_design.get('compartments')

        custom_dict['product_id'] = base_design.get('product_id')
        custom_dict['product_name'] = custom_dict.get('product_name') or base_design.get('product_name')
        custom_dict['furniture_type'] = custom_dict.get('furniture_type') or base_design.get('furniture_type')
        custom_dict['original_notes'] = notes

        return custom_dict, validated_response.has_physical_changes, validated_response.summary_of_changes
