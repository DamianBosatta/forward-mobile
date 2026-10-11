# Backlog 9B

Lo que el Bloque 9A (solo mobile) necesita del servidor o de la web, y la deuda de mobile que no es de 9B pero hay que seguir.

## Falta en el servidor (para 9B)

| Ítem | Endpoint o campo que falta | Motivo | Pantalla / PR | Cómo quedó mientras tanto |
|---|---|---|---|---|
| Venta (header): cliente | `VentaHeaderDto` no trae `cuit` ni `esProvisorio` del cliente | El selector de cliente de la edición de venta necesita `ClienteLightDto` completo | app/(tabs)/ventas/nueva.tsx / PR 0.1 | Se arma con `displayName = clienteNombre`, `cuit = ''`, `esProvisorio = false`. Nadie los lee hoy. |
| Producto: blister | `blisterContenido` ya no existe en el contrato | Contrato avanzó | Formulario de producto / PR 0.1 | El formulario de producto salió de mobile en 0.4; queda anotado por si la venta mínima lo necesita. |

## Deuda de mobile (rutas que cambiaron en el contrato; se migran en la fase que toca cada pantalla)

| Ítem | Ruta vieja → nueva | Pantalla / fase | Cómo quedó mientras tanto |
|---|---|---|---|
| Cerrar caja | `POST /Cajas/{id}/cerrar` → `POST /Cajas/cerrar` (body distinto) | `useCerrarCaja` (finanzas.ts) / fase 4 | Sin tocar: devuelve 404. |
| Reporte diario | `GET /Reportes/diario` → `/Reportes/dashboard`, `/Reportes/ventas/*` | `useReporteDiario` / fase 5 (reportes, M2) | Sin tocar: devuelve 404. |
| Movimientos de cuenta | `/CuentasCorrientes/socios/{id}/estado-cuenta` → `/cuentas-corrientes/socios/{socioId}/estado-cuenta` | `useMovimientosCuenta` (finanzas.ts) / fase 4 (4.2) | Sin tocar; verificar el DTO antes de migrar. |
| Reset de contraseña | `POST /Users/{id}/reset-password` → `POST /Users/reset-password` | `useResetPassword` (admin.ts) | El ABM de usuarios salió en 0.4; el hook queda sin uso. |
| Cambiar la contraseña propia | Existe `POST /Users/change-password` | "Mi cuenta" / PR 4.6 | `perfil` queda sin cambio de contraseña hasta 4.6. |
| Perfiles de permisos y desactivar usuario | `/PermissionProfiles/*`, `PUT /Roles/{id}/profile`, `PATCH /Users/{id}/deactivate` ya no existen | securityApi.ts | Las pantallas salieron en 0.4. |
| Verificación de métodos | El chequeo de 0.1 comparó solo rutas, no verbos | Todas las fases | Verificar el verbo al tocar cada cliente. |
| Separar clientes y proveedores | Ninguno (trabajo de la app) | `socios` / fase 1 (PR 1.3) | Lista y alta filtradas a clientes (`tipo = 1`). |
| Pedidos por preparar, solo lectura | Ninguno (`logistica/pedidos` ya lee `tipoOperacion = 2`) | `logistica` / PR 5.2 | Se eliminó el tablero de picking (solo escribía). Queda `logistica/pedidos`; la vista de solo lectura se arma en 5.2. |
