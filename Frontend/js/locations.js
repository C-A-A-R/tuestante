/**
 * ==========================================================================
 * SERVICIO Y DATOS DE UBICACIONES DE VENEZUELA (FRONTEND GLOBAL)
 * Re-exporta VENEZUELA_LOCATIONS y provee funciones utilitarias para
 * estados, municipios y ciudades en cascada.
 * ==========================================================================
 */

import {
  VENEZUELA_LOCATIONS,
  getVenezuelaStates,
  getMunicipalitiesByState,
  getCitiesByMunicipality
} from '../admin/js/data/venezuela-locations.data.js';

export {
  VENEZUELA_LOCATIONS,
  getVenezuelaStates,
  getMunicipalitiesByState,
  getCitiesByMunicipality
};

/**
 * Obtiene todas las ciudades / localidades únicas de un estado.
 * @param {string} stateName Nombre del estado
 * @returns {string[]} Lista de nombres de ciudades ordenadas alfabéticamente
 */
export function getCitiesByState(stateName) {
  if (!stateName || !VENEZUELA_LOCATIONS[stateName]) return [];
  const set = new Set();
  const stateData = VENEZUELA_LOCATIONS[stateName];
  Object.values(stateData).forEach(cities => {
    if (Array.isArray(cities)) {
      cities.forEach(c => set.add(c));
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

/**
 * Busca el municipio correspondiente para una ciudad dentro de un estado.
 * @param {string} stateName
 * @param {string} cityName
 * @returns {string|null} Nombre del municipio encontrado o el primero disponible
 */
export function findMunicipalityForCity(stateName, cityName) {
  if (!stateName || !VENEZUELA_LOCATIONS[stateName]) return null;
  const munKeys = Object.keys(VENEZUELA_LOCATIONS[stateName]);
  if (!cityName) return munKeys[0] || null;

  const normCity = cityName.trim().toLowerCase();
  for (const mun of munKeys) {
    const cities = VENEZUELA_LOCATIONS[stateName][mun] || [];
    if (cities.some(c => c.trim().toLowerCase() === normCity)) {
      return mun;
    }
  }

  // Si el nombre de la ciudad coincide directamente con el nombre del municipio
  for (const mun of munKeys) {
    if (mun.trim().toLowerCase() === normCity) {
      return mun;
    }
  }

  return munKeys[0] || null;
}
