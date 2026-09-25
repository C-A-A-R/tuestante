/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE FABRICACIÓN (TALLER) - TUESTANTE
 * Comunicación con endpoints Django para el seguimiento de órdenes de producción.
 * Utiliza cliente centralizado desde js/api.js con contingencia de datos mock.
 * ==========================================================================
 */

import { getRequest, postRequest, resolveImageUrl } from '../../js/api.js';

/**
 * Resuelve la URL de imagen del producto buscando en todos los campos disponibles
 * y convirtiendo rutas relativas a URLs absolutas del backend.
 * @param {Object|string} prodOrUrl
 * @returns {string}
 */
export function getProductImageUrl(prodOrUrl) {
  if (!prodOrUrl) return '../../assets/images/logo.jpeg';
  if (typeof prodOrUrl === 'string') return resolveImageUrl(prodOrUrl, '../../assets/images/logo.jpeg');
  const raw = prodOrUrl.product_image
    || prodOrUrl.image
    || prodOrUrl.image_url
    || (Array.isArray(prodOrUrl.color_images) && prodOrUrl.color_images.length > 0 ? (prodOrUrl.color_images[0].color_image || prodOrUrl.color_images[0].image) : null)
    || (Array.isArray(prodOrUrl.angle_images) && prodOrUrl.angle_images.length > 0 ? prodOrUrl.angle_images[0].image : null)
    || prodOrUrl.product_type_detail?.product_type_image
    || prodOrUrl.product_type?.product_type_image
    || '';
  return raw ? resolveImageUrl(raw, '../../assets/images/logo.jpeg') : '../../assets/images/logo.jpeg';
}

/**
 * Mapeo oficial de fases de fabricación conforme a Backend/apps/production/models.py
 */
export const PRODUCTION_STAGES = [
  { id: 'queued', label: 'En cola de espera', badgeClass: 'badge-stage-queued', order: 1 },
  { id: 'assembling', label: 'En corte y ensamblaje', badgeClass: 'badge-stage-assembling', order: 2 },
  { id: 'painting', label: 'En pintura y acabado', badgeClass: 'badge-stage-painting', order: 3 },
  { id: 'quality_check', label: 'En control de calidad', badgeClass: 'badge-stage-quality', order: 4 },
  { id: 'completed', label: 'Fabricación completada', badgeClass: 'badge-stage-completed', order: 5 }
];

/**
 * Obtiene la configuración de una fase de producción
 */
export function getStageConfig(statusKey) {
  return PRODUCTION_STAGES.find(s => s.id === statusKey) || {
    id: statusKey,
    label: statusKey,
    badgeClass: 'badge-stage-queued',
    order: 0
  };
}

// ==========================================================================
// ==========================================================================
// GENERADOR DE PLANO TÉCNICO SVG VECTORIAL (ESTÁNDAR ARQUITECTÓNICO TUESTANTE)
// ==========================================================================

