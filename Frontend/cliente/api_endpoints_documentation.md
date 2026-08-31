# Documentación Completa de la API y Endpoints del Proyecto (TuEstante OMS)

Esta documentación describe detalladamente todos los endpoints expuestos en la API, organizados por módulos. Se especifican los métodos HTTP, permisos requeridos, payloads de entrada, respuestas esperadas y lógica interna de sincronización.

---

## Índice
1. [Autenticación y Gestión de Usuarios (`/api/user/`)](#1-autenticación-y-gestión-de-usuarios-apiuser)
2. [Catálogo de Productos y Categorías (`/api/products/`)](#2-catálogo-de-productos-y-categorías-apiproducts)
3. [Gestión de Proyectos (`/api/projects/`)](#3-gestión-de-proyectos-apiprojects)
4. [Galería de Proyectos (`/api/gallery/`)](#4-galería-de-proyectos-apigallery)
5. [Gestión de Pedidos y Fabricación (`/api/`)](#5-gestión-de-pedidos-y-fabricación-api)
6. [Módulo de Pagos (`/api/`)](#6-módulo-de-pagos-api)
7. [Módulo de Envíos (`/api/`)](#7-módulo-de-envíos-api)
8. [Notificaciones en Tiempo Real (`/api/` y WebSockets)](#8-notificaciones-en-tiempo-real-api-y-websockets)

---

## 1. Autenticación y Gestión de Usuarios (`/api/user/`)

### Registro de Usuario
*   **Ruta:** `POST /api/user/register/` (Alternativo: `/api/user/registro/`)
*   **Permisos:** Administrador (`IsAdmin`)
*   **Cuerpo de la Solicitud (JSON):**
    ```json
    {
      "username": "juan_perez",
      "email": "juan@example.com",
      "password": "PasswordSegura123",
      "first_name": "Juan",
      "second_name": "Carlos",
      "last_name": "Pérez",
      "second_last_name": "Gómez",
      "identity_document": "V-12345678"
    }
    ```
*   **Respuesta Exitosa (201 Created):**
    ```json
    {
      "message": "Usuario registrado exitosamente.",
      "user": {
        "id": 5,
        "username": "juan_perez",
        "email": "juan@example.com",
        "first_name": "Juan",
        "last_name": "Pérez",
        "identity_document": "V-12345678"
      }
    }
    ```

### Activación de Cuenta
*   **Ruta:** `GET /api/user/activate/<uidb64>/<token>/` (Alternativo: `/api/user/activar/<uidb64>/<token>/`)
*   **Permisos:** Público (`AllowAny`)
*   **Descripción:** Renderiza una pantalla HTML informando si la activación fue exitosa.

### Inicio de Sesión
*   **Ruta:** `POST /api/user/login/` (Alternativo: `/api/user/inicio-sesion/`)
*   **Permisos:** Público (`AllowAny`)
*   **Cuerpo de la Solicitud (JSON):**
    ```json
    {
      "username": "juan_perez",
      "password": "PasswordSegura123"
    }
    ```
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "message": "Inicio de sesión exitoso",
      "user": { ... },
      "is_staff": false,
      "is_superuser": false,
      "tokens": {
        "refresh": "eyJhbGciOi...",
        "access": "eyJhbGciOi..."
      }
    }
    ```

### Cierre de Sesión
*   **Ruta:** `POST /api/user/logout/` (Alternativo: `/api/user/cerrar-sesion/`)
*   **Permisos:** Autenticado (`IsAuthenticated`)
*   **Cuerpo de la Solicitud (JSON):**
    ```json
    {
      "refresh_token": "eyJhbGciOi..."
    }
    ```

### Renovar Token de Acceso
*   **Ruta:** `POST /api/user/token/refresh/` (Alternativo: `/api/user/renovar-token/`)
*   **Permisos:** Público
*   **Cuerpo de la Solicitud (JSON):**
    ```json
    {
      "refresh_token": "eyJhbGciOi..."
    }
    ```

### Cambiar Contraseña
*   **Ruta:** `POST /api/user/password/change/` (Alternativo: `/api/user/cambiar-contrasena/`)
*   **Permisos:** Autenticado (`IsAuthenticated`). Clientes solo pueden cambiar la suya. Admins pueden cambiar la de cualquier usuario especificando `user_id`.
*   **Cuerpo de la Solicitud (JSON):**
    ```json
    {
      "new_password": "NuevaPassword123",
      "user_id": 5
    }
    ```

### Restablecer Contraseña (Solicitud y Confirmación)
1.  **Solicitud:** `POST /api/user/password/reset/` (Cuerpo: `{"email": "juan@example.com"}`)
2.  **Confirmación:** `POST /api/user/password/reset/confirm/<uidb64>/<token>/` (Cuerpo: `{"new_password": "..."}`)

### CRUD de Usuarios (Vista Administrativa)
*   **Ruta:** `/api/user/` (Acciones CRUD estándar: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
*   **Permisos:** Administrador (`IsAdmin`)
*   **Filtros GET:** `is_active=true` / `is_staff=true`
*   **Borrado Lógico (`DELETE /api/user/<id>/`):** Desactiva la cuenta (`is_active = False`) y establece `is_deleted = True`.

### Reportes de Usuarios
*   **Ruta:** `GET /api/user/reports/<report_type>/` (Alternativo: `/api/user/reportes/<report_type>/`)
*   **Permisos:** Administrador (`IsAdmin`)
*   **Parámetros:** `tipo` (`excel`, `pdf` o `csv`). Si `report_type` es `usuario_detalle`, requiere parámetro query `id`.
*   **Formatos del `report_type`:** `usuarios` | `administradores` | `usuario_detalle`

---

## 2. Catálogo de Productos y Categorías (`/api/products/`)

### Categorías de Productos
*   **Ruta:** `/api/products/categories/`
*   **Permisos:** Lectura pública (`AllowAny`). Escritura (`POST`, `PUT`, `DELETE`) exclusiva para administradores (`IsAdminUser`).
*   **Endpoints:**
    *   `GET /api/products/categories/` — Listar categorías.
    *   `GET /api/products/categories/<id>/` — Detalle.
    *   `POST /api/products/categories/` — Crear.
    *   `DELETE /api/products/categories/<id>/` — Borrado lógico.

### Tipos de Producto
*   **Ruta:** `/api/products/types/`
*   **Permisos:** Lectura pública. Escritura restringida a administradores.
*   **Endpoints:** CRUD Completo.

### Productos
*   **Ruta:** `/api/products/products/`
*   **Permisos:** Lectura pública. Escritura restringida a administradores.
*   **Filtros query en listado (`GET`):**
    *   `category` / `cat`: Filtrar por ID de Categoría.
    *   `type` / `product_type`: Filtrar por ID de Tipo de Producto.
    *   `include_info=true`: Agrega en el JSON de respuesta los listados completos de categorías y tipos de productos para evitar múltiples requests desde el frontend.
*   **Productos Destacados:**
    *   `GET /api/products/products/featured/` (Alternativo: `GET /api/products/featured/`)

---

## 3. Gestión de Proyectos (`/api/projects/`)

### Proyectos Realizados
*   **Ruta:** `/api/projects/projects/`
*   **Permisos:** Lectura pública. Escritura y eliminación restringida a administradores.
*   **Endpoints:** CRUD completo con soporte de borrado lógico por defecto.

---

## 4. Galería de Proyectos (`/api/gallery/`)

### Imágenes de la Galería
*   **Ruta:** `/api/gallery/gallery/`
*   **Permisos:** Lectura pública (clientes e invitados ven solo imágenes activas `is_active=True`). Escritura y visualización completa para administradores.
*   **Endpoints:** CRUD completo con soporte de borrado lógico.

---

## 5. Gestión de Pedidos y Fabricación (`/api/`)

### Pedidos (Orders)
*   **Ruta:** `/api/orders/`
*   **Permisos:** Autenticado (`IsAuthenticated`). El cliente ve sus propios pedidos. El administrador ve todos los del sistema.
*   **Listado (`GET /api/orders/`):** Retorna lista de pedidos sin incluir eliminados, precargando optimizadamente las líneas de detalle, productos y órdenes de fabricación relacionadas.
*   **Crear Pedido (`POST /api/orders/`):**
    *   **Cuerpo (JSON):**
        ```json
        {
          "notes": "Notas del cliente sobre la entrega",
          "items": [
            {
              "product_id": 1,
              "quantity": 3,
              "notes": "Color negro satinado, altura ajustada a 95cm"
            }
          ]
        }
        ```
    *   **Comportamiento:** Registra en base de datos el pedido y sus líneas correspondientes. Captura la foto instantánea (`snapshot`) del precio de cada producto en el momento del pedido. Calcula el total y avanza el pedido al estado `pending_initial_payment`.
*   **Emitir Orden de Fabricación (Admin):**
    *   **Ruta:** `POST /api/orders/<id>/issue_manufacturing_order/`
    *   **Permisos:** Administrador (`IsAdminUser`)
    *   **Descripción:** Genera o regenera manualmente una nueva iteración de Orden de Fabricación para el pedido.

### Órdenes de Fabricación (OF)
*   **Ruta:** `/api/manufacturing-orders/`
*   **Permisos:** Administrador (`IsAdminUser`)
*   **Descripción:** Listado y detalles de los documentos que especifican las instrucciones de producción para el taller/fábrica.

---

## 6. Módulo de Pagos (`/api/`)

### Registro y Listado de Pagos
*   **Ruta:** `/api/payments/`
*   **Permisos:** Autenticado (`IsAuthenticated`). El cliente ve sus propios pagos; el administrador ve todos los comprobantes.
*   **Crear Comprobante (`POST /api/payments/`):**
    *   **Cuerpo (Multipart Form-Data):**
        *   `order`: ID del Pedido
        *   `payment_stage`: `initial` (Pago Inicial) o `final` (Pago Final)
        *   `amount`: Monto transferido
        *   `payment_method`: `transfer` | `mobile_payment` | `cash` | `other`
        *   `reference_number`: Referencia bancaria
        *   `receipt_file`: Archivo/Imagen del comprobante
        *   `notes`: Notas adicionales
    *   **Comportamiento:** Al registrarse, el estado del pedido cambia automáticamente a revisión (`initial_payment_review` o `final_payment_review`) para alertar al administrador.

### Revisión de Comprobante (Aprobación/Rechazo)
*   **Ruta:** `POST /api/payments/<id>/review/`
*   **Permisos:** Administrador (`IsAdminUser`)
*   **Cuerpo (JSON):**
    ```json
    {
      "status": "approved", 
      "rejection_reason": "" 
    }
    ```
*   **Comportamiento (Aprobado):**
    *   Si es el **pago inicial**, el pedido pasa automáticamente al estado `manufacturing` (En fabricación) y se genera de forma automatizada su **Orden de Fabricación (OF)**.
    *   Si es el **pago final**, el pedido pasa automáticamente a `shipped` (Enviado) indicando que está listo para su despacho.
*   **Comportamiento (Rechazado):**
    *   El pago se registra como rechazado junto con el motivo. El pedido regresa al estado de pago pendiente correspondiente (`pending_initial_payment` o `waiting_final_payment`).

---

## 7. Módulo de Envíos (`/api/`)

### Distribuidores
*   **Ruta:** `/api/distributors/`
*   **Permisos:** Lectura pública de distribuidores activos. Escritura exclusiva de administradores.

### Envíos
*   **Ruta:** `/api/shipments/`
*   **Permisos:** Lectura de envíos propios. Escritura restringida a administradores.
*   **Actualizar Estado del Envío:**
    *   **Ruta:** `POST /api/shipments/<id>/update_status/`
    *   **Permisos:** Administrador (`IsAdminUser`)
    *   **Cuerpo (JSON):** `{"status": "in_transit" | "delivered" | "returned" | "failed"}`
    *   **Sincronización:**
        *   `in_transit` -> Actualiza el pedido a `shipped`.
        *   `delivered` -> Registra la fecha de entrega y finaliza el pedido (`finalized`).
        *   `returned` -> Cambia el pedido a devuelto a taller (`returned_manufacturing`).

---

## 8. Notificaciones en Tiempo Real (`/api/` y WebSockets)

### API de Notificaciones
*   **Ruta:** `/api/notifications/`
*   **Permisos:** Autenticado. Cada usuario ve solo sus notificaciones.
*   **Endpoints:**
    *   `GET /api/notifications/` — Lista de notificaciones del usuario actual (no leídas y leídas). Incluye los adjuntos multimedia.
    *   `POST /api/notifications/<id>/mark_as_read/` — Marcar una notificación como leída.
    *   `POST /api/notifications/mark_all_as_read/` — Marcar todas las notificaciones como leídas.
    *   `DELETE /api/notifications/<id>/` — Borrado lógico.
    *   `POST /api/notifications/send_broadcast/` — (Admin) Envía una notificación general a un usuario.

### WebSocket (Notificaciones en Tiempo Real)
*   **URL de Conexión:** `ws://<host>/ws/notifications/`
*   **Autenticación:** Requiere que el token JWT sea enviado en los headers o parámetros.
*   **Grupo de Canal:** Cada conexión es unida al canal personal `notifications_user_{user_id}`.
*   **Mensajes Recibidos del Cliente:**
    *   Marcar leída:
        ```json
        {
          "action": "mark_read",
          "notification_id": 12
        }
        ```
*   **Mensajes Enviados al Cliente (Notificaciones Push):**
    Cuando ocurren eventos de cambio de estado de pedidos, confirmaciones de pagos o despachos, el backend envía automáticamente un payload al WebSocket con la estructura:
    ```json
    {
      "id": 45,
      "title": "Cambio de Estado",
      "message": "Tu pedido #12 ahora está En fabricación.",
      "notification_type": "order",
      "order_id": 12,
      "is_read": false,
      "created_at": "2026-08-25 13:00:00"
    }
    ```
