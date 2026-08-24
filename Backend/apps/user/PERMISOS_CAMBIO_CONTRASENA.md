# Documentación de Permisos para Cambio de Contraseña

## Resumen
Se ha implementado un sistema de permisos diferenciados para el endpoint de cambio de contraseña en el backend del proyecto Consejo Comunal.

## Permisos Implementados

### 1. Permisos Básicos de Roles
- **EsLider**: Solo usuarios con rol "Lider"
- **EsAdmin**: Solo usuarios con rol "Admin" (corregido mensaje de error)
- **EsVocero**: Solo usuarios con rol "Vocero" (nuevo permiso)

### 2. Permiso Especializado: `PuedeActualizarContrasena`
Este permiso maneja la lógica específica para el endpoint de cambio de contraseña:

#### Reglas de Acceso:
1. **Usuario autenticado cambiando su propia contraseña**:
   - Todos los roles pueden cambiar su propia contraseña
   - Requiere validación de `contrasena_actual`

2. **Líder cambiando contraseña de vocero**:
   - Líder puede cambiar contraseña de cualquier vocero
   - No requiere validación de `contrasena_actual` del vocero
   - Líder NO puede cambiar contraseñas de otros líderes o admins

3. **Restricciones**:
   - Vocero solo puede cambiar su propia contraseña
   - Admin solo puede cambiar su propia contraseña
   - Nadie puede cambiar la contraseña de un líder excepto el propio líder

## Endpoint Modificado

### `CambiarContrasenaView` - POST `/api/cambiar-contrasena/`

#### Permisos:
- `permissions.IsAuthenticated`: Usuario debe estar autenticado
- `PuedeActualizarContrasena`: Permiso personalizado que valida:
  - Usuario puede cambiar su propia contraseña
  - Líder puede cambiar contraseña de cualquier vocero
  - Nadie más puede cambiar contraseñas de otros usuarios

#### Parámetros del Request:
```json
{
  "usuario_id": "integer (opcional)",
  "contrasena_actual": "string (condicional)",
  "nueva_contrasena": "string (requerido)",
  "nueva_contrasena2": "string (requerido)"
}
```

#### Reglas de Validación:
- Si `usuario_id` NO se proporciona: Se asume que el usuario quiere cambiar su propia contraseña
  - Requiere `contrasena_actual`
  - Valida que la contraseña actual sea correcta
  
- Si `usuario_id` SE proporciona y es diferente del usuario actual:
  - Solo líderes pueden hacer esto
  - Solo si el usuario a modificar es un vocero
  - No requiere `contrasena_actual`

#### Implementación Técnica:
- La vista implementa `get_object()` para obtener el usuario a modificar
- El permiso `PuedeActualizarContrasena` valida los permisos usando `has_object_permission()`
- La validación del serializer es condicional basada en si se está cambiando la propia contraseña o la de otro usuario

#### Respuestas de Error:
- `400 Bad Request`: Datos de entrada inválidos
- `401 Unauthorized`: Usuario no autenticado
- `403 Forbidden`: Permisos insuficientes
- `404 Not Found`: Usuario no encontrado

## Ejemplos de Uso

### 1. Vocero cambiando su propia contraseña:
```bash
POST /api/cambiar-contrasena/
Authorization: Bearer <token_vocero>
Content-Type: application/json

{
  "contrasena_actual": "vieja123",
  "nueva_contrasena": "nueva456",
  "nueva_contrasena2": "nueva456"
}
```

### 2. Líder cambiando contraseña de vocero:
```bash
POST /api/cambiar-contrasena/
Authorization: Bearer <token_lider>
Content-Type: application/json

{
  "usuario_id": 123,
  "nueva_contrasena": "nueva456",
  "nueva_contrasena2": "nueva456"
}
```

### 3. Líder intentando cambiar contraseña de otro líder (PROHIBIDO):
```bash
POST /api/cambiar-contrasena/
Authorization: Bearer <token_lider>
Content-Type: application/json

{
  "usuario_id": 456,  # ID de otro líder
  "nueva_contrasena": "nueva456",
  "nueva_contrasena2": "nueva456"
}

# Respuesta: 403 Forbidden
# Mensaje: "No tiene permisos para actualizar la contraseña de este usuario"
```

## Archivos Modificados

1. **`apps/usuarios/api/permisos.py`**:
   - Corregido mensaje en `EsAdmin`
   - Agregado `EsVocero` (nuevo permiso para rol Vocero)
   - Implementado `PuedeActualizarContrasena` (permiso personalizado para cambio de contraseña)

2. **`apps/usuarios/api/authentication_api_view.py`**:
   - Actualizada `CambiarContrasenaView` para usar `PuedeActualizarContrasena` en `permission_classes`
   - Implementado `get_object()` para obtener el usuario a modificar
   - Agregada lógica para manejar `usuario_id` y permisos diferenciados
   - Añadida importación de `serializers`

3. **`apps/usuarios/api/serializers.py`**:
   - Actualizado `CambioContrasenaSerializer` para incluir `usuario_id`
   - Lógica condicional para validación de `contrasena_actual`
   - Validación dinámica basada en si se cambia la propia contraseña o la de otro usuario

## Consideraciones de Seguridad

1. **Validación de Contraseñas**:
   - Uso de `validate_password` de Django para validación de fortaleza
   - Confirmación de nueva contraseña requerida

2. **Protección contra Cambios No Autorizados**:
   - Los líderes solo pueden modificar voceros, no otros líderes o admins
   - Los voceros y admins solo pueden modificarse a sí mismos

3. **Manejo Seguro de Tokens**:
   - Requiere autenticación JWT para todos los endpoints
   - Uso de `permissions.IsAuthenticated` como permiso base