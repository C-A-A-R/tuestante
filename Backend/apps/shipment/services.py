from typing import Any, Dict


class AddressNormalizationService:
    """
    Servicio para interpretar, normalizar y compatibilizar la información de dirección.
    Soporta:
    - String simple (ej. 'Av. Bolívar, Calle 2, Guasdualito, Páez, Apure' o 'Calle Principal 123')
    - Listas o tuplas (ej. ['Apure', 'Páez', 'Guasdualito', 'Calle 5'] o ['Calle 5', 'Sector Centro'])
    - Diccionarios heterogéneos con claves en español o inglés ('direccion', 'address', 'estado', 'state', etc.)
    """

    @staticmethod
    def normalize(data: Any) -> Dict[str, Any]:
        """
        Normaliza cualquier estructura de dirección en un diccionario estándar
        con los campos esperados por el modelo Shipment.
        """
        if not data:
            return {
                'state': '',
                'municipality': '',
                'city': '',
                'address': '',
                'coverage': '',
                'notes': '',
                'distributor_id': None
            }

        # CASO 1: Si es un string directo
        if isinstance(data, str):
            clean_str = data.strip()
            parts = [p.strip() for p in clean_str.split(',') if p.strip()]
            state = ''
            municipality = ''
            city = ''
            address = clean_str

            if len(parts) >= 4:
                address = parts[0]
                city = parts[1]
                municipality = parts[2]
                state = parts[3]
            elif len(parts) == 3:
                address = parts[0]
                city = parts[1]
                state = parts[2]
            elif len(parts) == 2:
                address = parts[0]
                city = parts[1]

            return {
                'state': state,
                'municipality': municipality,
                'city': city,
                'address': address or clean_str,
                'coverage': '',
                'notes': '',
                'distributor_id': None
            }

        # CASO 2: Si es una lista o tupla
        if isinstance(data, (list, tuple)):
            clean_items = [str(x).strip() for x in data if str(x).strip()]
            if not clean_items:
                return {
                    'state': '',
                    'municipality': '',
                    'city': '',
                    'address': '',
                    'coverage': '',
                    'notes': '',
                    'distributor_id': None
                }

            if len(clean_items) == 1:
                return {
                    'state': '',
                    'municipality': '',
                    'city': '',
                    'address': clean_items[0],
                    'coverage': '',
                    'notes': '',
                    'distributor_id': None
                }
            elif len(clean_items) == 2:
                return {
                    'state': '',
                    'municipality': '',
                    'city': clean_items[0],
                    'address': clean_items[1],
                    'coverage': '',
                    'notes': '',
                    'distributor_id': None
                }
            elif len(clean_items) == 3:
                return {
                    'state': clean_items[0],
                    'municipality': '',
                    'city': clean_items[1],
                    'address': clean_items[2],
                    'coverage': '',
                    'notes': '',
                    'distributor_id': None
                }
            else:
                state = clean_items[0]
                municipality = clean_items[1]
                city = clean_items[2]
                address = ", ".join(clean_items[3:])
                return {
                    'state': state,
                    'municipality': municipality,
                    'city': city,
                    'address': address,
                    'coverage': '',
                    'notes': '',
                    'distributor_id': None
                }

        # CASO 3: Si es un diccionario
        if isinstance(data, dict):
            raw_address = (
                data.get('address') or
                data.get('direccion') or
                data.get('dir') or
                data.get('sector') or
                data.get('calle') or
                ''
            )

            if isinstance(raw_address, (list, tuple)):
                address_str = ", ".join(str(x).strip() for x in raw_address if str(x).strip())
            else:
                address_str = str(raw_address).strip() if raw_address else ''

            state = (
                data.get('state') or
                data.get('estado') or
                data.get('departamento') or
                ''
            )
            municipality = (
                data.get('municipality') or
                data.get('municipio') or
                ''
            )
            city = (
                data.get('city') or
                data.get('ciudad') or
                data.get('localidad') or
                data.get('parroquia') or
                ''
            )
            coverage = (
                data.get('coverage') or
                data.get('cobertura') or
                data.get('zona') or
                ''
            )
            notes = (
                data.get('notes') or
                data.get('notas') or
                data.get('referencia') or
                data.get('observaciones') or
                ''
            )
            distributor_id = (
                data.get('distributor_id') or
                data.get('distribuidor_id') or
                data.get('distributor') or
                data.get('distribuidor') or
                None
            )

            price = data.get('price') or data.get('precio') or None
            estimated_date = data.get('estimated_date') or data.get('fecha_estimada') or None

            return {
                'state': str(state).strip(),
                'municipality': str(municipality).strip(),
                'city': str(city).strip(),
                'address': address_str,
                'coverage': str(coverage).strip(),
                'notes': str(notes).strip(),
                'distributor_id': distributor_id,
                'price': price,
                'estimated_date': estimated_date
            }

        return {
            'state': '',
            'municipality': '',
            'city': '',
            'address': str(data).strip(),
            'coverage': '',
            'notes': '',
            'distributor_id': None
        }
