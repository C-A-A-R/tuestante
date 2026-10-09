/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIO API PARA PROYECTOS (PROJECT.API.JS)
 * ==========================================================================
 * Conexión centralizada con el backend Django (/projects/)
 * con contingencia enriquecida conforme a los bocetos aprobados.
 */

import { getRequest, postRequest, patchRequest, deleteRequest, resolveImageUrl } from '../../js/api.js';

// Clave para almacenamiento local de proyectos
const STORAGE_KEY_PROJECTS = 'tu_admin_projects_items';

/**
 * Banco de datos predeterminado conforme a la captura oficial aprobada
 */
const DEFAULT_PROJECTS = [
  {
    id: 1,
    project_name: "Centro Educativo Los Robles",
    description: "Suministro e instalación de estanterías para el centro educativo.",
    project_document: "../../assets/docs/sample_project.pdf",
    doc_name: "Proyecto_Los_Robles.pdf",
    doc_size: "2.4 MB",
    project_images: "../../assets/images/gallery/real_space_1.jpg",
    image_name: "los_robles_estantes.jpg",
    image_size: "1.5 MB",
    is_active: true,
    status: "Activo",
    created_at: "2026-09-12T10:30:00Z",
    formatted_date: "12/09/2026 10:30 AM"
  },
  {
    id: 2,
    project_name: "Oficinas Corporativas Alpha",
    description: "Mobiliario de oficina a medida para el área administrativa.",
    project_document: "../../assets/docs/sample_project.pdf",
    doc_name: "Proyecto_Alpha.pdf",
    doc_size: "1.8 MB",
    project_images: "../../assets/images/gallery/real_space_2.jpg",
    image_name: "oficina.jpg",
    image_size: "1.2 MB",
    is_active: true,
    status: "Activo",
    created_at: "2026-09-08T15:45:00Z",
    formatted_date: "08/09/2026 03:45 PM"
  },
  {
    id: 3,
    project_name: "Almacén Industrial Prologis",
    description: "Estanterías industriales de alta resistencia para almacenamiento.",
    project_document: "../../assets/docs/sample_project.pdf",
    doc_name: "Proyecto_Prologis.pdf",
    doc_size: "3.2 MB",
    project_images: "../../assets/images/gallery/real_space_3.jpg",
    image_name: "almacen_prologis.jpg",
    image_size: "2.1 MB",
    is_active: true,
    status: "Activo",
    created_at: "2026-09-01T11:20:00Z",
    formatted_date: "01/09/2026 11:20 AM"
  },
  {
    id: 4,
    project_name: "Proyecto Residencial Vista Alegre",
    description: "Diseño y fabricación de armarios para residencias.",
    project_document: "../../assets/docs/sample_project.pdf",
    doc_name: "Proyecto_Vista_Alegre.pdf",
    doc_size: "2.1 MB",
    project_images: "../../assets/images/gallery/real_space_4.jpg",
    image_name: "vista_alegre_armarios.jpg",
    image_size: "1.8 MB",
    is_active: false,
    status: "Inactivo",
    created_at: "2026-08-25T16:15:00Z",
    formatted_date: "25/08/2026 04:15 PM"
  },
  {
    id: 5,
    project_name: "Tienda Comercial La Esperanza",
    description: "Estanterías y exhibidores para tienda comercial.",
    project_document: "../../assets/docs/sample_project.pdf",
    doc_name: "Proyecto_Esperanza.pdf",
    doc_size: "2.7 MB",
    project_images: "../../assets/images/gallery/real_space_5.jpg",
    image_name: "la_esperanza_tienda.jpg",
    image_size: "1.9 MB",
    is_active: true,
    status: "Activo",
    created_at: "2026-08-18T09:50:00Z",
    formatted_date: "18/08/2026 09:50 AM"
  }
];

/**
 * Obtiene los proyectos almacenados localmente o los predeterminados.
 */
function getLocalProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[TuEstante Project API] Error leyendo proyectos locales:', e);
  }
  return [...DEFAULT_PROJECTS];
}

/**
 * Guarda los proyectos en LocalStorage.
 */
function saveLocalProjects(items) {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(items));
  } catch (e) {
    console.warn('[TuEstante Project API] Error guardando proyectos locales:', e);
  }
}

/**
 * Obtiene el listado de proyectos desde el backend o almacén local.
 */
