/**
 * ==========================================================================
 * LÓGICA DE CHECKOUT (REALIZAR COMPRA) - TUESTANTE
 * Maneja autenticación, selects en cascada (Estado -> Municipio -> Ciudad),
 * listado de productos en formato exacto y creación de orden en el backend.
 * ==========================================================================
 */

import { extractList } from '../../js/api.js';
import { crearPedido } from './orders.api.js';
import { obtenerDistribuidores, obtenerDistribuidoresDisponibles } from './shipment.api.js';
import { getAccessToken, getCurrentUser } from '../../js/storage.js';
import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { findMunicipalityForCity } from '../../js/locations.js';

// ============================================================================
// DICCIONARIO DE UBICACIONES DE VENEZUELA (ESTADOS -> MUNICIPIOS -> CIUDADES)
// ============================================================================
const VENEZUELA_LOCATIONS = {
    "Táchira": {
        "San Cristóbal": ["San Cristóbal", "La Concordia", "San Juan Bautista", "Pedro María Morantes", "San Sebastián"],
        "Cárdenas": ["Táriba", "Barrancas", "Amenodoro Rangel Lamús"],
        "Andrés Bello": ["Cordero"],
        "Guásimos": ["Palmira"],
        "Junín": ["Rubio", "Bramón", "La Petrólea", "Quinimarí"],
        "Bolívar": ["San Antonio del Táchira", "Palotal"],
        "Pedro María Ureña": ["Ureña", "Nueva Arcadia"],
        "Ayacucho": ["San Juan de Colón", "San Pedro del Río", "Rivas Berti"],
        "Jáuregui": ["La Grita", "Emilio Constantino Guerrero", "Monseñor Miguel Antonio Salas"],
        "Michelena": ["Michelena"],
        "Lobatera": ["Lobatera", "Borotá"],
        "Panamericano": ["Coloncito", "La Palmita"],
        "Fernández Feo": ["San Rafael del Piñal", "Santo Domingo", "Alberto Adriani"],
        "García de Hevia": ["La Fría", "Boca de Grita", "José Antonio Páez"],
        "Torbes": ["San Josecito"],
        "Córdoba": ["Santa Ana del Táchira"],
        "Libertad": ["Capacho Viejo"],
        "Independencia": ["Capacho Nuevo"],
        "Uribante": ["Pregonero", "Cárdenas", "Potosí"],
        "Samuel Darío Maldonado": ["La Tendida", "Boconó", "Hernández"]
    },
    "Mérida": {
        "Libertador": ["Mérida", "El Sagrario", "Milla", "Osuna Rodríguez", "Spinetti Dini"],
        "Alberto Adriani": ["El Vigía", "Presidente Betancourt", "Rómulo Gallegos", "Gabriel Picón González"],
        "Campo Elías": ["Ejido", "Matriz", "Montalbán", "Fernández Peña"],
        "Tovar": ["Tovar", "El Amparo", "San Francisco"],
        "Rivas Dávila": ["Bailadores", "Geronimo Maldonado"],
        "Sucre": ["Lagunillas", "Chiguará", "Estánquez"],
        "Pueblo Llano": ["Pueblo Llano"],
        "Rangel": ["Mucuchíes", "Cacute", "La Toma", "San Rafael", "Apartaderos"],
        "Santos Marquina": ["Tabay"]
    },
    "Trujillo": {
        "Valera": ["Valera", "La Beatriz", "Mercedes Díaz", "San Luis"],
        "Trujillo": ["Trujillo", "Andrés Linares", "Chiquinquirá", "Monseñor Carrillo"],
        "Boconó": ["Boconó", "El Carmen", "Mosquey", "San José de Tostós"],
        "Carache": ["Carache", "La Concepción", "Cuicas"],
        "Escuque": ["Escuque", "Sabana Libre", "La Unión"],
        "Rafael Rangel": ["Betijoque", "José Gregorio Hernández", "La Pueblita"]
    },
    "Zulia": {
        "Maracaibo": ["Maracaibo", "Chiquinquirá", "Coquivacoa", "Juana de Ávila", "Olegario Villalobos", "San Francisco"],
        "San Francisco": ["San Francisco", "Domitila Flores", "Francisco Ochoa", "Los Cortijos"],
        "Cabimas": ["Cabimas", "Ambrosio", "Carmen Herrera", "Germán Ríos Linares"],
        "Lagunillas": ["Ciudad Ojeda", "Alonso de Ojeda", "Venezuela", "Eleazar López Contreras"],
        "Colón": ["San Carlos del Zulia", "Santa Bárbara"],
        "Mara": ["San Rafael de El Moján", "Ricaurte", "Luis de Vicente"]
    },
    "Barinas": {
        "Barinas": ["Barinas", "Alto Barinas", "Corazón de Jesús", "Rómulo Betancourt", "El Carmen"],
        "Pedraza": ["Ciudad Bolivia", "Ignacio Briceño", "José Félix Ribas"],
        "Antonio José de Sucre": ["Socopó", "Nicolás Pulido", "Andrés Bello"],
        "Alberto Arvelo Torrealba": ["Sabaneta", "Rodríguez Domínguez"],
        "Bolívar": ["Barinitas", "Altamira de Cáceres", "Calderas"]
    },
    "Lara": {
        "Iribarren": ["Barquisimeto", "Catedral", "Concepción", "Santa Rosa", "Unión", "Juan de Villegas"],
        "Palavecino": ["Cabudare", "José Gregorio Bastidas", "Agua Viva"],
        "Torres": ["Carora", "Trinidad Samuel", "Antonio Díaz", "Camacaro"],
        "Morán": ["El Tocuyo", "Bolívar", "Guarico", "Anzoátegui"],
        "Jiménez": ["Quíbor", "Juan Bautista Rodríguez", "Diego de Lozada"]
    },
    "Distrito Capital": {
        "Libertador": ["Caracas", "El Recreo", "Sucre (Catia)", "San Pedro", "Candelaria", "Chacao", "La Pastora", "San Bernardino", "El Valle", "Coche", "Antímano", "Caricuao", "Santa Rosalía"]
    },
    "Miranda": {
        "Chacao": ["Chacao", "Altamira", "Los Palos Grandes", "El Rosal"],
        "Baruta": ["Baruta", "Las Mercedes", "El Cafetal", "Cumbres de Curumo"],
        "Sucre": ["Petare", "Leoncio Martínez", "La Urbina", "Los Dos Caminos"],
        "El Hatillo": ["El Hatillo", "La Lagunita", "El Vivero"],
        "Guaicaipuro": ["Los Teques", "San Pedro", "Cecilio Acosta", "El Jarillo"],
        "Plaza": ["Guarenas"],
        "Zamora": ["Guatire", "Bolívar"],
        "Los Salias": ["San Antonio de los Altos"]
    },
    "Carabobo": {
        "Valencia": ["Valencia", "San José", "El Socorro", "Catedral", "Santa Rosa", "Rafael Urdaneta"],
        "Naguanagua": ["Naguanagua"],
        "San Diego": ["San Diego"],
        "Puerto Cabello": ["Puerto Cabello", "Bartolomé Salóm", "Fraternidad", "Goaigoaza"],
        "Guacara": ["Guacara", "Ciudad Alianza", "Yagua"]
    },
    "Aragua": {
        "Girardot": ["Maracay", "Los Tacarigua", "Andrés Eloy Blanco", "Joaquín Crespo", "Pedro José Ovalles"],
        "Santiago Mariño": ["Turmero", "Samán de Güere", "Alfredo Pacheco Miranda"],
        "José Félix Ribas": ["La Victoria", "Castor Nieves Ríos", "Las Guacamayas"],
        "Mario Briceño Iragorry": ["El Limón", "Caña de Azúcar"],
        "Sucre": ["Cagua", "Bella Vista"]
    },
    "Anzoátegui": {
        "Simón Bolívar": ["Barcelona", "El Carmen", "San Cristóbal", "Bergantín"],
        "Juan Antonio Sotillo": ["Puerto La Cruz", "Pozuelos"],
        "Diego Bautista Urbaneja": ["Lechería", "El Morro"],
        "Guanta": ["Guanta", "Chorrerón"],
        "Anaco": ["Anaco", "San Joaquín"],
        "Simón Rodríguez": ["El Tigre"]
    },
    "Bolívar": {
        "Caroní": ["Ciudad Guayana", "Puerto Ordaz", "San Félix", "Unare", "Universidad", "Dalla Costa"],
        "Angostura del Orinoco": ["Ciudad Bolívar", "Catedral", "Agua Salada", "La Sabanita", "Vista Hermosa"],
        "Piar": ["Upata", "Andrés Eloy Blanco"]
    },
    "Falcón": {
        "Miranda": ["Coro", "San Gabriel", "Santa Ana", "San Antonio"],
        "Carirubana": ["Punto Fijo", "Norte", "Carirubana", "Punta Cardón"],
        "Silva": ["Tucacas", "Boca de Aroa"]
    },
    "Portuguesa": {
        "Páez": ["Acarigua", "Payara", "Pimpinela"],
        "Araure": ["Araure", "Río Acarigua"],
        "Guanare": ["Guanare", "San Juan de Guanaguanare", "Virgen de Coromoto"]
    },
    "Yaracuy": {
        "San Felipe": ["San Felipe", "Albarico", "San Javier"],
        "Independencia": ["Independencia"],
        "Peña": ["Yaritagua", "San Andrés"]
    },
    "Monagas": {
        "Maturín": ["Maturín", "Alto de Los Godos", "Boquerón", "Las Cocuizas", "San Simón"]
    },
    "Sucre": {
        "Sucre": ["Cumaná", "Altagracia", "Santa Inés", "Valentín Valiente"],
        "Bermúdez": ["Carúpano", "Santa Rosa", "Bolívar"]
    },
    "Nueva Esparta": {
        "Mariño": ["Porlamar"],
        "Maneiro": ["Pampatar", "Los Robles"],
        "García": ["El Valle del Espíritu Santo"],
        "Arismendi": ["La Asunción"]
    },
    "Guárico": {
        "Juan Germán Roscio": ["San Juan de los Morros", "Cantagallo", "Parapara"],
        "Leonardo Infante": ["Valle de la Pascua", "Espino"],
        "Francisco de Miranda": ["Calabozo", "El Calvario"]
    },
    "La Guaira": {
        "Vargas": ["La Guaira", "Maiquetía", "Catia La Mar", "Caraballeda", "Macuto", "Naiguatá"]
    },
    "Cojedes": {
        "Ezequiel Zamora": ["San Carlos", "Juan Ángel Bravo", "Manuel Manrique"],
        "Tinaquillo": ["Tinaquillo"]
    },
    "Apure": {
        "San Fernando": ["San Fernando de Apure", "El Recreo", "Peñalver", "San Rafael de Atamaica"],
        "Páez": ["Guasdualito", "Aramendi"]
    },
    "Amazonas": {
        "Atures": ["Puerto Ayacucho", "Fernando Girón Tovar", "Luis Alberto Gómez", "Parhueña"]
    },
    "Delta Amacuro": {
        "Tucupita": ["Tucupita", "San José", "Virgen del Valle", "San Rafael"]
    }
};