export function generateMockBlueprintSVG(technicalDesign = {}, title = "PLANO TÉCNICO DE FABRICACIÓN") {
  const dims = technicalDesign.dimensions_mm || { height: 1800, width: 900, depth: 400 };
  const height_mm = dims.height || 1800;
  const width_mm = dims.width || 900;
  const depth_mm = dims.depth || 400;

  const grid = technicalDesign.grid || { rows: 3, columns: 1 };
  const rows = Math.max(1, grid.rows || 1);
  const cols = Math.max(1, grid.columns || 1);

  const main_color = technicalDesign.main_color || '#005187';
  const prod_name = technicalDesign.product_name || 'Estantería Modular';
  const furniture_type = technicalDesign.furniture_type || 'Estante Metálico';
  const compartments = technicalDesign.compartments || [];

  const comp_map = {};
  compartments.forEach(comp => {
    const r = comp.row || 1;
    const c = comp.col || 1;
    comp_map[`${r}_${c}`] = comp;
  });

  const canvas_w = 800;
  const canvas_h = 950;
  const margin_left = 140;
  const margin_top = 110;
  const available_w = 520;
  const available_h = 660;

  const aspect_ratio = width_mm / Math.max(1, height_mm);
  let cab_w, cab_h;
  if (aspect_ratio > (available_w / available_h)) {
    cab_w = available_w;
    cab_h = available_w / aspect_ratio;
  } else {
    cab_h = available_h;
    cab_w = available_h * aspect_ratio;
  }

  const cab_x = margin_left + (available_w - cab_w) / 2;
  const cab_y = margin_top + (available_h - cab_h) / 2;
  const cell_w = cab_w / cols;
  const cell_h = cab_h / rows;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas_w} ${canvas_h}" width="100%" height="100%" style="background-color: #0F172A; font-family: Inter, system-ui, -apple-system, sans-serif;">`);
  
  parts.push(`
    <defs>
      <marker id="arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 10 0 L 0 5 L 10 10 z" fill="#38BDF8" />
      </marker>
      <marker id="arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#38BDF8" />
      </marker>
      <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="none" stroke="#1E293B" stroke-width="0.5" />
      </pattern>
    </defs>
    <rect width="${canvas_w}" height="${canvas_h}" fill="url(#grid-pattern)" />
  `);

  parts.push(`
    <rect x="25" y="20" width="${canvas_w - 50}" height="60" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1.5" />
    <text x="45" y="46" fill="#F8FAFC" font-size="16" font-weight="700" letter-spacing="1">${title.toUpperCase()}</text>
    <text x="45" y="66" fill="#94A3B8" font-size="13">${prod_name} | ${furniture_type}</text>
    <rect x="${canvas_w - 225}" y="32" width="190" height="36" rx="4" fill="#0F172A" stroke="#38BDF8" stroke-width="1" />
    <text x="${canvas_w - 130}" y="55" fill="#38BDF8" font-size="12" font-weight="600" text-anchor="middle">ESPECIFICACIÓN OFICIAL</text>
  `);

  const wall_thick = Math.max(3.0, Math.min(8.0, cab_w * 0.02));
  parts.push(`
    <rect x="${cab_x + 6}" y="${cab_y + 6}" width="${cab_w}" height="${cab_h}" rx="4" fill="#000000" opacity="0.4" />
    <rect x="${cab_x}" y="${cab_y}" width="${cab_w}" height="${cab_h}" rx="4" fill="#182234" stroke="${main_color}" stroke-width="${wall_thick}" />
  `);

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const cx = cab_x + (c - 1) * cell_w;
      const cy = cab_y + (r - 1) * cell_h;
      const comp = comp_map[`${r}_${c}`] || { has_door: false, door_color: main_color, has_ventilation: false };

      const has_door = comp.has_door || false;
      const door_color = comp.door_color || main_color;
      const has_vent = comp.has_ventilation || false;

      parts.push(`<rect x="${cx + 1.5}" y="${cy + 1.5}" width="${cell_w - 3}" height="${cell_h - 3}" fill="#0F172A" stroke="${main_color}" stroke-width="1.5" opacity="0.9" />`);

      if (has_door) {
        parts.push(`<rect x="${cx + 3}" y="${cy + 3}" width="${cell_w - 6}" height="${cell_h - 6}" rx="3" fill="${door_color}" stroke="#0F172A" stroke-width="2" opacity="0.92" />`);
        const handle_x = c % 2 === 1 ? cx + cell_w - 14 : cx + 14;
        const handle_y = cy + (cell_h / 2);
        parts.push(`<circle cx="${handle_x}" cy="${handle_y}" r="3.5" fill="#E2E8F0" stroke="#475569" stroke-width="1" />`);
      }

      if (has_vent) {
        const vent_w = Math.min(cell_w * 0.5, 40);
        const vent_x = cx + (cell_w - vent_w) / 2;
        for (let v_i = 0; v_i < 3; v_i++) {
          const vy = cy + 12 + (v_i * 4);
          parts.push(`<line x1="${vent_x}" y1="${vy}" x2="${vent_x + vent_w}" y2="${vy}" stroke="#0F172A" stroke-width="1.5" stroke-linecap="round" />`);
        }
      }

      parts.push(`<text x="${cx + 6}" y="${cy + 14}" fill="#64748B" font-size="9" font-family="monospace">R${r}C${c}</text>`);
    }
  }

  const cota_top_y = cab_y - 35;
  parts.push(`
    <line x1="${cab_x}" y1="${cab_y - 5}" x2="${cab_x}" y2="${cota_top_y - 10}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
    <line x1="${cab_x + cab_w}" y1="${cab_y - 5}" x2="${cab_x + cab_w}" y2="${cota_top_y - 10}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
    <line x1="${cab_x + 8}" y1="${cota_top_y}" x2="${cab_x + cab_w - 8}" y2="${cota_top_y}" stroke="#38BDF8" stroke-width="1.5" marker-start="url(#arrow-start)" marker-end="url(#arrow-end)" />
    <rect x="${cab_x + (cab_w / 2) - 55}" y="${cota_top_y - 12}" width="110" height="22" rx="3" fill="#0F172A" stroke="#38BDF8" stroke-width="1" />
    <text x="${cab_x + (cab_w / 2)}" y="${cota_top_y + 3}" fill="#38BDF8" font-size="12" font-weight="700" text-anchor="middle">ANCHO ${width_mm} mm</text>
  `);

  const cota_left_x = cab_x - 45;
  parts.push(`
    <line x1="${cab_x - 5}" y1="${cab_y}" x2="${cota_left_x - 10}" y2="${cab_y}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
    <line x1="${cab_x - 5}" y1="${cab_y + cab_h}" x2="${cota_left_x - 10}" y2="${cab_y + cab_h}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
    <line x1="${cota_left_x}" y1="${cab_y + 8}" x2="${cota_left_x}" y2="${cab_y + cab_h - 8}" stroke="#38BDF8" stroke-width="1.5" marker-start="url(#arrow-start)" marker-end="url(#arrow-end)" />
    <g transform="translate(${cota_left_x}, ${cab_y + (cab_h / 2)}) rotate(-90)">
      <rect x="-60" y="-12" width="120" height="22" rx="3" fill="#0F172A" stroke="#38BDF8" stroke-width="1" />
      <text x="0" y="3" fill="#38BDF8" font-size="12" font-weight="700" text-anchor="middle">ALTO ${height_mm} mm</text>
    </g>
  `);

  const footer_y = canvas_h - 95;
  parts.push(`
    <rect x="25" y="${footer_y}" width="${canvas_w - 50}" height="75" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
    <text x="45" y="${footer_y + 26}" fill="#94A3B8" font-size="11" font-weight="600">PROFUNDIDAD (FONDO):</text>
    <text x="190" y="${footer_y + 26}" fill="#F8FAFC" font-size="12" font-weight="700">${depth_mm} mm</text>
    <text x="320" y="${footer_y + 26}" fill="#94A3B8" font-size="11" font-weight="600">DISTRIBUCIÓN:</text>
    <text x="415" y="${footer_y + 26}" fill="#F8FAFC" font-size="12" font-weight="700">${rows} Filas × ${cols} Columnas (${rows * cols} Casillas)</text>
    <text x="45" y="${footer_y + 55}" fill="#94A3B8" font-size="11" font-weight="600">COLOR ESTRUCTURAL:</text>
    <rect x="190" y="${footer_y + 43}" width="16" height="16" rx="2" fill="${main_color}" stroke="#CBD5E1" stroke-width="1" />
    <text x="215" y="${footer_y + 56}" fill="#F8FAFC" font-size="12" font-weight="700">${main_color}</text>
    <text x="320" y="${footer_y + 55}" fill="#94A3B8" font-size="11" font-weight="600">TOLERANCIA TALLER:</text>
    <text x="445" y="${footer_y + 55}" fill="#10B981" font-size="12" font-weight="700">± 1.5 mm (Norma TuEstante)</text>
    </svg>
  `);

  return parts.join('\n');
}

