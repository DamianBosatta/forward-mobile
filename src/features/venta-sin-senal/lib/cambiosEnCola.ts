import type { CatalogoStockItem } from '@/libs/api-client'
import { mostrarNumero } from '@/src/utils/numero'
import { faltaStock } from '@/features/venta-nueva/lib/avisos'
import type { VentaEnCola } from './cola'

/** Una línea de una venta guardada en el teléfono a la que, con el stock de ahora, ya no le alcanza. */
export interface LineaCambiada {
  clave: string
  productoId: string
  nombre: string
  disponible: number
  cantidad: number
}

/**
 * Al volver la señal (F4, S3): qué líneas de las ventas que esperan en el teléfono ya no alcanzan con el stock
 * actual del catálogo. Solo avisa: las ventas se mandan igual y el servidor decide (puede quedar por autorizar).
 * Sin `CAP_VER_CANTIDADES_STOCK` el catálogo trae `disponible = 0`: ahí decide `puedeVenderse` (misma regla que
 * `faltaStock` al confirmar la venta).
 */
export function lineasQueCambiaron(cola: VentaEnCola[], catalogo: CatalogoStockItem[], verCantidades = true): LineaCambiada[] {
  const porId = new Map(catalogo.map((p) => [p.id, p]))
  return cola
    .filter((v) => v.estado.tipo === 'esperando')
    .flatMap((v) => (v.alta.items ?? []).flatMap((i) => {
      const p = i.productoId ? porId.get(i.productoId) : undefined
      const cantidad = i.cantidad ?? 0
      return p && faltaStock({ productoId: p.id, producto: p, cantidad, descuentoPct: 0 }, verCantidades) ? [{ clave: v.clave, productoId: p.id, nombre: p.nombre, disponible: p.disponible, cantidad }] : []
    }))
}

export function textoDeLineaCambiada(l: LineaCambiada): string {
  const lleva = `la venta guardada lleva ${mostrarNumero(l.cantidad)}`
  return l.disponible <= 0 ? `${l.nombre} se quedó sin stock (${lleva})` : `Quedan ${mostrarNumero(l.disponible)} de ${l.nombre} (${lleva})`
}
