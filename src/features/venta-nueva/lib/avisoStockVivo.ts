import type { CatalogoStockItem } from '@/libs/api-client'
import type { CambioProducto } from '@/core/realtime/stockEnVivo'
import { mostrarNumero } from '@/src/utils/numero'
import type { LineaCarrito } from './carrito'

/**
 * Aviso de stock en vivo para una línea de la venta (F4, S2). Solo avisa: nunca bloquea, el servidor decide al
 * guardar. "Poco" lo dice el servidor (`EnAlerta`, por el stock mínimo). Sin cantidades en el aviso
 * (usuario sin `CAP_VER_CANTIDADES_STOCK`) el texto no lleva ningún número.
 */
export function avisoDeStock(cambio: CambioProducto, linea: LineaCarrito): string | null {
  const nombre = linea.producto.nombre
  if (cambio.estado === 'SinStock') return `${nombre} se quedó sin stock: la venta va a ir a autorización`
  if (cambio.disponible === undefined) return cambio.estado === 'EnAlerta' ? `Queda poco de ${nombre}` : null
  if (cambio.estado === 'EnAlerta' || cambio.disponible < linea.cantidad) {
    return `Quedan ${mostrarNumero(cambio.disponible)} de ${nombre} (cargaste ${mostrarNumero(linea.cantidad)})`
  }
  return null
}

interface Catalogo {
  items: CatalogoStockItem[]
  truncado: boolean
}

/** El catálogo de venta con el disponible nuevo de las filas que llegaron con cantidades. */
export function aplicarCambiosAlCatalogo(datos: Catalogo | CatalogoStockItem[], cambios: CambioProducto[]): Catalogo {
  const catalogo: Catalogo = Array.isArray(datos) ? { items: datos, truncado: false } : datos
  const nuevos = new Map(cambios.filter((c) => c.disponible !== undefined).map((c) => [c.productoId, c.disponible as number]))
  if (nuevos.size === 0) return catalogo
  // `puedeVenderse` se deriva igual que en el servidor (disponible > 0): si no, el parche dejaría el yes/no viejo.
  const conNuevo = (p: CatalogoStockItem) => {
    const disponible = nuevos.get(p.id) as number
    return { ...p, disponible, puedeVenderse: disponible > 0 }
  }
  return { ...catalogo, items: catalogo.items.map((p) => (nuevos.has(p.id) ? conNuevo(p) : p)) }
}

const CAMPOS_STOCK = ['deposito', 'reservado', 'real', 'disponible', 'virtual', 'puedeVenderse'] as const

/**
 * Las líneas con el stock del catálogo vivo (el que refresca `useStockVivoVenta`): la línea guarda la fila del
 * momento en que se cargó, y el editor y el confirmar leerían un disponible viejo. Solo se toma el stock; el
 * precio y lo demás quedan como se cargaron. Sin cambios devuelve las mismas líneas (no re-renderiza).
 */
export function conStockFresco(lineas: LineaCarrito[], catalogo: CatalogoStockItem[]): LineaCarrito[] {
  const porId = new Map(catalogo.map((p) => [p.id, p]))
  let cambio = false
  const nuevas = lineas.map((l) => {
    const fresco = porId.get(l.productoId)
    if (!fresco || CAMPOS_STOCK.every((k) => fresco[k] === l.producto[k])) return l
    cambio = true
    return { ...l, producto: { ...l.producto, ...Object.fromEntries(CAMPOS_STOCK.map((k) => [k, fresco[k]])) } }
  })
  return cambio ? nuevas : lineas
}

/** Una línea cuyo stock cambió desde que el vendedor la cargó. */
export interface CambioDeStock {
  productoId: string
  /** Disponible que se vio al cargar la línea. */
  antes: number
  /** Disponible de ahora. */
  ahora: number
  /** El yes/no de ahora (lo único que sabe quien no ve cantidades). */
  puedeVenderse: boolean
}

/**
 * Las líneas cuyo stock cambió contra lo que se vio al cargarlas (`LineaCarrito.producto` es esa foto). Quien ve
 * cantidades compara `disponible`; quien no, recibe `disponible = 0` y compara `puedeVenderse`. Un producto que ya
 * no está en el catálogo no se marca.
 */
export function stockCambiado(lineas: LineaCarrito[], catalogo: CatalogoStockItem[], verCantidades: boolean): CambioDeStock[] {
  const porId = new Map(catalogo.map((p) => [p.id, p]))
  const cambios: CambioDeStock[] = []
  for (const l of lineas) {
    const fresco = porId.get(l.productoId)
    if (!fresco) continue
    const cambio = verCantidades ? fresco.disponible !== l.producto.disponible : fresco.puedeVenderse !== l.producto.puedeVenderse
    if (cambio) cambios.push({ productoId: l.productoId, antes: l.producto.disponible, ahora: fresco.disponible, puedeVenderse: fresco.puedeVenderse })
  }
  return cambios
}