// Diseños paramétricos mock para visualización y pruebas inmediatas
const mockDesign1 = {
  product_name: "Estante Modular Industrial Modelo A",
  furniture_type: "Estante Metálico Ranurado",
  dimensions_mm: { height: 1800, width: 900, depth: 400 },
  grid: { rows: 4, columns: 2 },
  main_color: "#005187",
  compartments: [
    { row: 1, col: 1, has_door: false },
    { row: 1, col: 2, has_door: false },
    { row: 2, col: 1, has_door: false },
    { row: 2, col: 2, has_door: false },
    { row: 3, col: 1, has_door: true, door_color: "#4D82BC" },
    { row: 3, col: 2, has_door: true, door_color: "#4D82BC" },
    { row: 4, col: 1, has_door: true, door_color: "#005187" },
    { row: 4, col: 2, has_door: true, door_color: "#005187" }
  ]
};

const mockDesign2 = {
  product_name: "Casillero Locker de Taller",
  furniture_type: "Locker Metálico con Ventilación",
  dimensions_mm: { height: 1900, width: 600, depth: 450 },
  grid: { rows: 3, columns: 2 },
  main_color: "#334155",
  compartments: [
    { row: 1, col: 1, has_door: true, door_color: "#005187", has_ventilation: true },
    { row: 1, col: 2, has_door: true, door_color: "#005187", has_ventilation: true },
    { row: 2, col: 1, has_door: true, door_color: "#005187", has_ventilation: true },
    { row: 2, col: 2, has_door: true, door_color: "#005187", has_ventilation: true },
    { row: 3, col: 1, has_door: true, door_color: "#4D82BC", has_ventilation: true },
    { row: 3, col: 2, has_door: true, door_color: "#4D82BC", has_ventilation: true }
  ]
};

