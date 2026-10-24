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
  return { ...catalogo, items: catalogo.items.map((p) => (nuevos.has(p.id) ? { ...p, disponible: nuevos.get(p.id) as number } : p)) }
}
