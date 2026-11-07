"""
Servicio de Inferencia Arquitectónica Dinámica para Tipos de Producto (ProductType).
Permite inferir automáticamente con IA el arquetipo constructivo, presencia de puertas
y plantilla paramétrica modular (layout_template) al crear o editar cualquier tipo de producto,
incluso tipos completamente novedosos o desconocidos en el catálogo.
"""

import json
import logging
import os
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from django.conf import settings

from apps.production.schemas.parametric_schema import ProductTypeInferenceResponse

logger = logging.getLogger(__name__)


class ProductTypeArchitectureService:
    """
    Infiere y genera la arquitectura modular base para un Tipo de Producto.
    Garantiza que el sistema sea 100% agnóstico ante cualquier mueble nuevo.
    """

    @classmethod
    def get_api_key(cls) -> str:
        """Obtiene la clave de API de Gemini."""
        return (
            os.getenv('GEMINI_API_KEY')
            or os.getenv('GEMENI_API_KEY')
            or getattr(settings, 'GEMINI_API_KEY', None)
            or getattr(settings, 'GEMENI_API_KEY', None)
            or ''
        ).strip()

    @classmethod
    def infer_architecture(cls, name: str, description: str = "") -> ProductTypeInferenceResponse:
        """
        Determina la arquitectura base (arquetipo, puertas y plantilla de secciones)
        analizando el nombre y descripción del tipo de producto.
        """
        cleaned_name = str(name or '').strip()
        cleaned_desc = str(description or '').strip()

        api_key = cls.get_api_key()
        if not api_key:
            logger.info("GEMINI_API_KEY no configurada. Utilizando plantilla heurística determinista.")
            return cls._fallback_heuristic_inference(cleaned_name, cleaned_desc)

        try:
            return cls._call_gemini_inference(cleaned_name, cleaned_desc, api_key)
        except Exception as exc:
            logger.warning(f"Error al inferir arquitectura de tipo con Gemini: {exc}. Usando fallback.")
            return cls._fallback_heuristic_inference(cleaned_name, cleaned_desc)

    @classmethod
    def auto_populate_product_type(cls, product_type, force: bool = False) -> bool:
        """
        Autocompleta los campos de arquitectura y plantilla de un ProductType
        si no están definidos o si force=True.
        """
        if not force and product_type.layout_template and product_type.archetype:
            return False

        inference = cls.infer_architecture(
            name=product_type.product_type_name,
            description=product_type.description or ""
        )

        update_fields = []
        if not product_type.archetype or force or product_type.archetype == 'caja_cerrada':
            product_type.archetype = inference.archetype
            update_fields.append('archetype')

        product_type.default_has_doors = inference.default_has_doors
        update_fields.append('default_has_doors')

        product_type.layout_template = inference.layout_template
        update_fields.append('layout_template')

        if update_fields:
            product_type.save(update_fields=update_fields)
            return True
        return False

    @classmethod
    def _call_gemini_inference(cls, name: str, description: str, api_key: str) -> ProductTypeInferenceResponse:
        """
        Invoca a Gemini con system instruction y salida estructurada Pydantic.
        """
        system_instruction = (
            "Eres el Arquitecto Jefe de Manufactura e Ingeniería Industrial de TuEstante (fábrica de mobiliario modular).\n"
            "Tu misión es analizar el nombre y descripción de una NUEVA categoría/tipo de producto y definir su arquitectura "
            "paramétrica constructiva de forma que pueda fabricarse y renderizarse automáticamente en planos 2.5D.\n\n"
            "ARQUETIPOS PERMITIDOS ('archetype'):\n"
            "- 'caja_cerrada': Muebles tipo locker, armario, casillero o gabinete con puertas abatibles.\n"
            "- 'estante_abierto': Estanterías, bibliotecas, entrepaños o repisas abiertas sin puertas.\n"
            "- 'banca': Asientos, bancas de vestuario, bancos con patas tubulares o base estructural.\n"
            "- 'compuesto_locker_banca': Muebles híbridos integrados (ej. casillero superior montado sobre banca inferior saliente).\n"
            "- 'generico_modular': Cualquier mueble modular mixto o especial (archivadores, escritorios, cajoneras, vitrinas).\n\n"
            "REGLAS PARA 'layout_template':\n"
            "Debes armar un objeto con una clave 'sections' que contenga una lista de bloques apilados. Cada sección tiene:\n"
            "  * 'section_id': string único ('sec_base', 'sec_main', 'sec_upper', etc.)\n"
            "  * 'stack_order': entero (1 = base/inferior, 2 = superior, etc.)\n"
            "  * 'zone': 'inferior' | 'superior' | 'cuerpo_principal' | 'lateral' | 'base'\n"
            "  * 'block_type': 'caja_puertas' | 'estanteria_baldas' | 'asiento_banca' | 'cajonera' | 'modulo_combinado' | 'superficie_mesa'\n"
            "  * 'local_dimensions_ratio': proporciones relativas {'height_ratio': float (0.1 a 1.0), 'depth_offset_mm': int (saliente de fondo en mm, ej 0 o 200)}\n"
            "  * 'accessories': {'has_doors': bool, 'has_handles': bool, 'has_bevels': bool, 'has_ventilation': bool, 'has_tubular_legs': bool, 'has_plinth': bool}\n\n"
            "Responde estrictamente con el JSON estructurado solicitado."
        )

        user_prompt = (
            f"TIPO DE PRODUCTO:\nNombre: \"{name}\"\nDescripción: \"{description}\"\n\n"
            "Genera la definición arquitectónica y plantilla paramétrica correspondiente."
        )

        # Esquema JSON a partir de Pydantic
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
                    if response.getcode() == 200:
                        res_body = response.read().decode('utf-8')
                        res_data = json.loads(res_body)
                        candidates = res_data.get('candidates', [])
                        if candidates:
                            raw_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                            if raw_text:
                                parsed = json.loads(raw_text)
                                return ProductTypeInferenceResponse.model_validate(parsed)
            except Exception as e:
                logger.warning(f"Fallo en modelo {model} para inferir ProductType: {e}")
                continue

        # Si fallaron los modelos remotos, aplicar fallback heurístico
        return cls._fallback_heuristic_inference(name, description)

    @classmethod
    def _fallback_heuristic_inference(cls, name: str, description: str) -> ProductTypeInferenceResponse:
        """
        Plantilla heurística determinista offline para clasificar tipos de muebles
        sin conexión a internet o cuando la cuota de API no está disponible.
        """
        text = f"{name} {description}".lower()

        # 1. Compuesto locker-banca
        if ('banca' in text or 'banco' in text) and ('locker' in text or 'casillero' in text or 'armario' in text):
            return ProductTypeInferenceResponse(
                archetype="compuesto_locker_banca",
                default_has_doors=True,
                recommended_dimensions_cm={"height": 180.0, "width": 90.0, "depth": 60.0},
                layout_template={
                    "sections": [
                        {
                            "section_id": "sec_bench_base",
                            "stack_order": 1,
                            "zone": "inferior",
                            "block_type": "asiento_banca",
                            "local_dimensions_ratio": {"height_ratio": 0.25, "depth_offset_mm": 200},
                            "accessories": {
                                "has_doors": False,
                                "has_handles": False,
                                "has_bevels": False,
                                "has_ventilation": False,
                                "has_tubular_legs": True,
                                "has_plinth": False
                            }
                        },
                        {
                            "section_id": "sec_locker_upper",
                            "stack_order": 2,
                            "zone": "superior",
                            "block_type": "caja_puertas",
                            "local_dimensions_ratio": {"height_ratio": 0.75, "depth_offset_mm": 0},
                            "accessories": {
                                "has_doors": True,
                                "has_handles": True,
                                "has_bevels": True,
                                "has_ventilation": True,
                                "has_tubular_legs": False,
                                "has_plinth": False
                            }
                        }
                    ]
                },
                reasoning="Detectada combinación de casillero y banca de vestuario con frente saliente."
            )

        # 2. Banca
        if 'banca' in text or 'banco' in text or 'asiento' in text:
            return ProductTypeInferenceResponse(
                archetype="banca",
                default_has_doors=False,
                recommended_dimensions_cm={"height": 45.0, "width": 120.0, "depth": 45.0},
                layout_template={
                    "sections": [
                        {
                            "section_id": "sec_bench",
                            "stack_order": 1,
                            "zone": "cuerpo_principal",
                            "block_type": "asiento_banca",
                            "local_dimensions_ratio": {"height_ratio": 1.0, "depth_offset_mm": 0},
                            "accessories": {
                                "has_doors": False,
                                "has_handles": False,
                                "has_bevels": False,
                                "has_ventilation": False,
                                "has_tubular_legs": True,
                                "has_plinth": False
                            }
                        }
                    ]
                },
                reasoning="Detectado mobiliario de asiento o banca con estructura tubular."
            )

        # 3. Estante abierto
        if 'estante' in text or 'repisa' in text or 'librero' in text or 'biblioteca' in text or 'balda' in text:
            return ProductTypeInferenceResponse(
                archetype="estante_abierto",
                default_has_doors=False,
                recommended_dimensions_cm={"height": 180.0, "width": 90.0, "depth": 35.0},
                layout_template={
                    "sections": [
                        {
                            "section_id": "sec_shelving",
                            "stack_order": 1,
                            "zone": "cuerpo_principal",
                            "block_type": "estanteria_baldas",
                            "local_dimensions_ratio": {"height_ratio": 1.0, "depth_offset_mm": 0},
                            "accessories": {
                                "has_doors": False,
                                "has_handles": False,
                                "has_bevels": False,
                                "has_ventilation": False,
                                "has_tubular_legs": False,
                                "has_plinth": True
                            }
                        }
                    ]
                },
                reasoning="Detectada estantería o biblioteca abierta con baldas visibles."
            )

        # 4. Caja cerrada / Locker por defecto
        has_doors = not ('abierto' in text or 'sin puerta' in text)
        return ProductTypeInferenceResponse(
            archetype="caja_cerrada" if has_doors else "generico_modular",
            default_has_doors=has_doors,
            recommended_dimensions_cm={"height": 180.0, "width": 90.0, "depth": 45.0},
            layout_template={
                "sections": [
                    {
                        "section_id": "sec_main_cabinet",
                        "stack_order": 1,
                        "zone": "cuerpo_principal",
                        "block_type": "caja_puertas" if has_doors else "estanteria_baldas",
                        "local_dimensions_ratio": {"height_ratio": 1.0, "depth_offset_mm": 0},
                        "accessories": {
                            "has_doors": has_doors,
                            "has_handles": has_doors,
                            "has_bevels": has_doors,
                            "has_ventilation": ('locker' in text or 'casillero' in text),
                            "has_tubular_legs": False,
                            "has_plinth": True
                        }
                    }
                ]
            },
            reasoning="Mobiliario modular cerrado con puertas batientes y accesorios perimetrales."
        )