// ==========================================================================
// BANCO DE DATOS MOCK DE CONTINGENCIA (EN CASO DE FALLO DE RED O MODO LOCAL)
// ==========================================================================

let mockProductionOrders = [
  {
    id: 1,
    order_id: 125,
    order_number: "#00125",
    production_code: "OF-00018",
    iteration: 1,
    client_name: "Juan Pérez",
    client_phone: "+58 412 876 5432",
    status: "assembling",
    status_display: "En corte y ensamblaje",
    start_date: "2026-08-31T11:00:00Z",
    estimated_completion_date: "2026-09-05T18:00:00Z",
    actual_completion_date: null,
    technical_notes: "Corte biselado en esquinas superiores. Verificar espesor de melamina de 18mm.",
    technical_design: mockDesign1,
    blueprint_svg: generateMockBlueprintSVG(mockDesign1, "PLANO OFICIAL DE FABRICACIÓN - OF-00018"),
    created_at: "2026-08-31T11:00:00Z",
    items: [
      {
        product_id: 1,
        product_name: "Estante Modelo A",
        sku: "EST-A-MAD",
        image: "../../assets/images/logo.jpeg",
        specs: "Madera Natural • Barniz mate especial",
        quantity: 2,
        notes: "Refuerzo extra en panel trasero"
      },
      {
        product_id: 2,
        product_name: "Accesorio X",
        sku: "ACC-X-01",
        image: "../../assets/images/logo.jpeg",
        specs: "Color: Negro mate • Metal reforzado",
        quantity: 2,
        notes: "Pintura electrostática"
      }
    ]
  },
  {
    id: 2,
    order_id: 124,
    order_number: "#00124",
    production_code: "OF-00017",
    iteration: 1,
    client_name: "María López",
    client_phone: "+58 414 123 4567",
    status: "assembling",
    status_display: "En corte y ensamblaje",
    start_date: "2026-08-31T09:00:00Z",
    estimated_completion_date: "2026-09-02T17:00:00Z",
    actual_completion_date: null,
    technical_notes: "Acabado en negro satinado. Bisagras de cierre suave requeridas.",
    technical_design: mockDesign2,
    blueprint_svg: generateMockBlueprintSVG(mockDesign2, "PLANO OFICIAL DE FABRICACIÓN - OF-00017"),
    created_at: "2026-08-31T09:00:00Z",
    items: [
      {
        product_id: 3,
        product_name: "Accesorio X",
        sku: "ACC-X-01",
        image: "../../assets/images/logo.jpeg",
        specs: "Color: Negro • Perfiles de aluminio",
        quantity: 1,
        notes: "Tornillería negra incluida"
      }
    ]
  },
  {
    id: 3,
    order_id: 123,
    order_number: "#00123",
    production_code: "OF-00016",
    iteration: 1,
    client_name: "Pedro Díaz",
    client_phone: "+58 424 999 8877",
    status: "painting",
    status_display: "En pintura y acabado",
    start_date: "2026-08-30T14:30:00Z",
    estimated_completion_date: "2026-09-04T12:00:00Z",
    actual_completion_date: null,
    technical_notes: "Aplicar 3 capas de laca blanca con secado UV intermedio.",
    created_at: "2026-08-30T14:30:00Z",
    items: [
      {
        product_id: 4,
        product_name: "Estante Modelo B",
        sku: "EST-B-BLAN",
        image: "../../assets/images/logo.jpeg",
        specs: "Color: Blanco brillante • 120x60cm",
        quantity: 3,
        notes: "Canteado en PVC de 2mm"
      }
    ]
  },
  {
    id: 4,
    order_id: 122,
    order_number: "#00122",
    production_code: "OF-00015",
    iteration: 1,
    client_name: "Ana Torres",
    client_phone: "+58 416 333 2211",
    status: "quality_check",
    status_display: "En control de calidad",
    start_date: "2026-08-30T10:15:00Z",
    estimated_completion_date: "2026-09-03T16:00:00Z",
    actual_completion_date: null,
    technical_notes: "Revisar nivelación de patas y ajuste de pernos.",
    created_at: "2026-08-30T10:15:00Z",
    items: [
      {
        product_id: 5,
        product_name: "Mesa Modelo M",
        sku: "MES-M-MAD",
        image: "../../assets/images/logo.jpeg",
        specs: "Madera Natural • Acabado poro abierto",
        quantity: 1,
        notes: "Tratamiento anti-humedad en base"
      }
    ]
  },
  {
    id: 5,
    order_id: 121,
    order_number: "#00121",
    production_code: "OF-00014",
    iteration: 1,
    client_name: "Luis Ramírez",
    client_phone: "+58 412 555 6677",
    status: "queued",
    status_display: "En cola de espera",
    start_date: null,
    estimated_completion_date: "2026-09-08T18:00:00Z",
    actual_completion_date: null,
    technical_notes: "En espera de corte tras aprobación de comprobante.",
    created_at: "2026-08-30T08:45:00Z",
    items: [
      {
        product_id: 6,
        product_name: "Kit Tornillos Premium",
        sku: "KIT-TP-01",
        image: "../../assets/images/logo.jpeg",
        specs: "Color: Plateado cincado • Paquete x50",
        quantity: 5,
        notes: "Embalaje plástico sellado"
      }
    ]
  },
  {
    id: 6,
    order_id: 120,
    order_number: "#00120",
    production_code: "OF-00013",
    iteration: 2,
    client_name: "Carlos Gómez",
    client_phone: "+58 414 777 8899",
    status: "assembling",
    status_display: "En corte y ensamblaje",
    start_date: "2026-08-29T11:00:00Z",
    estimated_completion_date: "2026-09-04T15:00:00Z",
    actual_completion_date: null,
    technical_notes: "Refabricación por ajuste de medidas solicitado por el cliente.",
    created_at: "2026-08-29T11:00:00Z",
    items: [
      {
        product_id: 7,
        product_name: "Librero Flotante Nórdico",
        sku: "LIB-FL-02",
        image: "../../assets/images/logo.jpeg",
        specs: "Madera Haya • 90x25x30cm",
        quantity: 2,
        notes: "Herrajes invisibles reforzados"
      }
    ]
  },
  {
    id: 7,
    order_id: 119,
    order_number: "#00119",
    production_code: "OF-00012",
    iteration: 1,
    client_name: "Gabriela Salazar",
    client_phone: "+58 424 111 2233",
    status: "completed",
    status_display: "Fabricación completada",
    start_date: "2026-08-27T08:00:00Z",
    estimated_completion_date: "2026-09-01T17:00:00Z",
    actual_completion_date: "2026-09-01T16:30:00Z",
    technical_notes: "Fabricación concluida satisfactoriamente. Lista para entrega.",
    created_at: "2026-08-27T08:00:00Z",
    items: [
      {
        product_id: 8,
        product_name: "Escritorio Minimalista Roble",
        sku: "ESC-MIN-01",
        image: "../../assets/images/logo.jpeg",
        specs: "Roble americano • 140x60cm",
        quantity: 1,
        notes: "Pasa-cables metálico central"
      }
    ]
  },
  {
    id: 8,
    order_id: 118,
    order_number: "#00118",
    production_code: "OF-00011",
    iteration: 1,
    client_name: "Roberto Méndez",
    client_phone: "+58 412 000 1122",
    status: "queued",
    status_display: "En cola de espera",
    start_date: null,
    estimated_completion_date: "2026-09-09T18:00:00Z",
    actual_completion_date: null,
    technical_notes: "Esperando lote de herrajes dorados.",
    created_at: "2026-08-29T16:20:00Z",
    items: [
      {
        product_id: 9,
        product_name: "Módulo TV Flotante",
        sku: "MOD-TV-03",
        image: "../../assets/images/logo.jpeg",
        specs: "Negro mate con madera de nogal • 180cm",
        quantity: 1,
        notes: "Puertas con sistema push to open"
      }
    ]
  }
];

