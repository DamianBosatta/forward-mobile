import type { Permisos } from '@/features/auth/lib/permisos'

// ─────────────────────────────────────────────────────────────────────────────
// Reglas de ruta de la web, copiadas tal cual (ARQ-04, decisión #32 del dueño)
//
// La app decide qué pantalla se abre con la MISMA tabla que el middleware de la web:
// forward-frontend/packages/api-client/src/permisos.ts (`REGLAS_DE_RUTA`, `cumple`, `reglaDeRuta`). El bloque
// entre los marcadores de abajo es una copia textual; `reglasDeRuta.test.ts` lo compara con forward-system.
// Sin permisos nuevos: la app no crea, quita ni reasigna ningún CAP_* ni MOD_*.
//
// Única adaptación: los otorgables son texto, porque mobile no tipa todos los módulos de la web
// (MOD_IMPORTACIONES, MOD_FACTURACION y varias CAP_*). `permisosDesde` los compara igual, por texto.
// ─────────────────────────────────────────────────────────────────────────────

type AppGrantable = string
type Accion = 'read' | 'create' | 'update' | 'delete'

export interface Requisito {
  /** Uno o más otorgables aceptados (OR): alcanza con la acción en cualquiera de ellos. */
  modulo: AppGrantable | readonly AppGrantable[]
  /** Acción pedida sobre `modulo`; lectura por defecto. */
  accion?: Accion
  /** Y además (AND), cada uno de estos otorgables en lectura. */
  ademas?: readonly AppGrantable[]
}

export interface ReglaDeRuta {
  prefix?: string
  /** Regex sobre el pathname, para rutas con un segmento dinámico en el medio. */
  pattern?: RegExp
  /** La regla aplica solo si la URL trae este query param. */
  searchParam?: string
  /** La regla aplica solo si ese query param tiene uno de estos valores. */
  searchParamIn?: { name: string; values: readonly string[] }
  requiere: Requisito
}

// <copia-de-la-web>
/**
 * Pestañas de Tesorería que exponen saldos, movimientos y cierres de caja, el histórico de gastos y
 * la cartera de cheques: piden `CAP_VER_TESORERIA`, como sus endpoints.
 */
export const PESTANIAS_DE_TESORERIA_RESERVADAS: readonly string[] = ['caja', 'gastos', 'cheques']

/** El módulo que exigen todos los controladores de Tesorería para leer. */
export const MODULO_DE_TESORERIA = 'MOD_PAGOS' satisfies AppGrantable

/**
 * Ruta → lo que exige ABRIRLA (no operarla), de la más específica a la menos: gana la primera que
 * coincide. Una ruta sin regla queda abierta a cualquier sesión.
 *
 * Cada requisito es lo que pide el backend para los datos de esa pantalla (A-812): nunca un rol.
 */
