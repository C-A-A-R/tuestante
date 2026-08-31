# Documentación de Favoritos y Destacados - TuEstante

Este documento describe la API y las reglas de negocio implementadas para el manejo de productos favoritos (Wishlist) y destacados en la plataforma **TuEstante**.

---

## 🛠️ Archivos Relacionados en el Backend
* **Modelos:** [models.py](file:///home/carlosaragoza/Documentos/Carlos%20Aragoza/TuEstante/Backend/apps/product/models.py)
* **Controladores (APIViews & ViewSets):** [views.py](file:///home/carlosaragoza/Documentos/Carlos%20Aragoza/TuEstante/Backend/apps/product/api/views.py)
* **Rutas:** [routers.py](file:///home/carlosaragoza/Documentos/Carlos%20Aragoza/TuEstante/Backend/apps/product/api/routers.py)
* **Serializadores:** [serializers.py](file:///home/carlosaragoza/Documentos/Carlos%20Aragoza/TuEstante/Backend/apps/product/api/serializers.py)

---

## ⚡ Reglas de Negocio Automáticas
1. **Destacado Automático por Popularidad:** Cuando un producto acumula **20 o más favoritos activos** (es decir, agregados por 20 usuarios distintos y no eliminados), el sistema automáticamente actualiza el campo `is_feature_product` de dicho producto a `True`.
2. **Optimización de Consultas:** Se precargan los IDs de favoritos en caché local por petición, evitando consultas N+1 al listar productos generales y evaluar si el usuario logueado lo tiene en favoritos.

---

## 📋 Endpoints de la API

### 🌟 1. Productos Destacados (Públicos)
No requieren autenticación (`AllowAny`).

#### A. Listar Destacados (Por defecto: más recientes primero)
* **Ruta:** `GET /api/products/featured-products/`
* **Parámetros Opcionales:**
  * `?sort_by_favorites=true`: Ordena de más favoritos a menos favoritos a nivel global.

#### B. Listar Destacados por Menor Popularidad (Orden Ascendente)
* **Ruta:** `GET /api/products/featured-products/least-favorites/`
* **Alias Adicionales:**
  * `GET /api/products/featured-products/ascending-favorites/`
  * `GET /api/products/featured-products-least-favorites/`
* **Descripción:** Retorna los productos destacados ordenados desde el que tiene 0 o menos favoritos hasta el que más tiene.

---

### ❤️ 2. Gestión de Favoritos / Lista de Deseos (Privados)
Requieren el header de autenticación: `Authorization: Token <su_token>`.

#### A. Obtener favoritos del usuario autenticado
* **Ruta:** `GET /api/products/favorites/`
* **Alias:** `GET /api/products/wishlist/`
* **Parámetros Opcionales:**
  * `?sort_by_favorites=true`: Ordena los favoritos del usuario priorizando los más populares a nivel global.

#### B. Alternar favorito (Toggle)
* **Ruta:** `POST /api/products/favorites/<product_id>/toggle/`
* **Alias:** `POST /api/products/wishlist/<product_id>/toggle/`
* **Respuesta (`200 OK`):**
  ```json
  {
    "is_favorite": true, // true si se agregó, false si se removió
    "message": "'Estante Minimalista' fue agregado a tus favoritos.",
    "product_id": 1
  }
  ```

#### C. Agregar a favoritos
* **Ruta:** `POST /api/products/favorites/<product_id>/`
* **Alias:** `POST /api/products/wishlist/<product_id>/`
* **Respuesta (`200 OK`):**
  ```json
  {
    "is_favorite": true,
    "message": "'Estante Minimalista' fue agregado a tus favoritos.",
    "product_id": 1
  }
  ```

#### D. Remover de favoritos
* **Ruta:** `DELETE /api/products/favorites/<product_id>/`
* **Alias:** `DELETE /api/products/wishlist/<product_id>/`
* **Respuesta (`200 OK`):**
  ```json
  {
    "is_favorite": false,
    "message": "'Estante Minimalista' fue eliminado de tus favoritos.",
    "product_id": 1
  }
  ```

---

## 🎨 Campos de Respuesta en Serializador (`ProductSerializer`)
Cada vez que consultas un producto en la plataforma, la respuesta incluye los siguientes campos adicionales:
* `"is_favorite"`: `true` / `false` (Indica si el usuario que realiza la consulta tiene este producto en favoritos. Siempre es `false` para usuarios anónimos).
* `"favorites_count"`: Entero (Total de usuarios que han guardado el producto como favorito de forma activa).
