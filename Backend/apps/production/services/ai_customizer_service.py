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
        - Siempre que haya una nota en la orden de fabricación o producto (sin limitarse a palabras clave),
          se invoca a la API de Gemini para evaluar y actualizar el modelo o diseño visual de ser necesario.

        Retorna:
        - technical_design (dict): Diseño final (modificado o base).
        - has_physical_changes (bool): True si se aplicaron cambios físicos por IA.
        - message (str): Resumen o explicación del resultado.
        """
        cleaned_notes = str(notes or '').strip()
        if not cleaned_notes:
            return base_design, False, "Sin notas adicionales; se utiliza diseño estándar (0 tokens)."

        api_key = cls.get_api_key()
        if not api_key:
            logger.warning("No se encontró GEMINI_API_KEY configurada. Aplicando motor heurístico de respaldo.")
            return cls._apply_heuristic_fallback(base_design, cleaned_notes, error_context="Sin API key")

        # Invoca Gemini API siempre que exista una nota para actualizar el modelo o diseño visual
        try:
            return cls._call_gemini(base_design, cleaned_notes, api_key)
        except Exception as exc:
            logger.warning(f"Aviso en llamada Gemini API ({exc}). Aplicando motor heurístico determinista de taller.")
            return cls._apply_heuristic_fallback(base_design, cleaned_notes, error_context=str(exc))

    @classmethod
    def _apply_heuristic_fallback(
        cls,
        base_design: Dict[str, Any],
        notes: str,
        error_context: str = ""
    ) -> Tuple[Dict[str, Any], bool, str]:
        """
        Motor de Inferencia Heurística Determinista (0 Tokens / Alta Resiliencia).
        Extrae y aplica modificaciones constructivas (colores, distribución, puertas,
        dimensiones, repisas) directamente del texto de las notas cuando la API
        externa de Gemini experimenta alta demanda (HTTP 503/429), cuotas agotadas o falta de red.
        """
        import copy
        design = copy.deepcopy(base_design)
        notes_lower = notes.lower()
        changes_applied = []

        # 1. Extracción de color
        color_detected = None
        color_name_detected = None
        color_lookup = {
            'rojo': '#C0392B',
            'roja': '#C0392B',
            'rojas': '#C0392B',
            'rojos': '#C0392B',
            'granate': '#900C3F',
            'azul': '#2980B9',
            'azules': '#2980B9',
            'verde': '#27AE60',
            'verdes': '#27AE60',
            'blanco': '#FFFFFF',
            'blanca': '#FFFFFF',
            'blancos': '#FFFFFF',
            'blancas': '#FFFFFF',
            'negro': '#1A1A1A',
            'negra': '#1A1A1A',
            'negros': '#1A1A1A',
            'negras': '#1A1A1A',
            'gris': '#7F8C8D',
            'grises': '#7F8C8D',
            'plomo': '#7F8C8D',
            'amarillo': '#F39C12',
            'amarilla': '#F39C12',
            'naranja': '#E67E22',
            'grafito': '#2C3E50',
            'madera': '#8B5A2B',
            'roble': '#A67B5B',
        }
        hex_match = re.search(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b', notes)
        if hex_match:
            color_detected = f"#{hex_match.group(1)}".upper()
            color_name_detected = color_detected
        else:
            for c_name, c_hex in color_lookup.items():
                if re.search(rf'\b{c_name}\b', notes_lower):
                    color_detected = c_hex
                    color_name_detected = c_name
                    break

        if color_detected:
            design['main_color'] = color_detected
            design['main_color_hex'] = color_detected
            if 'sections' in design and isinstance(design['sections'], list):
                for sec in design['sections']:
                    if isinstance(sec, dict) and 'color_mapping' in sec:
                        sec['color_mapping']['body_color'] = color_detected
                        if sec.get('accessories', {}).get('has_doors'):
                            sec['color_mapping']['doors_color'] = color_detected
            if 'compartments' in design and isinstance(design['compartments'], list):
                for comp in design['compartments']:
                    if isinstance(comp, dict):
                        comp['door_color'] = color_detected
            changes_applied.append(f"Color actualizado a {color_name_detected} ({color_detected})")

        # 2. Extracción de puertas / filas / niveles
        word_to_num = {
            'una': 1, 'un': 1, 'uno': 1,
            'dos': 2,
            'tres': 3,
            'cuatro': 4,
            'cinco': 5,
            'seis': 6,
            'siete': 7,
            'ocho': 8,
        }
        door_match = re.search(r'\b(\d+)\s*(?:puertas?|ptas?|compartimentos?|cuerpos?|niveles?|filas?)\b', notes_lower)
        target_rows = None
        if door_match:
            target_rows = int(door_match.group(1))
        else:
            word_door_match = re.search(r'\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho)\s*(?:puertas?|ptas?|compartimentos?|cuerpos?|niveles?|filas?)\b', notes_lower)
            if word_door_match:
                target_rows = word_to_num.get(word_door_match.group(1).lower())

        if target_rows and 1 <= target_rows <= 12:
            design.setdefault('grid', {})['rows'] = target_rows
            cols = design.get('grid', {}).get('columns', 1) or 1
            if 'sections' in design and isinstance(design['sections'], list):
                for sec in design['sections']:
                    if isinstance(sec, dict):
                        sec.setdefault('grid', {})['rows'] = target_rows
                        sec.setdefault('accessories', {})['has_doors'] = True
                        if color_detected:
                            sec.setdefault('color_mapping', {})['doors_color'] = color_detected
            # Reconstruir compartimentos
            new_comps = []
            for r in range(1, target_rows + 1):
                for c in range(1, cols + 1):
                    new_comps.append({
                        "row": r,
                        "col": c,
                        "has_door": True,
                        "door_color": color_detected or design.get('main_color', '#2C3E50'),
                        "has_ventilation": design.get('archetype') in ['caja_cerrada', 'compuesto_locker_banca'],
                        "notes": ""
                    })
            design['compartments'] = new_comps
            changes_applied.append(f"Distribución ajustada a {target_rows} puertas")

        # 3. Detección de estantería abierta / sin puertas
        if re.search(r'\b(sin puertas?|sin puerta|estante abierto|repisas?|baldas?)\b', notes_lower):
            design['archetype'] = 'estante_abierto'
            if 'sections' in design and isinstance(design['sections'], list):
                for sec in design['sections']:
                    if isinstance(sec, dict):
                        sec['block_type'] = 'estanteria_baldas'
                        sec.setdefault('accessories', {})['has_doors'] = False
                        sec.setdefault('accessories', {})['has_handles'] = False
                        sec.setdefault('accessories', {})['has_bevels'] = False
                        sec.setdefault('accessories', {})['has_ventilation'] = False
                        sec.setdefault('color_mapping', {})['doors_color'] = None
            if 'compartments' in design and isinstance(design['compartments'], list):
                for comp in design['compartments']:
                    if isinstance(comp, dict):
                        comp['has_door'] = False
                        comp['has_ventilation'] = False
            changes_applied.append("Configurado como estantería abierta sin puertas")

        # 4. Dimensiones (alto, ancho, fondo)
        h_match = re.search(r'(?:alto|altura)\s*(?:de)?\s*(\d+(?:\.\d+)?)\s*(cm|mm|m)?\b', notes_lower) or \
                  re.search(r'(\d+(?:\.\d+)?)\s*(cm|mm|m)\s*(?:de\s+alto|de\s+altura)\b', notes_lower)
        if h_match:
            val = float(h_match.group(1))
            unit = h_match.group(2) or ('m' if val < 5 else 'cm')
            h_mm = round(val * 1000) if unit == 'm' else (round(val) if unit == 'mm' else round(val * 10))
            if 300 <= h_mm <= 3500:
                design.setdefault('dimensions_total_mm', {})['height'] = h_mm
                design.setdefault('dimensions_mm', {})['height'] = h_mm
                if 'sections' in design and isinstance(design['sections'], list):
                    for sec in design['sections']:
                        if isinstance(sec, dict):
                            sec.setdefault('local_dimensions_mm', {})['height'] = h_mm
                changes_applied.append(f"Alto modificado a {h_mm} mm")

        w_match = re.search(r'(?:ancho)\s*(?:de)?\s*(\d+(?:\.\d+)?)\s*(cm|mm|m)?\b', notes_lower) or \
                  re.search(r'(\d+(?:\.\d+)?)\s*(cm|mm|m)\s*(?:de\s+ancho)\b', notes_lower)
        if w_match:
            val = float(w_match.group(1))
            unit = w_match.group(2) or ('m' if val < 5 else 'cm')
            w_mm = round(val * 1000) if unit == 'm' else (round(val) if unit == 'mm' else round(val * 10))
            if 300 <= w_mm <= 3500:
                design.setdefault('dimensions_total_mm', {})['width'] = w_mm
                design.setdefault('dimensions_mm', {})['width'] = w_mm
                if 'sections' in design and isinstance(design['sections'], list):
                    for sec in design['sections']:
                        if isinstance(sec, dict):
                            sec.setdefault('local_dimensions_mm', {})['width'] = w_mm
                changes_applied.append(f"Ancho modificado a {w_mm} mm")

        d_match = re.search(r'(?:fondo|profundidad)\s*(?:de)?\s*(\d+(?:\.\d+)?)\s*(cm|mm|m)?\b', notes_lower) or \
                  re.search(r'(\d+(?:\.\d+)?)\s*(cm|mm|m)\s*(?:de\s+fondo|de\s+profundidad)\b', notes_lower)
        if d_match:
            val = float(d_match.group(1))
            unit = d_match.group(2) or ('m' if val < 5 else 'cm')
            d_mm = round(val * 1000) if unit == 'm' else (round(val) if unit == 'mm' else round(val * 10))
            if 150 <= d_mm <= 1500:
                design.setdefault('dimensions_total_mm', {})['max_depth'] = d_mm
                design.setdefault('dimensions_mm', {})['depth'] = d_mm
                if 'sections' in design and isinstance(design['sections'], list):
                    for sec in design['sections']:
                        if isinstance(sec, dict):
                            sec.setdefault('local_dimensions_mm', {})['depth'] = d_mm
                changes_applied.append(f"Fondo modificado a {d_mm} mm")

        design['original_notes'] = notes

        if changes_applied:
            summary = "Personalización técnica aplicada: " + ", ".join(changes_applied)
            return design, True, summary
        else:
            return base_design, False, "Nota registrada para taller (sin modificaciones estructurales detectadas)."

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
            "Tu misión es analizar las notas de un pedido o producto y ajustar el diseño paramétrico técnico recibido "
            "siempre que el cliente o taller solicite o sugiera modificaciones físicas o visuales "
            "(dimensiones, colores, puertas, repisas, compartimentos, accesorios o cualquier aspecto constructivo).\n\n"
            "REGLAS CRÍTICAS:\n"
            "1. CONVERSIÓN DE MEDIDAS A MILÍMETROS (mm):\n"
            "   - 'cm' -> multiplicar por 10 (ej. '180 cm' -> 1800 mm, '95 cm' -> 950 mm).\n"
            "   - 'm' o 'metros' -> multiplicar por 1000 (ej. '2 metros' -> 2000 mm).\n"
            "   - Números entre 40 y 300 sin unidad explícita: asume centímetros y conviértelos a mm.\n"
            "2. ARQUITECTURA MODULAR POR SECCIONES ('sections') Y GRILLA ('grid'):\n"
            "   - Cada sección en 'sections' debe mantener coherencia con las cotas totales.\n"
            "   - Si se cambia el color principal o de puertas, actualiza 'main_color' y los 'color_mapping' correspondientes.\n"
            "   - Si se solicitan cambios en compartimentos (filas/columnas o número de puertas), ajusta 'grid' y 'compartments'.\n"
            "3. PRESERVACIÓN:\n"
            "   - Si la nota no requiere cambiar un campo, consérvalo idéntico al diseño base.\n"
            "   - Si la nota no requiere cambios físicos o visuales (por ejemplo, es únicamente una indicación logística o felicitación), devuelve el diseño base intacto y establece has_physical_changes = false.\n"
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

        configured_model = os.getenv('GEMINI_MODEL', 'gemini-flash-lite-latest')
        models_to_try = [configured_model]
        for fallback in [
            'gemini-flash-lite-latest',
            'gemini-flash-latest',
            'gemini-2.5-flash',
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash-lite',
            'gemini-2.5-pro'
        ]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

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
                if http_err.code in (404, 429, 500, 502, 503, 504):
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
        if isinstance(parsed, dict) and 'technical_design' not in parsed and ('dimensions_total_mm' in parsed or 'archetype' in parsed or 'grid' in parsed or 'dimensions_mm' in parsed):
            parsed = {
                "technical_design": parsed,
                "has_physical_changes": True,
                "summary_of_changes": "Ajustes paramétricos aplicados según notas de pedido."
            }
        validated_response = AICustomizationResponse.model_validate(parsed)

        custom_dict = validated_response.technical_design.to_dict()

        # Asegurar retrocompatibilidad en campos de primer nivel
        if 'dimensions_total_mm' in custom_dict:
            custom_dict['dimensions_mm'] = {
                'height': custom_dict['dimensions_total_mm'].get('height', 1800),
                'width': custom_dict['dimensions_total_mm'].get('width', 900),
                'depth': custom_dict['dimensions_total_mm'].get('max_depth', 400)
            }

        # 1. Asegurar grid coherente en el nivel superior a partir de sections o de la respuesta
        if not custom_dict.get('grid') or (custom_dict.get('grid', {}).get('rows', 1) == 1 and custom_dict.get('sections')):
            sec_0 = custom_dict.get('sections', [{}])[0]
            if isinstance(sec_0, dict) and 'grid' in sec_0:
                custom_dict['grid'] = {
                    'rows': sec_0['grid'].get('rows', 1),
                    'columns': sec_0['grid'].get('columns', 1)
                }
        if not custom_dict.get('grid'):
            custom_dict['grid'] = base_design.get('grid', {'rows': 1, 'columns': 1})

        # 2. Sincronizar color principal si la IA modificó doors_color o body_color
        doors_c = None
        if custom_dict.get('sections') and isinstance(custom_dict['sections'], list):
            sec_0 = custom_dict['sections'][0]
            if isinstance(sec_0, dict):
                cm = sec_0.get('color_mapping', {})
                doors_c = cm.get('doors_color') or cm.get('body_color')
        if doors_c and doors_c != '#2C3E50':
            custom_dict['main_color'] = doors_c
            custom_dict['main_color_hex'] = doors_c

        # 3. Reconstruir compartimentos según la grilla y arquetipo resultantes
        rows = custom_dict.get('grid', {}).get('rows', 1)
        cols = custom_dict.get('grid', {}).get('columns', 1)
        has_doors = custom_dict.get('archetype') != 'estante_abierto'
        eff_color = custom_dict.get('main_color') or '#2C3E50'
        new_comps = []
        for r in range(1, rows + 1):
            for c in range(1, cols + 1):
                new_comps.append({
                    "row": r,
                    "col": c,
                    "has_door": has_doors,
                    "door_color": eff_color,
                    "has_ventilation": (custom_dict.get('archetype') in ['caja_cerrada', 'compuesto_locker_banca']) and has_doors,
                    "notes": ""
                })
        custom_dict['compartments'] = new_comps

        custom_dict['product_id'] = base_design.get('product_id')
        custom_dict['product_name'] = custom_dict.get('product_name') or base_design.get('product_name')
        custom_dict['furniture_type'] = custom_dict.get('furniture_type') or base_design.get('furniture_type')
        custom_dict['original_notes'] = notes

        return custom_dict, validated_response.has_physical_changes, validated_response.summary_of_changes