// ==========================================================================
// FUNCIONES DE CONSUMO DE ENDPOINTS
// ==========================================================================

/**
 * Consulta el listado de Órdenes de Fabricación
 * @param {Object} [params] Filtros opcionales (search, status, order_id, date_from, date_to)
 */
export async function getProductionOrders(params = {}) {
  try {
    const queryParams = {};
    if (params.search) queryParams.search = params.search;
    if (params.status && params.status !== 'all') queryParams.status = params.status;
    if (params.order_id) queryParams.order_id = params.order_id;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;

    const res = await getRequest('/production-orders/', queryParams, { auth: true });
    
    if (res && (Array.isArray(res) || Array.isArray(res.results))) {
      const data = Array.isArray(res) ? res : res.results;
      return data.map(item => normalizeBackendProductionOrder(item));
    }
  } catch (err) {
    console.warn('[TuEstante Production API] Error en petición backend, usando datos mock:', err);
  }

  // Filtrado local sobre los mocks
  let result = [...mockProductionOrders];

  if (params.search) {
    const q = params.search.toLowerCase().trim();
    result = result.filter(o => 
      (o.production_code && o.production_code.toLowerCase().includes(q)) ||
      (o.order_number && o.order_number.toLowerCase().includes(q)) ||
      (o.client_name && o.client_name.toLowerCase().includes(q)) ||
      (o.items && o.items.some(it => it.product_name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)))
    );
  }

  if (params.status && params.status !== 'all') {
    result = result.filter(o => o.status === params.status);
  }

  if (params.date_from) {
    result = result.filter(o => {
      const d = o.start_date || o.created_at;
      return d && d >= params.date_from;
    });
  }

  if (params.date_to) {
    result = result.filter(o => {
      const d = o.start_date || o.created_at;
      return d && d <= params.date_to + 'T23:59:59Z';
    });
  }

  return result;
}

