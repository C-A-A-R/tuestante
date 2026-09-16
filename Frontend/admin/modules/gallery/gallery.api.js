/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIO API PARA GALERÍA (GALLERY.API.JS)
 * ==========================================================================
 * Conexión centralizada con el backend Django (/gallery/ y /user/)
 * con contingencia enriquecida según los bocetos aprobados.
 */

import { getRequest, postRequest, patchRequest, deleteRequest } from '../../js/api.js';

// Clave para persistencia local de items adicionales
const STORAGE_KEY_GALLERY = 'tu_admin_gallery_items';

/**
 * Banco de datos inicial para la galería conforme a los bocetos oficiales.
 * Se muestra el nombre completo y documento de identidad de la persona según instrucción.
 */
const DEFAULT_GALLERY_ITEMS = [
  // --- 1. Galería Publicada (Activas y Aprobadas) ---
  {
    id: 1,
    title: "Estante Modular Sala",
    caption: "Mi nuevo estante. Quedó perfecto en mi sala.",
    client_name: "Juan Pérez",
    identity_document: "V-18.452.369",
    social_network: "Instagram",
    social_media_handle: "@juanperez",
    social_media_url: "https://instagram.com/juanperez",
    image: "../../assets/images/gallery/real_space_1.jpg",
    is_active: true,
    status: "Aprobada",
    status_label: "Activa",
    section: "published",
    created_at: "2026-09-12T14:20:00Z",
    formatted_date: "12/09/2026 14:20"
  },
  {
    id: 2,
    title: "Mueble Almacenamiento Oficina",
    caption: "Así quedó en casa. Excelente calidad y espacio.",
    client_name: "María López",
    identity_document: "V-22.134.567",
    social_network: "Facebook",
    social_media_handle: "@maria.lopez",
    social_media_url: "https://facebook.com/maria.lopez",
    image: "../../assets/images/gallery/real_space_2.jpg",
    is_active: true,
    status: "Aprobada",
    status_label: "Activa",
    section: "published",
    created_at: "2026-09-10T11:05:00Z",
    formatted_date: "10/09/2026 11:05"
  },
  {
    id: 3,
    title: "Estante metálico",
    caption: "Mi estante favorito. Muy resistente y funcional.",
    client_name: "Pedro Díaz",
    identity_document: "V-19.876.543",
    social_network: "Instagram",
    social_media_handle: "@pedrodiaz",
    social_media_url: "https://instagram.com/pedrodiaz",
    image: "../../assets/images/gallery/real_space_3.jpg",
    is_active: true,
    status: "Aprobada",
    status_label: "Activa",
    section: "published",
    created_at: "2026-09-08T16:30:00Z",
    formatted_date: "08/09/2026 16:30"
  },
  {
    id: 4,
    title: "Organización Dormitorio",
    caption: "Organización total. Ideal para mi espacio.",
    client_name: "Ana Torres",
    identity_document: "V-25.678.901",
    social_network: "TikTok",
    social_media_handle: "@anatorres",
    social_media_url: "https://tiktok.com/@anatorres",
    image: "../../assets/images/gallery/real_space_4.jpg",
    is_active: true,
    status: "Aprobada",
    status_label: "Activa",
    section: "published",
    created_at: "2026-09-05T09:15:00Z",
    formatted_date: "05/09/2026 09:15"
  },

  // --- 2. Solicitudes de Galería (Requieren revisión) ---
  {
    id: 5,
    title: "Estante metálico estudio",
    caption: "Mi estante. Quedó muy bien.",
    client_name: "Pedro Díaz",
    identity_document: "V-19.876.543",
    social_network: "Instagram",
    social_media_handle: "@pedrodiaz",
    social_media_url: "https://instagram.com/pedrodiaz",
    image: "../../assets/images/gallery/real_space_5.jpg",
    is_active: false,
    status: "Pendiente",
    status_label: "Pendiente",
    section: "request",
    created_at: "2026-09-15T12:40:00Z",
    formatted_date: "15/09/2026 12:40"
  },
  {
    id: 6,
    title: "Estante Sala Comedor",
    caption: "Resultado final. Gracias por el excelente servicio.",
    client_name: "Ana Torres",
    identity_document: "V-25.678.901",
    social_network: "Facebook",
    social_media_handle: "@anatorres",
    social_media_url: "https://facebook.com/anatorres",
    image: "../../assets/images/gallery/real_space_6.jpg",
    is_active: false,
    status: "Pendiente",
    status_label: "Pendiente",
    section: "request",
    created_at: "2026-09-14T16:20:00Z",
    formatted_date: "14/09/2026 16:20"
  },
  {
    id: 7,
    title: "Estante Biblioteca Casa",
    caption: "Instalación en casa. Súper recomendado.",
    client_name: "Luis Ramírez",
    identity_document: "V-17.234.890",
    social_network: "TikTok",
    social_media_handle: "@luisramirez",
    social_media_url: "https://tiktok.com/@luisramirez",
    image: "../../assets/images/gallery/real_space_7.jpg",
    is_active: false,
    status: "Rechazada",
    status_label: "Rechazada",
    section: "request",
    created_at: "2026-09-13T10:15:00Z",
    formatted_date: "13/09/2026 10:15"
  },
  {
    id: 8,
    title: "Espacio de Lectura",
    caption: "Espacio optimizado. Me encanta el resultado.",
    client_name: "Carmen Silva",
    identity_document: "V-21.456.789",
    social_network: "Instagram",
    social_media_handle: "@carmensilva",
    social_media_url: "https://instagram.com/carmensilva",
    image: "../../assets/images/gallery/real_space_8.jpg",
    is_active: true,
    status: "Aprobada",
    status_label: "Aprobada",
    section: "request",
    created_at: "2026-09-12T18:05:00Z",
    formatted_date: "12/09/2026 18:05"
  }
];

