"""
Esquemas Pydantic v2 para el Sistema Paramétrico y Modular de Fabricación Técnica.
Define la estructura estricta del JSON de fabricación (secciones apiladas, cotas y accesorios)
y la respuesta estructurada de Gemini API.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict


class AccessoriesConfig(BaseModel):
    """Configuración de accesorios constructivos de una sección."""
    model_config = ConfigDict(extra='ignore')

    has_doors: bool = Field(default=False, description="Indica si la sección cuenta con puertas")
    has_handles: bool = Field(default=False, description="Presencia de manijas o tiradores metálicos empotrados")
    has_bevels: bool = Field(default=False, description="Presencia de biseles perimetrales en relieve en puertas")
    has_ventilation: bool = Field(default=False, description="Presencia de ranuras de ventilación troqueladas (louvers)")
    has_tubular_legs: bool = Field(default=False, description="Presencia de patas tubulares estructurales")
    has_plinth: bool = Field(default=False, description="Presencia de zócalo o base perimetral inferior")


class ColorMapping(BaseModel):
    """Mapeo de colores hexadecimales para acabado."""
    model_config = ConfigDict(extra='ignore')

    body_color: str = Field(default="#2C3E50", description="Color hexadecimal del cuerpo estructural")
    doors_color: Optional[str] = Field(default=None, description="Color hexadecimal de las puertas")
    seat_color: Optional[str] = Field(default=None, description="Color de asiento o superficie (para bancas/mesas)")
    trim_color: Optional[str] = Field(default=None, description="Color de detalles o biseles")


class LocalDimensionsMM(BaseModel):
    """Cotas dimensionales locales de una sección en milímetros (mm)."""
    model_config = ConfigDict(extra='ignore')

    height: int = Field(default=1800, ge=50, description="Altura particular de la sección en mm")
    width: int = Field(default=900, ge=50, description="Ancho particular de la sección en mm")
    depth: int = Field(default=400, ge=50, description="Profundidad particular de la sección en mm")


class GridConfig(BaseModel):
    """Matriz interna de compartimentos."""
    model_config = ConfigDict(extra='ignore')

    columns: int = Field(default=1, ge=1, le=16, description="Cantidad de columnas o módulos verticales")
    rows: int = Field(default=1, ge=1, le=16, description="Cantidad de filas o niveles horizontales")


class SectionConfig(BaseModel):
    """Representación modular de un bloque o sección constructiva apilada."""
    model_config = ConfigDict(extra='ignore')

    section_id: str = Field(default="sec_main", description="Identificador único de la sección")
    stack_order: int = Field(default=1, ge=1, description="Orden de apilado (1 = inferior/base, 2 = superior, etc.)")
    zone: Literal["inferior", "superior", "lateral", "cuerpo_principal", "base"] = Field(
        default="cuerpo_principal",
        description="Zona espacial de anclaje de la sección"
    )
    block_type: Literal[
        "caja_puertas",
        "estanteria_baldas",
        "asiento_banca",
        "cajonera",
        "modulo_combinado",
        "superficie_mesa"
    ] = Field(
        default="caja_puertas",
        description="Tipo de bloque constructivo modular"
    )
    local_dimensions_mm: LocalDimensionsMM = Field(default_factory=LocalDimensionsMM)
    grid: GridConfig = Field(default_factory=GridConfig)
    accessories: AccessoriesConfig = Field(default_factory=AccessoriesConfig)
    color_mapping: ColorMapping = Field(default_factory=ColorMapping)
    notes: Optional[str] = Field(default="", description="Notas específicas de fabricación para esta sección")


class TotalDimensionsMM(BaseModel):
    """Cotas exteriores totales del mueble en milímetros (mm)."""
    model_config = ConfigDict(extra='ignore')

    height: int = Field(default=1800, ge=50, description="Alto total exterior en mm")
    width: int = Field(default=900, ge=50, description="Ancho total exterior en mm")
    max_depth: int = Field(default=400, ge=50, description="Profundidad máxima exterior en mm")


class TechnicalDesignSchema(BaseModel):
    """Diseño Técnico Paramétrico Global (Inmutable para Fabricación)."""
    model_config = ConfigDict(extra='ignore')

    product_id: Optional[int] = Field(default=None, description="ID del producto en base de datos")
    product_name: str = Field(default="Mueble Modular", description="Nombre del producto")
    furniture_type: str = Field(default="Mobiliario Modular", description="Tipo o categoría de mobiliario")
    archetype: str = Field(
        default="caja_cerrada",
        description="Familia geométrica base (caja_cerrada, estante_abierto, banca, compuesto_locker_banca, generico_modular)"
    )
    main_color: str = Field(default="#2C3E50", description="Color principal estructural en formato hexadecimal (#RRGGBB)")
    main_color_hex: Optional[str] = Field(default=None, description="Hexadecimal del color principal")
    grid: Optional[GridConfig] = Field(default_factory=GridConfig, description="Distribución de filas y columnas")
    dimensions_total_mm: TotalDimensionsMM = Field(default_factory=TotalDimensionsMM)
    sections: List[SectionConfig] = Field(default_factory=list, description="Lista de secciones modulares apiladas")
    notes: Optional[str] = Field(default="", description="Instrucciones consolidadas de taller")

    def to_dict(self) -> Dict[str, Any]:
        """Exporta el esquema a diccionario Python compatible con JSONField."""
        return self.model_dump(mode='json')


class AICustomizationResponse(BaseModel):
    """Respuesta estructurada para la personalización de diseño por notas con Gemini."""
    model_config = ConfigDict(extra='ignore')

    has_physical_changes: bool = Field(
        default=False,
        description="True si las notas solicitan modificaciones físicas reales (medidas, colores, puertas, repisas). False si son solo logísticas o de entrega."
    )
    summary_of_changes: str = Field(
        default="Sin modificaciones físicas solicitadas",
        description="Explicación clara en español de las modificaciones aplicadas o justificación de por qué no aplica"
    )
    technical_design: TechnicalDesignSchema = Field(
        description="Diseño técnico actualizado con las modificaciones aplicadas (o idéntico al base si no hubo cambios)"
    )


class ProductTypeInferenceResponse(BaseModel):
    """Respuesta estructurada para la inferencia de arquitectura y plantilla de un ProductType."""
    model_config = ConfigDict(extra='ignore')

    archetype: Literal[
        "caja_cerrada",
        "estante_abierto",
        "banca",
        "compuesto_locker_banca",
        "generico_modular"
    ] = Field(
        default="caja_cerrada",
        description="Familia geométrica arquitectónica recomendada para este tipo de producto"
    )
    default_has_doors: bool = Field(
        default=False,
        description="True si los compartimentos llevan puertas por defecto"
    )
    recommended_dimensions_cm: Dict[str, float] = Field(
        default_factory=lambda: {"height": 180.0, "width": 90.0, "depth": 40.0},
        description="Dimensiones típicas recomendadas en centímetros"
    )
    recommended_grid: GridConfig = Field(default_factory=GridConfig)
    layout_template: Dict[str, Any] = Field(
        default_factory=dict,
        description="Plantilla de secciones base con zones, block_types y accessories adecuados"
    )
    reasoning: str = Field(
        default="",
        description="Breve justificación de la arquitectura elegida para este tipo de mobiliario"
    )