/**
 * Obtiene los productos actuales guardados en el Carrito.
 */
function getCartItems() {
    try {
        const stored = localStorage.getItem('tuestante_cart');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Inyecta componentes HTML reutilizables (Navbar / Footer).
 */
async function loadComponent(elementId, filePath) {
    try {
        const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
            const html = await response.text();
            const el = document.getElementById(elementId);
            if (el) el.innerHTML = html;
        }
    } catch (err) {
        console.error(`Error al cargar ${filePath}:`, err);
    }
}

/**
 * Inicializa los Selects de Ubicación en Cascada (Estado -> Municipio -> Ciudad).
 */
function initLocationSelects() {
    const stateSelect = document.getElementById('checkout-state');
    const municipalitySelect = document.getElementById('checkout-municipality');
    const citySelect = document.getElementById('checkout-city');

    if (!stateSelect || !municipalitySelect || !citySelect) return;

    // 1. Llenar Estados
    stateSelect.innerHTML = '<option value="" disabled selected>Selecciona un estado</option>';
    const states = Object.keys(VENEZUELA_LOCATIONS).sort((a, b) => a.localeCompare(b));

    // Si hay un estado previamente seleccionado en localStorage, usarlo como valor inicial sugerido
    const savedState = localStorage.getItem('tuestante_selected_state') || 'Táchira';

    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        if (state === savedState) {
            option.selected = true;
        }
        stateSelect.appendChild(option);
    });

    // 2. Función para actualizar Municipios
    const updateMunicipalities = (selectedState) => {
        municipalitySelect.innerHTML = '<option value="" disabled selected>Selecciona un municipio</option>';
        citySelect.innerHTML = '<option value="" disabled selected>Selecciona una ciudad</option>';
        citySelect.disabled = true;

        if (!selectedState || !VENEZUELA_LOCATIONS[selectedState]) {
            municipalitySelect.disabled = true;
            return;
        }

        const municipalities = Object.keys(VENEZUELA_LOCATIONS[selectedState]).sort((a, b) => a.localeCompare(b));
        municipalities.forEach(mun => {
            const option = document.createElement('option');
            option.value = mun;
            option.textContent = mun;
            municipalitySelect.appendChild(option);
        });

        municipalitySelect.disabled = false;

        // Auto-seleccionar primer municipio si existe
        if (municipalities.length > 0) {
            municipalitySelect.selectedIndex = 1;
            updateCities(selectedState, municipalities[0]);
        }
    };

    // 3. Función para actualizar Ciudades
    const updateCities = (selectedState, selectedMunicipality) => {
        citySelect.innerHTML = '<option value="" disabled selected>Selecciona una ciudad</option>';

        if (!selectedState || !selectedMunicipality || !VENEZUELA_LOCATIONS[selectedState]?.[selectedMunicipality]) {
            citySelect.disabled = true;
            return;
        }

        const cities = VENEZUELA_LOCATIONS[selectedState][selectedMunicipality];
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });

        citySelect.disabled = false;
        if (cities.length > 0) {
            citySelect.selectedIndex = 1;
        }
    };

    // Eventos de cambio
    stateSelect.addEventListener('change', () => {
        updateMunicipalities(stateSelect.value);
        loadProviders(stateSelect.value, municipalitySelect.value);
    });

    municipalitySelect.addEventListener('change', () => {
        updateCities(stateSelect.value, municipalitySelect.value);
        loadProviders(stateSelect.value, municipalitySelect.value);
    });

    // Inicializar cascada con el estado seleccionado
    if (stateSelect.value) {
        updateMunicipalities(stateSelect.value);
        loadProviders(stateSelect.value, municipalitySelect.value);
    } else {
        loadProviders('', '');
    }
}