export const REGLAS_DE_RUTA: readonly ReglaDeRuta[] = [
  { prefix: '/finanzas/cuentas-corrientes', requiere: { modulo: 'MOD_CC' } },
  // Las reglas de comisión exigen la capacidad, no MOD_CC; va antes por ser más específica.
  {
    prefix: '/finanzas/comisiones/reglas',
    requiere: { modulo: 'CAP_GESTIONAR_REGLAS_COMISION' },
  },
  // Reconciliación de comisiones: el mismo OR que el backend (MOD_CC:Read o MOD_REPORTES:Read).
  { prefix: '/finanzas/comisiones', requiere: { modulo: ['MOD_CC', 'MOD_REPORTES'] } },
  {
    prefix: '/finanzas/tesoreria',
    searchParamIn: { name: 'tab', values: PESTANIAS_DE_TESORERIA_RESERVADAS },
    requiere: { modulo: MODULO_DE_TESORERIA, ademas: ['CAP_VER_TESORERIA'] },
  },
  { prefix: '/finanzas/tesoreria', requiere: { modulo: MODULO_DE_TESORERIA } },
  // Catálogos de Tesorería: sus endpoints (MediosPago, TiposGasto) piden MOD_CONFIGURACION.
  {
    prefix: '/finanzas/configuracion',
    requiere: { modulo: 'MOD_PAGOS', ademas: ['MOD_CONFIGURACION'] },
  },
  // Cargas masivas: ImportacionesController pide CAP_IMPORTAR y MOD_IMPORTACIONES.
  {
    prefix: '/configuracion/importaciones',
    requiere: { modulo: 'MOD_IMPORTACIONES', ademas: ['CAP_IMPORTAR'] },
  },
  // Listas de precios (B10.2): ListasPreciosController pide CAP_ADMINISTRAR_LISTAS_PRECIOS.
  {
    prefix: '/configuracion/listas-precios',
    requiere: { modulo: 'CAP_ADMINISTRAR_LISTAS_PRECIOS' },
  },
  // Historial de pagos de Tesorería.
  { prefix: '/finanzas/pagos', requiere: { modulo: 'MOD_PAGOS', ademas: ['CAP_VER_TESORERIA'] } },
  // La caja con saldos, movimientos y cierres (GetAbiertas, GetMovimientos, GetCerradas) pide
  // CAP_VER_TESORERIA; abrir y cerrar (CAP_OPERAR_CAJA) se gatea adentro de la pantalla.
  { prefix: '/finanzas/caja', requiere: { modulo: 'MOD_PAGOS', ademas: ['CAP_VER_TESORERIA'] } },
  { prefix: '/finanzas', requiere: { modulo: 'MOD_PAGOS' } },
  // Editar una venta exige Update, igual que PUT /api/v1/Ventas/{id}.
  {
    pattern: /^\/ventas\/[^/]+\/editar(\/|$)/,
    requiere: { modulo: 'MOD_VENTAS', accion: 'update' },
  },
  // /ventas/nueva es alta (Create), igual que POST /api/v1/Ventas.
  { prefix: '/ventas/nueva', requiere: { modulo: 'MOD_VENTAS', accion: 'create' } },
  { prefix: '/ventas', requiere: { modulo: 'MOD_VENTAS' } },
  // /compras/nueva es alta salvo que traiga ?edit={id}, que es edición (PUT /api/v1/Compras/{id}).
  {
    prefix: '/compras/nueva',
    searchParam: 'edit',
    requiere: { modulo: 'MOD_COMPRAS', accion: 'update' },
  },
  { prefix: '/compras/nueva', requiere: { modulo: 'MOD_COMPRAS', accion: 'create' } },
  { prefix: '/compras', requiere: { modulo: 'MOD_COMPRAS' } },
  // El catálogo tiene su propio módulo: precios y fotos, sin costos ni cantidades de depósito.
  { prefix: '/catalogo', requiere: { modulo: 'MOD_CATALOGO' } },
  { prefix: '/facturacion/stock-fiscal', requiere: { modulo: 'MOD_STOCK' } },
  { prefix: '/facturacion/posicion-iva', requiere: { modulo: 'MOD_FACTURACION' } },
  {
    prefix: '/facturacion/factura-por-concepto',
    requiere: { modulo: 'MOD_FACTURACION', accion: 'create' },
  },
  { prefix: '/facturacion', requiere: { modulo: 'MOD_FACTURACION' } },
  { prefix: '/stock', requiere: { modulo: 'MOD_STOCK' } },
  // El ABM de productos pide MOD_PRODUCTOS (el vendedor tiene MOD_STOCK solo lectura).
  { prefix: '/inventario/nuevo', requiere: { modulo: 'MOD_PRODUCTOS', accion: 'create' } },
  { prefix: '/inventario/editar', requiere: { modulo: 'MOD_PRODUCTOS', accion: 'update' } },
  { prefix: '/inventario', requiere: { modulo: 'MOD_STOCK' } },
  { prefix: '/logistica/picking', requiere: { modulo: 'MOD_VIAJES' } },
  // Armar viajes y sus vehículos: CAP_ARMAR_VIAJES (L30, L60), como LogisticaController.
  {
    prefix: '/logistica/viajes',
    requiere: { modulo: 'MOD_VIAJES', ademas: ['CAP_ARMAR_VIAJES'] },
  },
  {
    prefix: '/logistica/vehiculos',
    requiere: { modulo: 'MOD_VIAJES', ademas: ['CAP_ARMAR_VIAJES'] },
  },
  // El ABM de depósitos pide lo mismo que su backend: MOD_STOCK:Read (`DepositosController`). Sin la
  // capacidad CAP_VER_TODOS_LOS_DEPOSITOS: el servidor ya acota lo que cada uno ve (L93 k).
  { prefix: '/logistica/depositos', requiere: { modulo: 'MOD_STOCK' } },
  // La bandeja de devoluciones pendientes la abre la capacidad, como sus endpoints.
  { prefix: '/logistica/devoluciones', requiere: { modulo: 'CAP_AUTORIZAR_DEVOLUCION' } },
  // Rendición del chofer: rinde o aprueba, cualquiera de las dos capacidades abre la pantalla.
  {
    prefix: '/logistica/rendiciones',
    requiere: { modulo: ['CAP_RENDIR_COBROS_CHOFER', 'CAP_APROBAR_RENDICION_CHOFER'] },
  },
  { prefix: '/logistica', requiere: { modulo: 'MOD_VIAJES' } },
  // /socios/nueva da de alta un Cliente o un Proveedor: acepta cualquiera de los dos Create.
  {
    prefix: '/socios/nueva',
    requiere: { modulo: ['MOD_CLIENTES', 'MOD_PROVEEDORES'], accion: 'create' },
  },
  { prefix: '/socios/proveedores', requiere: { modulo: 'MOD_PROVEEDORES' } },
  // Ficha de un socio: el id no dice si es cliente o proveedor; el backend responde 403 si toca.
  {
    pattern: /^\/socios\/(?!nueva\b|proveedores\b|solicitudes\b)[^/]+/,
    requiere: { modulo: ['MOD_CLIENTES', 'MOD_PROVEEDORES'] },
  },
  { prefix: '/socios', requiere: { modulo: 'MOD_CLIENTES' } },
  { prefix: '/usuarios', requiere: { modulo: 'MOD_USUARIOS' } },
  { prefix: '/reportes', requiere: { modulo: 'MOD_REPORTES' } },
  { prefix: '/auditoria', requiere: { modulo: 'MOD_USUARIOS' } },
]
// </copia-de-la-web>