export async function getProjects() {
  let backendItems = null;
  try {
    const data = await getRequest('/projects/', {}, { auth: true });
    if (Array.isArray(data)) {
      backendItems = data;
    } else if (data && Array.isArray(data.results)) {
      backendItems = data.results;
    }
  } catch (err) {
    console.warn('[TuEstante Project API] Backend /projects/ no disponible, usando contingencia visual:', err);
  }

  const localItems = getLocalProjects();

  if (backendItems !== null) {
    const merged = backendItems.map(bItem => {
      const matchLocal = localItems.find(l => l.id === bItem.id);
      const isActive = bItem.is_active !== undefined ? Boolean(bItem.is_active) : (matchLocal ? matchLocal.is_active : true);
      const resolvedDoc = resolveImageUrl(bItem.project_document || matchLocal?.project_document || '');
      const resolvedImg = resolveImageUrl(bItem.project_images || matchLocal?.project_images || '', '../../assets/images/gallery/real_space_1.jpg');

      return {
        id: bItem.id,
        project_name: bItem.project_name || `Proyecto #${bItem.id}`,
        description: bItem.description || '',
        project_document: resolvedDoc,
        doc_name: bItem.project_document ? bItem.project_document.split('/').pop() : (matchLocal?.doc_name || 'Proyecto_Documento.pdf'),
        doc_size: matchLocal?.doc_size || '2.0 MB',
        project_images: resolvedImg,
        image_name: bItem.project_images ? bItem.project_images.split('/').pop() : (matchLocal?.image_name || 'proyecto.jpg'),
        image_size: matchLocal?.image_size || '1.5 MB',
        is_active: isActive,
        status: isActive ? 'Activo' : 'Inactivo',
        created_at: bItem.created_at || new Date().toISOString(),
        formatted_date: matchLocal?.formatted_date || formatSimpleDate(bItem.created_at)
      };
    });

    return merged;
  }

  return localItems;
}

/**
 * Registra un nuevo proyecto en el backend y persistencia local.
 * @param {FormData|Object} data 
 */