/**
 * Carga los proveedores de transporte con cobertura geográfica confirmada
 * para el Estado y Municipio seleccionados. Si no hay cobertura, bloquea la opción y avisa al usuario.
 */
async function loadProviders(state = '', municipality = '') {
    const providerSelect = document.getElementById('checkout-provider');
    if (!providerSelect) return;

    providerSelect.innerHTML = '<option value="" disabled selected>Consultando cobertura de envíos...</option>';
    providerSelect.disabled = true;

    try {
        let distributors = [];
        if (state) {
            const response = await obtenerDistribuidoresDisponibles({
                state: state.trim(),
                municipality: municipality ? municipality.trim() : ''
            });
            distributors = Array.isArray(response)
                ? response
                : (Array.isArray(response?.distributors) ? response.distributors : extractList(response));
        } else {
            const response = await obtenerDistribuidores();
            distributors = Array.isArray(response)
                ? response
                : (Array.isArray(response?.distributors) ? response.distributors : extractList(response));
        }

        if (!distributors || distributors.length === 0) {
            providerSelect.innerHTML = '<option value="" disabled selected>Sin cobertura disponible para esta zona</option>';
            providerSelect.disabled = true;
            setFieldError('checkout-provider', `No hay empresas de transporte con cobertura disponible para ${state}${municipality ? `, ${municipality}` : ''}. Por favor elige otra ubicación o contáctanos.`);
            return;
        }

        clearFieldError('checkout-provider');
        providerSelect.disabled = false;
        providerSelect.innerHTML = '<option value="" disabled selected>Selecciona un proveedor de transporte</option>';
        distributors.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.name;
            if (d.id) {
                opt.dataset.distributorId = d.id;
            }
            let detail = '';
            if (d.estimated_days_min && d.estimated_days_max) {
                detail = ` (${d.estimated_days_min}-${d.estimated_days_max} días)`;
            } else if (d.coverage_type === 'national') {
                detail = ' (Nacional)';
            }
            opt.textContent = `${d.name}${detail}`;
            providerSelect.appendChild(opt);
        });

    } catch (err) {
        console.warn('Error al consultar cobertura de distribuidores:', err);
        providerSelect.disabled = false;
        providerSelect.innerHTML = '<option value="" disabled selected>Selecciona un proveedor de transporte</option>';
        const defaultProviders = [
            { id: null, name: "MRW (Nacional)" },
            { id: null, name: "Tealca (Nacional)" },
            { id: null, name: "Zoom (Nacional)" }
        ];
        defaultProviders.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.name;
            opt.textContent = d.name;
            providerSelect.appendChild(opt);
        });
    }
}