/** ¿`permisos` cumple el requisito? (copia de `cumple` de la web) */
export function cumple(permisos: Permisos, requisito: Requisito): boolean {
  const alguno = Array.isArray(requisito.modulo) ? requisito.modulo : [requisito.modulo]
  const accion = requisito.accion ?? 'read'
  const puede = (m: AppGrantable, a: Accion) => permisos.puede(m as Parameters<Permisos['puede']>[0], a)
  return alguno.some((m: AppGrantable) => puede(m, accion)) && (requisito.ademas ?? []).every((m) => puede(m, 'read'))
}

function coincide(regla: ReglaDeRuta, pathname: string, searchParams: URLSearchParams): boolean {
  const coincideRuta = regla.pattern
    ? regla.pattern.test(pathname)
    : !!regla.prefix && pathname.startsWith(regla.prefix)
  if (!coincideRuta) return false
  if (regla.searchParam && !searchParams.has(regla.searchParam)) return false
  if (regla.searchParamIn) {
    const valor = searchParams.get(regla.searchParamIn.name)
    if (!valor || !regla.searchParamIn.values.includes(valor)) return false
  }
  return true
}

/** La regla que aplica a la ruta web (la primera que coincide), o `undefined` si ninguna. */
export function reglaDeRuta(
  pathname: string,
  searchParams: URLSearchParams = new URLSearchParams(),
): ReglaDeRuta | undefined {
  return REGLAS_DE_RUTA.find((regla) => coincide(regla, pathname, searchParams))
}

/** ¿Puede abrir esta ruta web? `href` puede traer query (`/compras/nueva?edit=c1`). Sin regla, abierta. */
export function puedeAbrir(permisos: Permisos, href: string): boolean {
  const [pathname, query = ''] = href.split('?')
  const regla = reglaDeRuta(pathname, new URLSearchParams(query))
  return !regla || cumple(permisos, regla.requiere)
}