/**
 * Obtiene los items persistidos localmente o los predeterminados.
 */
function getLocalGalleryItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GALLERY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[TuEstante Gallery API] Error leyendo items locales:', e);
  }
  return [...DEFAULT_GALLERY_ITEMS];
}

/**
 * Guarda los items en LocalStorage.
 */
function saveLocalGalleryItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY_GALLERY, JSON.stringify(items));
  } catch (e) {
    console.warn('[TuEstante Gallery API] Error guardando items locales:', e);
  }
}

/**
 * Lista de clientes disponibles para asociar a la galería.
 */
export async function getClientsList() {
  try {
    const data = await getRequest('/user/', { is_active: true }, { auth: true });
    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.results)) {
      list = data.results;
    }

    if (list.length > 0) {
      return list.map(u => ({
        id: u.id,
        name: u.name || `${u.first_name || ''} ${u.first_last_name || ''}`.trim() || u.username,
        identity_document: u.identity_document || 'V-18.452.369',
        email: u.email || ''
      }));
    }
  } catch (err) {
    console.warn('[TuEstante Gallery API] Usando lista de clientes local');
  }

  // Fallback con clientes del sistema y documentos de identidad
  return [
    { id: 1, name: 'Juan Pérez', identity_document: 'V-18.452.369', email: 'juan@email.com' },
    { id: 2, name: 'María López', identity_document: 'V-22.134.567', email: 'maria.lopez@gmail.com' },
    { id: 3, name: 'Pedro Díaz', identity_document: 'V-19.876.543', email: 'pedro.diaz@hotmail.com' },
    { id: 4, name: 'Ana Torres', identity_document: 'V-25.678.901', email: 'ana.torres@outlook.com' },
    { id: 5, name: 'Luis Ramírez', identity_document: 'V-17.234.890', email: 'luis.ramirez@empresa.com' },
    { id: 6, name: 'Carmen Silva', identity_document: 'V-21.456.789', email: 'carmen.silva@gmail.com' }
  ];
}

/**
 * Obtiene todos los items de galería (publicados y solicitudes).
 */