/**
 * Renderiza el listado de productos en el formato solicitado:
 * "nombre del producto(color) x n" a la izquierda y "$precio" al otro borde.
 */
function renderCheckoutProducts() {
    const listContainer = document.getElementById('checkout-products-list');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');

    if (!listContainer) return;

    const items = getCartItems();

    if (items.length === 0) {
        window.location.href = '../cart/cart.html';
        return;
    }

    let subtotal = 0;

    listContainer.innerHTML = items.map(item => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.qty, 10) || 1;
        const itemSubtotal = itemPrice * itemQty;
        subtotal += itemSubtotal;

        // Formato requerido: nombre del producto (color) x n
        const formattedTitle = `${item.name} (${item.color || 'Estándar'}) x ${itemQty}`;

        return `
            <div class="checkout-product-item">
                <div class="checkout-product-info">
                    <span class="checkout-product-name-qty">${formattedTitle}</span>
                </div>
                <span class="checkout-product-price">$${itemSubtotal.toFixed(2)}</span>
            </div>
        `;
    }).join('');

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${subtotal.toFixed(2)}`;
}

/**
 * Establece o remueve el mensaje de error visual de un campo específico.
 * @param {string} fieldId ID del elemento input, select o textarea
 * @param {string} message Mensaje de error a mostrar (vacío para limpiar)
 */
function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    const formGroup = field?.closest('.form-group');

    if (errorEl) {
        errorEl.textContent = message || '';
        if (message) {
            errorEl.classList.add('show');
        } else {
            errorEl.classList.remove('show');
        }
    }

    if (formGroup) {
        if (message) {
            formGroup.classList.add('has-error');
        } else {
            formGroup.classList.remove('has-error');
        }
    }

    if (field) {
        if (message) {
            field.classList.add('is-invalid');
            field.setAttribute('aria-invalid', 'true');
        } else {
            field.classList.remove('is-invalid');
            field.removeAttribute('aria-invalid');
        }
    }
}

/**
 * Limpia el error de un campo.
 */
function clearFieldError(fieldId) {
    setFieldError(fieldId, '');
}

/**
 * Limpia todos los errores del formulario.
 */
function clearAllErrors() {
    ['checkout-state', 'checkout-municipality', 'checkout-city', 'checkout-sector', 'checkout-provider', 'checkout-notes'].forEach(id => {
        clearFieldError(id);
    });
}

/**
 * Valida todos los campos del formulario de compra.
 * @returns {{ isValid: boolean, firstInvalidElement: HTMLElement | null }}
 */
function validateCheckoutForm() {
    clearAllErrors();

    let isValid = true;
    let firstInvalidElement = null;

    const stateEl = document.getElementById('checkout-state');
    const municipalityEl = document.getElementById('checkout-municipality');
    const cityEl = document.getElementById('checkout-city');
    const sectorEl = document.getElementById('checkout-sector');
    const providerEl = document.getElementById('checkout-provider');
    const notesEl = document.getElementById('checkout-notes');

    const state = stateEl?.value?.trim();
    const municipality = municipalityEl?.value?.trim();
    const city = cityEl?.value?.trim();
    const sector = sectorEl?.value?.trim();
    const provider = providerEl?.value?.trim();
    const notes = notesEl?.value?.trim() || '';

    // 1. Validar Estado
    if (!state) {
        setFieldError('checkout-state', 'Por favor selecciona un Estado para la entrega.');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = stateEl;
    }

    // 2. Validar Municipio
    if (!municipality) {
        setFieldError('checkout-municipality', 'Por favor selecciona un Municipio.');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = municipalityEl;
    }

    // 3. Validar Ciudad / Localidad
    if (!city) {
        setFieldError('checkout-city', 'Por favor selecciona una Ciudad o Localidad.');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = cityEl;
    }

    // 4. Validar Sector / Dirección Exacta
    if (!sector) {
        setFieldError('checkout-sector', 'La dirección exacta o sector de entrega es obligatorio.');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = sectorEl;
    } else if (sector.length < 8) {
        setFieldError('checkout-sector', 'Ingresa una dirección más detallada (mínimo 8 caracteres, ej: calle, avenida, casa o edificio).');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = sectorEl;
    } else if (sector.length > 255) {
        setFieldError('checkout-sector', 'La dirección no debe exceder los 255 caracteres.');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = sectorEl;
    }

    // 5. Validar Proveedor de Envío y Cobertura
    if (!provider || providerEl?.disabled) {
        setFieldError('checkout-provider', 'Debes seleccionar un transportista con cobertura disponible para tu zona.');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = providerEl;
    }

    // 6. Validar Observaciones (opcional pero con límite)
    if (notes && notes.length > 500) {
        setFieldError('checkout-notes', 'Las notas u observaciones no deben superar los 500 caracteres.');
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = notesEl;
    }

    return { isValid, firstInvalidElement };
}

/**
 * Configura los eventos para limpiar errores en tiempo real al escribir o seleccionar.
 */
function setupRealtimeValidation() {
    const fields = [
        { id: 'checkout-state', event: 'change' },
        { id: 'checkout-municipality', event: 'change' },
        { id: 'checkout-city', event: 'change' },
        { id: 'checkout-sector', event: 'input' },
        { id: 'checkout-provider', event: 'change' },
        { id: 'checkout-notes', event: 'input' }
    ];

    fields.forEach(({ id, event }) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, () => {
                clearFieldError(id);
            });
        }
    });

    // Si cambia el estado, limpiar también errores de municipio y ciudad
    const stateEl = document.getElementById('checkout-state');
    if (stateEl) {
        stateEl.addEventListener('change', () => {
            clearFieldError('checkout-municipality');
            clearFieldError('checkout-city');
        });
    }

    const municipalityEl = document.getElementById('checkout-municipality');
    if (municipalityEl) {
        municipalityEl.addEventListener('change', () => {
            clearFieldError('checkout-city');
        });
    }
}

/**
 * Procesa la confirmación del pedido y lo envía al Backend de Django.
 */
async function handleConfirmOrder() {
    const btnConfirm = document.getElementById('btn-confirmar-compra');

    // 1. Ejecutar validaciones del formulario
    const { isValid, firstInvalidElement } = validateCheckoutForm();
    if (!isValid) {
        if (firstInvalidElement) {
            firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalidElement.focus();
        }
        return;
    }

    const state = document.getElementById('checkout-state')?.value;
    const municipality = document.getElementById('checkout-municipality')?.value;
    const city = document.getElementById('checkout-city')?.value;
    const sector = document.getElementById('checkout-sector')?.value?.trim();
    const provider = document.getElementById('checkout-provider')?.value;
    const notes = document.getElementById('checkout-notes')?.value?.trim() || '';

    const items = getCartItems();
    if (items.length === 0) {
        alert('No hay productos en tu pedido.');
        window.location.href = '../cart/cart.html';
        return;
    }

    // 2. Preparar payload con orden y envío incluidos para la API de Django (/orders/)
    const providerSelect = document.getElementById('checkout-provider');
    const selectedOpt = providerSelect?.options[providerSelect.selectedIndex];
    const distributorId = selectedOpt?.dataset?.distributorId ? parseInt(selectedOpt.dataset.distributorId, 10) : null;

    const shipmentData = {
        state: state,
        municipality: municipality,
        city: city,
        address: sector,
        notes: notes ? `${notes} (Transporte: ${provider})` : `Transporte: ${provider}`
    };

    if (distributorId) {
        shipmentData.distributor_id = distributorId;
    }

    const orderPayload = {
        notes: notes || `Envío a: ${city}, ${state} vía ${provider}`,
        items: items.map(item => ({
            product_id: parseInt(item.id, 10),
            quantity: parseInt(item.qty, 10) || 1,
            notes: item.color ? `Color: ${item.color}` : "Color: Estándar"
        })),
        shipment: shipmentData
    };

    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = `
            <svg class="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
            Procesando Pedido...
        `;
    }

    try {
        // 3. Crear Pedido y Envío en una sola petición atómica al Backend
        const orderResponse = await crearPedido(orderPayload);
        const orderId = orderResponse?.id;

        // 5. Limpiar carrito de compras
        localStorage.setItem('tuestante_cart', JSON.stringify([]));
        window.dispatchEvent(new Event('cart-updated'));

        // 6. Redirigir a la pantalla del pedido con indicador de nuevo registro
        const targetUrl = orderId ? `order-details.html?id=${orderId}&new=1` : `order-details.html`;
        window.location.href = targetUrl;

    } catch (error) {
        console.error('Error al registrar el pedido:', error);
        alert(error?.data?.error || error?.message || 'Ocurrió un error al procesar tu pedido. Por favor intenta de nuevo.');

        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Confirmar Compra
            `;
        }
    }
}