/**
 * Consulta la lista aplanada de Productos individuales en fabricación (Vista 1)
 */
export async function getProductionProducts(params = {}) {
  const orders = await getProductionOrders(params);
  const productsList = [];

  orders.forEach(order => {
    (order.items || []).forEach((item, idx) => {
      productsList.push({
        id: `${order.id}-${idx}`,
        order_id: order.order_id,
        order_number: order.order_number,
        production_order_id: order.id,
        production_code: order.production_code,
        iteration: order.iteration,
        client_name: order.client_name,
        client_phone: order.client_phone,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        image: getProductImageUrl(item.image),
        specs: item.specs || '',
        notes: item.notes || order.technical_notes || '',
        quantity: item.quantity,
        status: order.status,
        status_display: order.status_display,
        order_status: order.order_status,
        start_date: order.start_date,
        estimated_completion_date: order.estimated_completion_date,
        actual_completion_date: order.actual_completion_date
      });
    });
  });

  return productsList;
}

/**
 * Consulta una orden de fabricación por ID
 */
export async function getProductionOrder(id) {
  try {
    const res = await getRequest(`/production-orders/${id}/`, {}, { auth: true });
    if (res && res.id) {
      return normalizeBackendProductionOrder(res);
    }
  } catch (err) {
    console.warn(`[TuEstante Production API] Error al consultar orden #${id}, usando mock:`, err);
  }

  const found = mockProductionOrders.find(o => o.id === parseInt(id, 10));
  if (found) return found;
  throw new Error(`Orden de producción #${id} no encontrada.`);
}

/**
 * Avanza automáticamente la orden de producción a su siguiente fase
 */