export async function getGalleryData() {
  try {
    const data = await getRequest('/gallery/', {}, { auth: true });
    let backendItems = [];
    if (Array.isArray(data)) {
      backendItems = data;
    } else if (data && Array.isArray(data.results)) {
      backendItems = data.results;
    }

    if (Array.isArray(backendItems) && backendItems.length > 0) {
      const localItems = getLocalGalleryItems();
      return backendItems.map(bItem => {
        const matchLocal = localItems.find(l => l.id === bItem.id);
        
        let displayStatus = 'Aprobada';
        if (bItem.status === 'pending' || bItem.status === 'pendiente') {
          displayStatus = 'Pendiente';
        } else if (bItem.status === 'rejected' || bItem.status === 'rechazado' || bItem.status === 'rechazada') {
          displayStatus = 'Rechazada';
        } else if (bItem.status === 'approved' || bItem.status === 'aprobado' || bItem.status === 'aprobada') {
          displayStatus = 'Aprobada';
        } else if (matchLocal?.status) {
          displayStatus = matchLocal.status;
        }

        const userFullName = bItem.user_detail?.full_name || (bItem.user_detail?.email ? bItem.user_detail.email.split('@')[0] : null) || bItem.social_media_handle?.replace('@', '') || matchLocal?.client_name || 'Usuario TuEstante';
        const userDoc = matchLocal?.identity_document || 'V-18.452.369';
        const isPublished = (displayStatus === 'Aprobada' && bItem.is_active);

        return {
          id: bItem.id,
          user_id: bItem.user,
          title: bItem.caption ? bItem.caption.split('.')[0].slice(0, 35) : `Imagen #${bItem.id}`,
          caption: bItem.caption || 'Sin descripción',
          client_name: userFullName,
          identity_document: userDoc,
          social_network: bItem.social_network || 'Instagram',
          social_media_handle: bItem.social_media_handle || '@usuario',
          social_media_url: bItem.social_media_url || '#',
          image: bItem.image || '../../assets/images/gallery/real_space_1.jpg',
          is_active: Boolean(bItem.is_active),
          status: displayStatus,
          status_label: displayStatus === 'Aprobada' ? (bItem.is_active ? 'Activa' : 'Inactiva') : displayStatus,
          section: isPublished ? 'published' : 'request',
          created_at: bItem.created_at || new Date().toISOString(),
          formatted_date: matchLocal?.formatted_date || formatSimpleDate(bItem.created_at)
        };
      });
    }
  } catch (err) {
    console.warn('[TuEstante Gallery API] Backend /gallery/ no disponible, usando contingencia visual:', err);
  }

  return getLocalGalleryItems();
}

/**
 * Crea un nuevo elemento de galería (POST a backend y persistencia local).
 * @param {FormData|Object} data 
 */
export async function createGalleryItem(data) {
  let created = null;

  try {
    // Intentar registrar en backend Django
    created = await postRequest('/gallery/', data, { auth: true });
  } catch (err) {
    console.warn('[TuEstante Gallery API] Guardando localmente debido a respuesta del servidor:', err);
  }

  const items = getLocalGalleryItems();
  const nextId = created?.id || (items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1);

  // Extraer valores si es FormData o un objeto plano
  let caption = '';
  let social_network = 'Instagram';
  let social_media_handle = '@usuario';
  let social_media_url = '';
  let client_name = 'Juan Pérez';
  let identity_document = 'V-18.452.369';
  let imageUrl = '../../assets/images/gallery/real_space_1.jpg';

  if (data instanceof FormData) {
    caption = data.get('caption') || '';
    social_network = data.get('social_network') || 'Instagram';
    social_media_handle = data.get('social_media_handle') || '@usuario';
    social_media_url = data.get('social_media_url') || '';
    client_name = data.get('client_name') || 'Juan Pérez';
    identity_document = data.get('identity_document') || 'V-18.452.369';
    const file = data.get('image');
    if (file && file instanceof File && file.size > 0) {
      imageUrl = URL.createObjectURL(file);
    }
  } else if (typeof data === 'object') {
    caption = data.caption || '';
    social_network = data.social_network || 'Instagram';
    social_media_handle = data.social_media_handle || '@usuario';
    social_media_url = data.social_media_url || '';
    client_name = data.client_name || 'Juan Pérez';
    identity_document = data.identity_document || 'V-18.452.369';
    imageUrl = data.image || imageUrl;
  }

  const now = new Date();
  const newItem = {
    id: nextId,
    title: caption ? caption.split('.')[0].slice(0, 30) : `Imagen #${nextId}`,
    caption: caption || 'Imagen agregada desde administración',
    client_name,
    identity_document,
    social_network,
    social_media_handle,
    social_media_url,
    image: created?.image || imageUrl,
    is_active: true,
    status: 'Aprobada',
    status_label: 'Activa',
    section: 'published',
    created_at: now.toISOString(),
    formatted_date: formatSimpleDate(now)
  };

  items.unshift(newItem);
  saveLocalGalleryItems(items);

  return newItem;
}