export async function createProject(data) {
  let created = null;

  try {
    created = await postRequest('/projects/', data, { auth: true });
  } catch (err) {
    console.warn('[TuEstante Project API] Error en postRequest /projects/:', err);
  }

  if (created && created.id) {
    const isActive = created.is_active !== undefined ? Boolean(created.is_active) : true;
    const resolvedDoc = resolveImageUrl(created.project_document || '');
    const resolvedImg = resolveImageUrl(created.project_images || '', '../../assets/images/gallery/real_space_1.jpg');
    const newProj = {
      id: created.id,
      project_name: created.project_name || `Proyecto #${created.id}`,
      description: created.description || '',
      project_document: resolvedDoc,
      doc_name: created.project_document ? created.project_document.split('/').pop() : 'Proyecto_Documento.pdf',
      doc_size: '2.0 MB',
      project_images: resolvedImg,
      image_name: created.project_images ? created.project_images.split('/').pop() : 'proyecto.jpg',
      image_size: '1.5 MB',
      is_active: isActive,
      status: isActive ? 'Activo' : 'Inactivo',
      created_at: created.created_at || new Date().toISOString(),
      formatted_date: formatSimpleDate(created.created_at)
    };
    return newProj;
  }

  const items = getLocalProjects();
  const nextId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;

  let projectName = '';
  let description = '';
  let docUrl = '../../assets/docs/sample_project.pdf';
  let docName = 'Proyecto_Documento.pdf';
  let docSize = '1.8 MB';
  let imageUrl = '../../assets/images/gallery/real_space_1.jpg';
  let imageName = 'proyecto_imagen.jpg';
  let imageSize = '1.2 MB';

  if (data instanceof FormData) {
    projectName = data.get('project_name') || '';
    description = data.get('description') || '';
    
    const docFile = data.get('project_document');
    if (docFile && docFile instanceof File && docFile.size > 0) {
      docUrl = URL.createObjectURL(docFile);
      docName = docFile.name;
      docSize = `${(docFile.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    const imgFile = data.get('project_images');
    if (imgFile && imgFile instanceof File && imgFile.size > 0) {
      imageUrl = URL.createObjectURL(imgFile);
      imageName = imgFile.name;
      imageSize = `${(imgFile.size / (1024 * 1024)).toFixed(1)} MB`;
    }
  } else if (typeof data === 'object') {
    projectName = data.project_name || '';
    description = data.description || '';
    docUrl = data.project_document || docUrl;
    docName = data.doc_name || docName;
    docSize = data.doc_size || docSize;
    imageUrl = data.project_images || imageUrl;
    imageName = data.image_name || imageName;
    imageSize = data.image_size || imageSize;
  }

  const now = new Date();
  const newProject = {
    id: nextId,
    project_name: projectName || `Proyecto #${nextId}`,
    description: description || 'Sin descripción',
    project_document: docUrl,
    doc_name: docName,
    doc_size: docSize,
    project_images: imageUrl,
    image_name: imageName,
    image_size: imageSize,
    is_active: true,
    status: 'Activo',
    created_at: now.toISOString(),
    formatted_date: formatSimpleDate(now)
  };

  items.unshift(newProject);
  saveLocalProjects(items);
  return newProject;
}

/**
 * Actualiza un proyecto existente (PATCH).
 * @param {number|string} id 
 * @param {FormData|Object} data 
 */
export async function updateProject(id, data) {
  let backendItem = null;
  try {
    backendItem = await patchRequest(`/projects/${id}/`, data, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Project API] Error en patchRequest /projects/${id}/:`, err);
  }

  if (backendItem && backendItem.id) {
    const isActive = backendItem.is_active !== undefined ? Boolean(backendItem.is_active) : true;
    const resolvedDoc = resolveImageUrl(backendItem.project_document || '');
    const resolvedImg = resolveImageUrl(backendItem.project_images || '', '../../assets/images/gallery/real_space_1.jpg');
    return {
      id: backendItem.id,
      project_name: backendItem.project_name || `Proyecto #${backendItem.id}`,
      description: backendItem.description || '',
      project_document: resolvedDoc,
      doc_name: backendItem.project_document ? backendItem.project_document.split('/').pop() : 'Proyecto_Documento.pdf',
      doc_size: '2.0 MB',
      project_images: resolvedImg,
      image_name: backendItem.project_images ? backendItem.project_images.split('/').pop() : 'proyecto.jpg',
      image_size: '1.5 MB',
      is_active: isActive,
      status: isActive ? 'Activo' : 'Inactivo',
      created_at: backendItem.created_at || new Date().toISOString(),
      formatted_date: formatSimpleDate(backendItem.created_at)
    };
  }

  const items = getLocalProjects();
  const index = items.findIndex(i => i.id == id);
  if (index !== -1) {
    const current = items[index];

    let projectName = current.project_name;
    let description = current.description;
    let docUrl = current.project_document;
    let docName = current.doc_name;
    let docSize = current.doc_size;
    let imageUrl = current.project_images;
    let imageName = current.image_name;
    let imageSize = current.image_size;
    let isActive = current.is_active;

    if (data instanceof FormData) {
      if (data.has('project_name')) projectName = data.get('project_name');
      if (data.has('description')) description = data.get('description');
      if (data.has('is_active')) isActive = data.get('is_active') === 'true' || data.get('is_active') === true;

      const docFile = data.get('project_document');
      if (docFile && docFile instanceof File && docFile.size > 0) {
        docUrl = URL.createObjectURL(docFile);
        docName = docFile.name;
        docSize = `${(docFile.size / (1024 * 1024)).toFixed(1)} MB`;
      }

      const imgFile = data.get('project_images');
      if (imgFile && imgFile instanceof File && imgFile.size > 0) {
        imageUrl = URL.createObjectURL(imgFile);
        imageName = imgFile.name;
        imageSize = `${(imgFile.size / (1024 * 1024)).toFixed(1)} MB`;
      }
    } else if (typeof data === 'object') {
      if (data.project_name !== undefined) projectName = data.project_name;
      if (data.description !== undefined) description = data.description;
      if (data.is_active !== undefined) isActive = Boolean(data.is_active);
      if (data.project_document) docUrl = data.project_document;
      if (data.doc_name) docName = data.doc_name;
      if (data.doc_size) docSize = data.doc_size;
      if (data.project_images) imageUrl = data.project_images;
      if (data.image_name) imageName = data.image_name;
      if (data.image_size) imageSize = data.image_size;
    }

    const updated = {
      ...current,
      project_name: projectName,
      description: description,
      project_document: docUrl,
      doc_name: docName,
      doc_size: docSize,
      project_images: imageUrl,
      image_name: imageName,
      image_size: imageSize,
      is_active: isActive,
      status: isActive ? 'Activo' : 'Inactivo'
    };

    items[index] = updated;
    saveLocalProjects(items);
    return updated;
  }
  return null;
}

/**
 * Actualiza el estado activo/inactivo de un proyecto.
 */
export async function updateProjectStatus(id, newStatus) {
  const isActive = newStatus === 'Activo';
  return await updateProject(id, { is_active: isActive });
}

/**
 * Elimina un proyecto (DELETE).
 */
export async function deleteProject(id) {
  try {
    await deleteRequest(`/projects/${id}/`, { auth: true });
  } catch (err) {
    console.warn(`[TuEstante Project API] Eliminación local para proyecto #${id}`);
  }

  const items = getLocalProjects();
  const filtered = items.filter(i => i.id != id);
  saveLocalProjects(filtered);
  return true;
}

/**
 * Formatea fechas a formato DD/MM/YYYY hh:mm A
 */
function formatSimpleDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
  } catch (e) {
    return String(isoString);
  }
}
