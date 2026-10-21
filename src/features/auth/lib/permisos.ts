import type { AppModule, ModulePermission } from '@/libs/api-client/types'
import type { AppCapability } from './capabilities'

// ─────────────────────────────────────────────────────────────────────────────
// Permisos de mobile desde las capacidades (C-004, lote L-12)
//
// Copia de `permisosDesde` de la web (forward-frontend/packages/api-client/src/permisos.ts, L-11):
// el drawer, las pantallas y los botones deciden con lo que el backend dice que el usuario tiene
// —módulos RCUD y capacidades CAP_*—, nunca con su rol. La fuente es el array de
// GET /api/v1/users/me/permissions, ya pasado a filas por parsePermissionsFromArray.
//
// Sin atajo por rol: el catálogo completo de AdministradorSistemas lo agrega el backend como filas
// en esa misma respuesta (PermissionService, AppPermissionCatalog), así que acá no hay bypass.
// Fail-closed: sin la fila, no.
//
// Única diferencia con la web: el módulo se compara sin distinguir mayúsculas, igual que
// PermissionService.HasPermissionAsync (OrdinalIgnoreCase) en el backend.
//
// La verificación automática de la copia contra la web llega con `check:reglas` (C-022, L-29).
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que el backend otorga por usuario: un módulo RCUD o una capacidad. */
type AppGrantable = AppModule | AppCapability

type Accion = 'read' | 'create' | 'update' | 'delete'

export interface Permisos {
  /** ¿Tiene la acción pedida (lectura por defecto) sobre ese módulo o capacidad? */
  puede(otorgable: AppGrantable, accion?: Accion): boolean
  /** ¿Tiene la capacidad? Una capacidad es un sí/no: se otorga con lectura. */
  tiene(capacidad: AppCapability): boolean
}

const CAMPO_DE_LA_ACCION: Record<Accion, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'> = {
  read: 'canRead',
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
}

/** La única función que responde "¿puede?" en mobile. */
export function permisosDesde(
  permissions: readonly ModulePermission[] | null | undefined,
): Permisos {
  const filas = permissions ?? []
  const puede = (otorgable: AppGrantable, accion: Accion = 'read') =>
    filas.some(
      (p) => p.module?.toUpperCase() === otorgable && p[CAMPO_DE_LA_ACCION[accion]] === true,
    )
  return { puede, tiene: (capacidad) => puede(capacidad, 'read') }
}