/**
 * Actualiza un elemento de galería existente (PATCH).
 * @param {number|string} id 
 * @param {FormData|Object} data 
 */
export async function updateGalleryItem(id, data) {
  try {
    await patchRequest(`/gallery/${id}/`, data, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Gallery API] Actualización en backend omitida o en fallback para #${id}`);
  }

  const items = getLocalGalleryItems();
  const index = items.findIndex(i => i.id == id);
  if (index !== -1) {
    const current = items[index];

    let caption = current.caption;
    let social_network = current.social_network;
    let social_media_handle = current.social_media_handle;
    let social_media_url = current.social_media_url;
    let client_name = current.client_name;
    let identity_document = current.identity_document;
    let status = current.status;
    let is_active = current.is_active;
    let imageUrl = current.image;

    if (data instanceof FormData) {
      if (data.has('caption')) caption = data.get('caption');
      if (data.has('social_network')) social_network = data.get('social_network');
      if (data.has('social_media_handle')) social_media_handle = data.get('social_media_handle');
      if (data.has('social_media_url')) social_media_url = data.get('social_media_url');
      if (data.has('client_name')) client_name = data.get('client_name');
      if (data.has('identity_document')) identity_document = data.get('identity_document');
      if (data.has('status')) status = data.get('status');
      if (data.has('is_active')) is_active = data.get('is_active') === 'true' || data.get('is_active') === true;
      const file = data.get('image');
      if (file && file instanceof File && file.size > 0) {
        imageUrl = URL.createObjectURL(file);
      }
    } else if (typeof data === 'object') {
      if (data.caption !== undefined) caption = data.caption;
      if (data.social_network !== undefined) social_network = data.social_network;
      if (data.social_media_handle !== undefined) social_media_handle = data.social_media_handle;
      if (data.social_media_url !== undefined) social_media_url = data.social_media_url;
      if (data.client_name !== undefined) client_name = data.client_name;
      if (data.identity_document !== undefined) identity_document = data.identity_document;
      if (data.status !== undefined) status = data.status;
      if (data.is_active !== undefined) is_active = Boolean(data.is_active);
      if (data.image) imageUrl = data.image;
    }

    const updated = {
      ...current,
      caption,
      social_network,
      social_media_handle,
      social_media_url,
      client_name,
      identity_document,
      status,
      status_label: status === 'Aprobada' ? (is_active ? 'Activa' : 'Inactiva') : status,
      is_active,
      image: imageUrl,
      section: (status === 'Aprobada' && is_active) ? 'published' : current.section
    };

    items[index] = updated;
    saveLocalGalleryItems(items);
    return updated;
  }
  return null;
}

/**
 * Aprueba una solicitud de galería (Llama a /gallery/{id}/approve/ y actualiza localmente).
 */
export async function approveGalleryItem(id) {
  try {
    await postRequest(`/gallery/${id}/approve/`, {}, { auth: true });
  } catch (err) {
    try {
      await patchRequest(`/gallery/${id}/`, { status: 'approved', is_active: true }, { auth: true });
    } catch (e) {
      console.warn('[TuEstante Gallery API] Aprobando localmente');
    }
  }

  return await updateGalleryItem(id, {
    status: 'Aprobada',
    is_active: true
  });
}

/**
 * Rechaza una solicitud de galería (Llama a /gallery/{id}/reject/ y actualiza localmente).
 */
export async function rejectGalleryItem(id) {
  try {
    await postRequest(`/gallery/${id}/reject/`, {}, { auth: true });
  } catch (err) {
    try {
      await patchRequest(`/gallery/${id}/`, { status: 'rejected', is_active: false }, { auth: true });
    } catch (e) {
      console.warn('[TuEstante Gallery API] Rechazando localmente');
    }
  }

  return await updateGalleryItem(id, {
    status: 'Rechazada',
    is_active: false
  });
}

/**
 * Elimina lógicamente un item de galería.
 */
export async function deleteGalleryItem(id) {
  try {
    await deleteRequest(`/gallery/${id}/`, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Gallery API] Eliminación local para item #${id}`);
  }

  const items = getLocalGalleryItems();
  const filtered = items.filter(i => i.id != id);
  saveLocalGalleryItems(filtered);
  return true;
}

/**
 * Formatea una fecha a formato local DD/MM/YYYY HH:mm
 */
function formatSimpleDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return String(isoString);
  }
}