export async function advanceProductionOrderStage(id) {
  try {
    const res = await postRequest(`/production-orders/${id}/advance_stage/`, {}, { auth: true });
    if (res && res.production_order) {
      return normalizeBackendProductionOrder(res.production_order);
    }
  } catch (err) {
    console.warn(`[TuEstante Production API] Error en advance_stage endpoint, aplicando en memoria mock:`, err);
  }

  const stagesFlow = ['queued', 'assembling', 'painting', 'quality_check', 'completed'];
  const order = mockProductionOrders.find(o => o.id === parseInt(id, 10));
  if (!order) throw new Error(`Orden #${id} no encontrada.`);

  const currentIdx = stagesFlow.indexOf(order.status);
  if (currentIdx < stagesFlow.length - 1) {
    const nextStage = stagesFlow[currentIdx + 1];
    order.status = nextStage;
    order.status_display = getStageConfig(nextStage).label;
    if (!order.start_date && nextStage !== 'queued') {
      order.start_date = new Date().toISOString();
    }
    if (nextStage === 'completed') {
      order.actual_completion_date = new Date().toISOString();
    }
    return order;
  }

  throw new Error('La orden ya se encuentra en su fase final (Fabricación completada).');
}

/**
 * Actualiza el estado y notas técnicas de una orden de producción
 */
export async function updateProductionOrderStatus(id, data = {}) {
  try {
    const res = await postRequest(`/production-orders/${id}/update_status/`, data, { auth: true });
    if (res && res.production_order) {
      return normalizeBackendProductionOrder(res.production_order);
    }
  } catch (err) {
    console.warn(`[TuEstante Production API] Error en update_status endpoint, aplicando en memoria mock:`, err);
  }

  const order = mockProductionOrders.find(o => o.id === parseInt(id, 10));
  if (!order) throw new Error(`Orden #${id} no encontrada.`);

  if (data.status) {
    order.status = data.status;
    order.status_display = getStageConfig(data.status).label;
    if (!order.start_date && data.status !== 'queued') {
      order.start_date = new Date().toISOString();
    }
    if (data.status === 'completed') {
      order.actual_completion_date = new Date().toISOString();
    }
  }
  if (data.technical_notes !== undefined) {
    order.technical_notes = data.technical_notes;
  }

  return order;
}

/**
 * Consulta métricas y estadísticas para las tarjetas KPI superiores
 */
export async function getProductionMetrics() {
  try {
    const res = await getRequest('/production-orders/metrics/', {}, { auth: true });
    if (res && res.total_orders !== undefined) {
      return res;
    }
  } catch (err) {
    console.warn('[TuEstante Production API] Error al cargar métricas de backend, calculando en mock:', err);
  }

  // Cálculo local sobre mock
  let queued = 0;
  let assembling = 0;
  let painting = 0;
  let quality_check = 0;
  let completed = 0;
  let totalUnits = 0;

  mockProductionOrders.forEach(o => {
    if (o.status === 'queued') queued++;
    else if (o.status === 'assembling') assembling++;
    else if (o.status === 'painting') painting++;
    else if (o.status === 'quality_check') quality_check++;
    else if (o.status === 'completed') completed++;

    (o.items || []).forEach(it => {
      totalUnits += (it.quantity || 1);
    });
  });

  return {
    total_orders: mockProductionOrders.length,
    queued,
    assembling,
    painting,
    quality_check,
    completed,
    in_progress_total: assembling + painting + quality_check,
    total_units_in_production: totalUnits
  };
}

/**
 * Normaliza el objeto devuelto por el serializador de Django
 */
