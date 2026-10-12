import { formatImporte, type ChipInfo } from '@/core/ui/fw'
import { partesArgentina } from '@/src/utils/date'
import type { Producto, UltimaCompraProducto } from '@/libs/api-client/types'

/** Hay stock / Sin stock, con el booleano que decide el servidor. Sin dato, sin chip: no se inventa. */
export function chipDeStock(puedeVenderse: boolean | null | undefined): ChipInfo | null {
  if (puedeVenderse == null) return null
  return puedeVenderse ? { estado: 'entregado', label: 'Hay stock' } : { estado: 'anulado', label: 'Sin stock' }
}

/** "Se vende por caja de N" cuando la venta mínima es más de una unidad. */
export function textoUnidadDeVenta(ventaMinimaUnidades: number | null | undefined): string {
  const n = ventaMinimaUnidades ?? 1
  return n > 1 ? `Se vende por caja de ${n}` : 'Se vende por unidad'
}

/** Porcentaje argentino con un decimal: 40,0 %. */
export function formatPorcentaje(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')} %`
}

/**
 * Renglón de la tarjeta: "12 fragancias · caja de 12" (lámina CatalogoConsulta). Las partes que el servidor no manda
 * (uno anterior a forward-system #894) no se inventan: una línea sin la cantidad sigue diciendo "Con fragancias" y
 * sin la venta mínima, o con venta por unidad, no hay "caja de N". null si no hay nada que mostrar.
 */
export function detalleDeTarjeta(p: Pick<Producto, 'esPadreDeVariantes' | 'cantidadFragancias' | 'ventaMinimaUnidades'>): string | null {
  const partes: string[] = []
  if (p.esPadreDeVariantes) {
    partes.push(p.cantidadFragancias == null ? 'Con fragancias' : `${p.cantidadFragancias} ${p.cantidadFragancias === 1 ? 'fragancia' : 'fragancias'}`)
  }
  if (p.ventaMinimaUnidades != null && p.ventaMinimaUnidades > 1) partes.push(`caja de ${p.ventaMinimaUnidades}`)
  return partes.length ? partes.join(' · ') : null
}

/**
 * Variación a un decimal, simétrica (-0,05 → -0,1 igual que +0,05 → +0,1; Math.round(-0.5) daría -0) y nunca -0.
 * Es el valor que se escribe y el que decide el color, para que lo que se ve y el color no se contradigan.
 */
export function redondearVariacion(valor: number): number {
  const redondeado = (Math.sign(valor) * Math.round(Math.abs(valor) * 10)) / 10
  return redondeado === 0 ? 0 : redondeado
}

/** Variación con signo y un decimal: +5,2 % / -3,0 % (sin signo si redondea a cero). */
export function formatVariacion(valor: number): string {
  const redondeado = redondearVariacion(valor)
  const signo = redondeado > 0 ? '+' : redondeado < 0 ? '-' : ''
  return `${signo}${formatPorcentaje(Math.abs(redondeado))}`
}

/** Día argentino de un instante como dd/mm/aaaa; null si la fecha no se puede leer. */
export function diaDeUltimaCompra(fecha: string): string | null {
  const ms = Date.parse(fecha)
  if (Number.isNaN(ms)) return null
  const p = partesArgentina(ms)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(p.dia)}/${dos(p.mes + 1)}/${p.anio}`
}

/** "Última compra: 10/10/2026 · Proveedor · $ 1.846,71". Lo que falta (día o proveedor) se omite. */
export function textoUltimaCompra(u: UltimaCompraProducto): string {
  const partes = [diaDeUltimaCompra(u.fecha), u.proveedorNombre?.trim() || null, formatImporte(u.costoUnitario)]
  return `Última compra: ${partes.filter(Boolean).join(' · ')}`
}
