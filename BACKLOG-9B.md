# Backlog 9B

| Ítem | Endpoint o campo que falta | Motivo | Pantalla / PR | Cómo quedó mientras tanto |
|---|---|---|---|---|
| Cerrar caja | `POST /api/v1/Cajas/{id}/cerrar` ya no existe; el contrato tiene `POST /api/v1/Cajas/cerrar` (body distinto) | Contrato avanzó; cambió la forma | `useCerrarCaja` (libs/api-client/finanzas.ts) / PR 0.1 | Sin tocar: la llamada fallaría con 404. Hay que adaptar al comando nuevo. |
| Reporte diario | `GET /api/v1/Reportes/diario` ya no existe (hoy: `/Reportes/dashboard`, `/Reportes/ventas/*`) | Contrato avanzó | `useReporteDiario` / PR 0.1 | Sin tocar: devuelve 404. |
| Movimientos de cuenta | `GET /api/v1/CuentasCorrientes/socios/{id}/estado-cuenta` ya no existe; hoy es `/api/v1/cuentas-corrientes/socios/{socioId}/estado-cuenta` | Cambió la ruta (y probablemente la forma de la respuesta) | `useMovimientosCuenta` (finanzas.ts) / PR 0.1 | Sin tocar. La respuesta nueva hay que verificarla contra el DTO antes de migrar. |
| Reset de contraseña | `POST /api/v1/Users/{id}/reset-password` ya no existe; hoy `POST /api/v1/Users/reset-password` con `ExecutePasswordResetCommand` | Cambió el flujo | `useResetPassword` (admin.ts) / PR 0.1 | Sin tocar. |
| Perfiles de permisos | `/api/v1/PermissionProfiles` (CRUD y `apply-to-user`) y `PUT /Roles/{id}/profile` no existen en el contrato | El modelo rol/puesto reemplazó los perfiles | src/features/security/api/securityApi.ts / PR 0.1 | Sin tocar. |
| Desactivar usuario | `PATCH /api/v1/Users/{id}/deactivate` no existe | Contrato avanzó | securityApi.ts `deactivateUser` / PR 0.1 | Sin tocar. |
| Producto: blister | `blisterContenido` ya no existe en Create/UpdateProducto (ni en el detalle) | Contrato avanzó | Formulario de producto / PR 0.1 | Se dejó de enviar. El campo "Unid. por blister" sigue en la UI como ayuda para la venta mínima, no se guarda. |
| Venta (header): cliente | `VentaHeaderDto` no trae `cuit` ni `esProvisorio` del cliente | El selector de cliente de la edición de venta necesita `ClienteLightDto` completo | app/(tabs)/ventas/nueva.tsx / PR 0.1 | Se arma con `displayName = clienteNombre`, `cuit = ''`, `esProvisorio = false`. Nadie los lee hoy. |
| Verificación de métodos | El chequeo de este PR comparó solo rutas, no verbos | Alcance | Todas las fases | Verificar el verbo al tocar cada cliente. |