function normalizeBackendProductionOrder(backendObj) {
  const stage = getStageConfig(backendObj.status);
  
  // Mapeo de diseños técnicos individuales si están en technical_design.items
  const designItemsMap = new Map();
  if (backendObj.technical_design?.items && Array.isArray(backendObj.technical_design.items)) {
    backendObj.technical_design.items.forEach(dit => {
      if (dit.detail_id) designItemsMap.set(String(dit.detail_id), dit);
      else if (dit.product_id) designItemsMap.set(String(dit.product_id), dit);
    });
  }

  // Transformar resumen de ítems si viene de order_items_summary
  const items = (backendObj.order_items_summary || []).map(it => {
    const linkedDesign = designItemsMap.get(String(it.detail_id)) || designItemsMap.get(String(it.product_id)) || null;
    return {
      detail_id: it.detail_id || null,
      product_id: it.product_id,
      product_name: it.product_name,
      sku: it.sku || `PROD-${it.product_id}`,
      image: getProductImageUrl(it.image),
      specs: it.notes || '',
      quantity: it.quantity || 1,
      notes: it.notes || '',
      technical_design: it.technical_design || linkedDesign?.technical_design || null,
      blueprint_svg: linkedDesign?.blueprint_svg || null,
    };
  });

  return {
    id: backendObj.id,
    order_id: backendObj.order || null,
    order_number: backendObj.order_number || `#${backendObj.order}`,
    production_code: `OF-${String(backendObj.id).padStart(5, '0')}`,
    iteration: backendObj.iteration || 1,
    client_name: backendObj.client_name || 'Cliente registrado',
    client_phone: backendObj.client_phone || '',
    order_status: backendObj.order_status || '',
    order_status_display: backendObj.order_status_display || '',
    status: backendObj.status,
    status_display: backendObj.status_display || stage.label,
    start_date: backendObj.start_date,
    estimated_completion_date: backendObj.estimated_completion_date,
    actual_completion_date: backendObj.actual_completion_date,
    technical_notes: backendObj.technical_notes || '',
    technical_design: backendObj.technical_design || null,
    blueprint_svg: backendObj.blueprint_svg || null,
    created_at: backendObj.created_at,
    items: items.length > 0 ? items : [
      {
        product_id: 1,
        product_name: "Estante Modular",
        sku: "EST-01",
        image: "../../assets/images/logo.jpeg",
        specs: "Estándar",
        quantity: 1,
        notes: ""
      }
    ]
  };
}

/**
 * Obtiene el plano técnico SVG y diseño paramétrico de una orden
 * @param {number|string} productionOrderId ID de la orden de producción
 */
export async function getProductionBlueprint(productionOrderId) {
  try {
    const res = await getRequest(`/production-orders/${productionOrderId}/blueprint/`, {}, { auth: true });
    if (res && res.blueprint_svg) {
      return res;
    }
  } catch (err) {
    console.warn(`[TuEstante Production API] Error al obtener blueprint para orden #${productionOrderId}:`, err);
  }

  // Contingencia mock
  const found = mockProductionOrders.find(o => o.id === parseInt(productionOrderId, 10));
  if (found) {
    if (!found.blueprint_svg && found.technical_design) {
      found.blueprint_svg = generateMockBlueprintSVG(found.technical_design, `PLANO TÉCNICO - ${found.production_code}`);
    } else if (!found.blueprint_svg) {
      found.technical_design = mockDesign1;
      found.blueprint_svg = generateMockBlueprintSVG(mockDesign1, `PLANO TÉCNICO - ${found.production_code}`);
    }
    return {
      production_order_id: found.id,
      order_id: found.order_id,
      order_number: found.order_number,
      technical_design: found.technical_design,
      blueprint_svg: found.blueprint_svg
    };
  }

  return null;
}

/**
 * Crea una nueva orden de fabricación conectando al endpoint de Django
 * @param {Object} data Datos de la orden a crear
 */
export async function createProductionOrder(data = {}) {
  try {
    const res = await postRequest('/production-orders/', data, { auth: true });
    if (res && res.id) {
      return normalizeBackendProductionOrder(res);
    }
  } catch (err) {
    console.warn('[TuEstante Production API] Error en endpoint /production-orders/, creando en memoria mock:', err);
  }

  const newId = mockProductionOrders.length > 0 
    ? Math.max(...mockProductionOrders.map(o => o.id)) + 1 
    : 1;

  const newOrder = {
    id: newId,
    order_id: data.order || data.order_id || 126,
    order_number: data.order_number || `#00${data.order || 126}`,
    production_code: `OF-${String(newId).padStart(5, '0')}`,
    iteration: 1,
    client_name: data.client_name || 'Cliente TuEstante',
    client_phone: data.client_phone || '+58 412 000 0000',
    status: 'queued',
    status_display: 'En cola de espera',
    start_date: null,
    estimated_completion_date: data.estimated_completion_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    actual_completion_date: null,
    technical_notes: data.technical_notes || '',
    created_at: new Date().toISOString(),
    items: data.items || [
      {
        product_id: 1,
        product_name: "Estante Modular",
        sku: "EST-MOD-01",
        image: "../../assets/images/logo.jpeg",
        specs: "Madera Natural • Ensamblaje estándar",
        quantity: 1,
        notes: data.technical_notes || ""
      }
    ]
  };

  mockProductionOrders.unshift(newOrder);
  return newOrder;
}
