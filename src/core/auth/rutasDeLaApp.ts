import type { Permisos } from '@/features/auth/lib/permisos'
import { puedeAbrir } from './reglasDeRuta'

/**
 * Cada pantalla de la app → la ruta de la web que muestra lo mismo (ARQ-04, decisión #32). Con eso la app pide para
 * abrir una pantalla exactamente lo que pide la web (`REGLAS_DE_RUTA`), sin una tabla de permisos propia.
 *
 * `pathname` es el de Expo Router (`usePathname`): sin el grupo `(tabs)`, con los ids ya puestos (`/ventas/v9`).
 * Gana la primera que coincide; `rutasDeLaApp.test.ts` exige que toda pantalla de `app/` tenga una decisión.
 */
type Parametros = Record<string, string | string[] | undefined>

export type Destino =
  /** Se pide lo mismo que para abrir esa ruta de la web. */
  | { web: string }
  /** No hay ruta de la web con regla: la abre cualquier sesión (lo propio de cada uno, o lo filtra el servidor). */
  | { abierta: string }

interface Correspondencia {
  app: RegExp
  destino: (m: RegExpMatchArray, p: Parametros) => Destino
}

const texto = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined
const web = (ruta: string): Destino => ({ web: ruta })
const abierta = (motivo: string) => (): Destino => ({ abierta: motivo })

const CORRESPONDENCIAS: readonly Correspondencia[] = [
  { app: /^\/$/, destino: abierta('Inicio: cada tablero se recorta por permiso') },
  { app: /^\/login$/, destino: abierta('ingreso') },
  { app: /^\/buscar$/, destino: abierta('cada resultado abre su pantalla, que tiene su regla') },
  { app: /^\/avisos(\/preferencias)?$/, destino: abierta('cada uno ve sus avisos') },
  { app: /^\/calendario$/, destino: abierta('cada uno ve su calendario (CalendarioController)') },
  { app: /^\/perfil(\/clave)?$/, destino: abierta('la cuenta propia') },
  { app: /^\/perfil\/usuarios$/, destino: () => web('/usuarios') },
  // La bandeja mezcla autorizaciones de ventas y de finanzas; cada una la filtra el servidor por capacidad.
  { app: /^\/autorizaciones(\/[^/]+)?$/, destino: abierta('cada pedido de autorización lo filtra el servidor') },

  // Ventas. Editar pide Update y la venta nueva Create, como /ventas/<id>/editar y /ventas/nueva.
  {
    app: /^\/ventas\/nueva$/,
    destino: (_m, p) => {
      const editar = texto(p.editar)
      return web(editar ? `/ventas/${encodeURIComponent(editar)}/editar` : '/ventas/nueva')
    },
  },
  // El resumen del vendedor (GET /Reportes/resumen-vendedor) pide Ventas:Read, no MOD_REPORTES.
  { app: /^\/reportes$/, destino: () => web('/ventas') },
  { app: /^\/ventas(\/[^/]+)?$/, destino: () => web('/ventas') },

  // Compras: `?edit=` es edición, como en la web.
  { app: /^\/compras\/nueva$/, destino: (_m, p) => web(texto(p.edit) ? '/compras/nueva?edit=1' : '/compras/nueva') },
  { app: /^\/compras(\/[^/]+)?$/, destino: () => web('/compras') },

  // Socios: alta de cliente o proveedor; con `?id=` es la edición de esa ficha.
  {
    app: /^\/(socios|proveedores)\/nuevo$/,
    destino: (_m, p) => {
      const id = texto(p.id)
      return web(id ? `/socios/${encodeURIComponent(id)}` : '/socios/nueva')
    },
  },
  { app: /^\/proveedores$/, destino: () => web('/socios/proveedores') },
  { app: /^\/(socios|proveedores)\/([^/]+)$/, destino: (m) => web(`/socios/${m[2]}`) },
  { app: /^\/socios$/, destino: () => web('/socios') },

  // Finanzas. El cobro y el pago a proveedor son el mismo POST de Tesorería (MOD_PAGOS).
  { app: /^\/cuentas\/cobro$/, destino: () => web('/finanzas/tesoreria') },
  { app: /^\/cuentas(\/[^/]+)?$/, destino: () => web('/finanzas/cuentas-corrientes') },
  { app: /^\/tesoreria\/pagos\/pagar$/, destino: () => web('/finanzas/tesoreria') },
  { app: /^\/tesoreria\/pagos(\/[^/]+)?$/, destino: () => web('/finanzas/pagos') },
  { app: /^\/tesoreria(\/transferencia|\/pagar-servicio)?$/, destino: () => web('/finanzas/tesoreria') },

  // Catálogo y stock.
  { app: /^\/inventario$/, destino: () => web('/catalogo') },
  { app: /^\/inventario\/stock$/, destino: () => web('/stock') },

  // Logística.
  { app: /^\/logistica\/picking$/, destino: () => web('/logistica/picking') },
  { app: /^\/logistica\/(consola|hojas)$/, destino: () => web('/logistica') },
]

/** La decisión para una pantalla de la app, o `undefined` si no tiene ninguna (el test lo impide; el control la cierra). */
export function destinoDeRuta(pathname: string, params: Parametros = {}): Destino | undefined {
  for (const c of CORRESPONDENCIAS) {
    const m = pathname.match(c.app)
    if (m) return c.destino(m, params)
  }
  return undefined
}

/**
 * ¿Puede abrir esta pantalla de la app? Lo mismo que la web pide para su ruta. Una ruta sin decisión no abre (falla
 * cerrado): lo que abre sin permiso, como el ingreso o Inicio, lo dice su correspondencia `abierta`, así que volver a
 * Inicio nunca entra en un bucle.
 */
export function puedeAbrirPantalla(permisos: Permisos, pathname: string, params: Parametros = {}): boolean {
  const destino = destinoDeRuta(pathname, params)
  if (!destino) return false
  return 'abierta' in destino || puedeAbrir(permisos, destino.web)
}
