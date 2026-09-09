import fs from "fs";
import path from "path";

console.log("=== INICIANDO VALIDACIÓN DE CORRECCIONES RECIENTES ===\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// TEST 1: Fabricación - Orden e iconos en tabla de órdenes de fabricación
const prodJs = fs.readFileSync("modules/production/production.js", "utf8");
const ordersTableSlice = prodJs.slice(prodJs.indexOf("function renderOrdersTable("));
const hasActionOrder = ordersTableSlice.indexOf("Ver detalle de fabricación") < ordersTableSlice.indexOf("Ver detalle del pedido") &&
                       ordersTableSlice.indexOf("Ver detalle del pedido") < ordersTableSlice.indexOf("Exportar / Imprimir Orden de Fabricación");
assert(hasActionOrder, "Tabla de órdenes de fabricación tiene el orden: 1. Ver fabricación, 2. Ver pedido, 3. Imprimir orden");

const firstActionIsFab = prodJs.includes('<!-- 1. Ver detalle de fabricación (Ojo) -->');
const secondActionIsOrder = prodJs.includes('<!-- 2. Ver detalle del pedido (Enlace exterior) -->');
const thirdActionIsPrint = prodJs.includes('<!-- 3. Exportar / Imprimir orden de fabricación (Impresora) -->');
assert(firstActionIsFab && secondActionIsOrder && thirdActionIsPrint, "Iconos y comentarios correspondientes intercambiados correctamente");

// TEST 2: Fabricación - Botón del Drawer funcionando
const prodInitOrder = prodJs.indexOf("initNavbar({ title: 'Fabricación' });") < prodJs.indexOf("initDrawer();");
assert(prodInitOrder, "production.js inicializa initNavbar antes de initDrawer para garantizar existencia de #admin-drawer en el DOM");

const drawerJs = fs.readFileSync("components/drawer/drawer.js", "utf8");
const hasHeaderBtnDelegation = drawerJs.includes("#drawer-toggle-btn, .drawer-action-btn");
assert(hasHeaderBtnDelegation, "drawer.js cuenta con delegación global de eventos para #drawer-toggle-btn y .drawer-action-btn");

// TEST 3: Envíos - No existen botones de 'borrar guía'
const shippingJs = fs.readFileSync("modules/shipping/shipping.js", "utf8");
const shippingHtml = fs.readFileSync("modules/shipping/shipping.html", "utf8");
const shippingDetailHtml = fs.readFileSync("modules/shipping/shipping-detail.html", "utf8");
const hasDeleteGuia = shippingJs.includes("btn-delete-shipment") || shippingJs.includes("borrar-guia") ||
                      shippingHtml.includes("btn-delete-shipment") || shippingDetailHtml.includes("btn-delete-shipment");
assert(!hasDeleteGuia, "Confirmado: No existen botones indebidos de 'borrar guía' en el módulo de envíos");

// TEST 4: Productos - Eliminación de columna duplicada de Imagen
const prodHtml = fs.readFileSync("modules/product/products.html", "utf8");
assert(!prodHtml.includes('<th style="text-align: center;">Imagen</th>'), "Columna 'Imagen' antes de Video fue removida de products.html thead");

const prodJsFile = fs.readFileSync("modules/product/products.js", "utf8");
assert(!prodJsFile.includes('<!-- 6. Imagen Principal (Click para Vista Previa) -->'), "Celda duplicada de Imagen antes de Video removida de products.js tbody");
assert(prodJsFile.includes('colspan="9"'), "Acordeón de variantes ajustado a colspan=9");

// TEST 5: Productos - Pantalla completa en miniatura principal, ángulos y colores
assert(prodJsFile.includes('product-thumb-btn btn-preview-image'), "Miniatura principal cuenta con botón btn-preview-image para pantalla completa");
assert(prodJsFile.includes('thumb-zoom-overlay'), "Overlay visual con icono de zoom presente en miniatura principal");
assert(prodJsFile.includes('variant-thumb-btn') && prodJsFile.includes('data-title="${escapeHtml(p.product_name)} — ${escapeHtml(a.angle)}"'), "Sub-tabla de Ángulos cuenta con btn-preview-image para pantalla completa");
assert(prodJsFile.includes('variant-thumb-btn') && prodJsFile.includes('data-title="${escapeHtml(p.product_name)} — Color: ${escapeHtml(c.color_name)}"'), "Sub-tabla de Colores cuenta con btn-preview-image para pantalla completa");

console.log(`\nTotal Pruebas: ${passed + failed} | Pasadas: ${passed} | Fallidas: ${failed}`);
if (failed > 0) process.exit(1);
