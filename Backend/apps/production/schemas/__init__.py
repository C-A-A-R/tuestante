"""
Esquemas Pydantic para el sistema paramétrico modular de fabricación.
"""
from .parametric_schema import (
    AccessoriesConfig,
    ColorMapping,
    LocalDimensionsMM,
    GridConfig,
    SectionConfig,
    TotalDimensionsMM,
    TechnicalDesignSchema,
    AICustomizationResponse,
    ProductTypeInferenceResponse,
)

__all__ = [
    'AccessoriesConfig',
    'ColorMapping',
    'LocalDimensionsMM',
    'GridConfig',
    'SectionConfig',
    'TotalDimensionsMM',
    'TechnicalDesignSchema',
    'AICustomizationResponse',
    'ProductTypeInferenceResponse',
]