/**
 * Configura la opción de "Usar mi dirección registrada / por defecto".
 * Si el usuario autenticado tiene estado, ciudad o dirección configurados en su perfil,
 * muestra la tarjeta y, al seleccionarla, autorellena los campos del formulario.
 */
async function setupDefaultAddressOption() {
    const container = document.getElementById('default-address-card');
    const checkbox = document.getElementById('checkout-use-default-address');
    const previewText = document.getElementById('default-address-text');
    if (!container || !checkbox || !previewText) return;

    let user = getCurrentUser();

    // Intentar sincronizar con la API para traer la información más reciente de perfil
    try {
        const { fetchProfileFromAPI } = await import('../profile/profile.api.js');
        const freshUser = await fetchProfileFromAPI();
        if (freshUser) {
            user = freshUser;
        }
    } catch (e) {
        console.warn('No se pudo refrescar perfil en checkout, usando datos locales:', e);
    }

    if (!user) return;

    const userState = (user.state || '').trim();
    const userCity = (user.city || '').trim();
    const userAddress = (user.address || '').trim();

    // Si el usuario no tiene ningún dato de dirección, no mostramos la opción
    if (!userState && !userCity && !userAddress) {
        container.style.display = 'none';
        return;
    }

    // Formatear resumen
    const parts = [];
    if (userState) parts.push(userState);
    if (userCity) parts.push(userCity);
    if (userAddress) parts.push(userAddress);
    previewText.textContent = parts.join(' — ');
    container.style.display = 'block';

    // Función para rellenar los inputs con los datos del perfil
    const applyDefaultAddress = () => {
        const stateSelect = document.getElementById('checkout-state');
        const municipalitySelect = document.getElementById('checkout-municipality');
        const citySelect = document.getElementById('checkout-city');
        const sectorInput = document.getElementById('checkout-sector');

        if (userState && stateSelect) {
            // Buscar coincidencia exacta o insensible a mayúsculas/acentos
            const options = Array.from(stateSelect.options);
            const match = options.find(opt => opt.value.localeCompare(userState, undefined, { sensitivity: 'base' }) === 0);
            if (match) {
                stateSelect.value = match.value;
            } else {
                stateSelect.value = userState;
            }

            // Disparar cambio de estado para actualizar municipios
            stateSelect.dispatchEvent(new Event('change'));

            // Determinar municipio para la ciudad
            if (municipalitySelect && userCity) {
                const matchedMun = findMunicipalityForCity(stateSelect.value, userCity);
                if (matchedMun) {
                    municipalitySelect.value = matchedMun;
                    municipalitySelect.dispatchEvent(new Event('change'));

                    // Seleccionar ciudad
                    if (citySelect) {
                        const cityOptions = Array.from(citySelect.options);
                        const matchCity = cityOptions.find(opt => opt.value.localeCompare(userCity, undefined, { sensitivity: 'base' }) === 0);
                        if (matchCity) {
                            citySelect.value = matchCity.value;
                        }
                    }
                }
            }
        }

        if (userAddress && sectorInput) {
            sectorInput.value = userAddress;
        }

        // Limpiar errores previos si los hubiera
        clearAllErrors();
    };

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            applyDefaultAddress();
        }
    });

    // Si el usuario tiene dirección completa guardada, auto-seleccionar por defecto
    if (userState || userCity || userAddress) {
        checkbox.checked = true;
        applyDefaultAddress();
    }
}

// ============================================================================
// INICIALIZACIÓN DE LA PÁGINA
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificación de Autenticación:
    // Si no está registrado/logueado, redirigir al login guardando la ruta actual
    const token = getAccessToken();
    if (!token) {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `../auth/login.html?redirect=${encodeURIComponent(currentPath)}`;
        return;
    }

    // 2. Verificar que haya productos en el carrito
    const items = getCartItems();
    if (items.length === 0) {
        window.location.href = '../cart/cart.html';
        return;
    }

    // 3. Cargar Componentes Comunes
    await loadComponent('navbar-placeholder', '../../components/navbar/navbar.html');
    initNavbar();

    await loadComponent('footer-placeholder', '../../components/footer/footer.html');
    initFooter();

    // 4. Cargar datos de ubicación, productos y cobertura de proveedores
    initLocationSelects();
    await setupDefaultAddressOption();
    renderCheckoutProducts();

    // 5. Configurar validación en tiempo real (limpieza de errores al escribir)
    setupRealtimeValidation();

    // 6. Asignar evento al botón Confirmar Compra
    const btnConfirm = document.getElementById('btn-confirmar-compra');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', handleConfirmOrder);
    }
});
