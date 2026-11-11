import type { ChipInfo } from '@/core/ui/fw'
import type { ChipEstado } from '@/libs/theme'
import type { StockItem } from '@/libs/api-client/types'
import type { VarianteProducto } from '@/libs/api-client/productos'
import type { components } from '@/libs/api-client/generated/schema'
import { mostrarNumero } from '@/core/utils/numero'

/** Lo que la pantalla de stock necesita de cada renglón del servidor (GET /Stocks). */
export interface FilaDeStock {
  cantidadDisponible: number
  cantidadReservada: number
  cantidadVirtual: number
  stockMinimo: number
  enAlerta: boolean
}

export type EstadoStock = components['schemas']['EstadoStock']

/** Los tres estados de stock, en el orden de la web (FacetasStock). */
export const ESTADOS_STOCK: readonly EstadoStock[] = ['SinStock', 'EnAlerta', 'ConStock']

export const ESTADO_STOCK_LABEL: Record<EstadoStock, string> = {
  SinStock: 'Sin stock',
  EnAlerta: 'En alerta',
  ConStock: 'Con stock',
}

/**
 * Chip del renglón de la Lista: "Sin stock" si no queda disponible, "En alerta" si el servidor lo marca así
 * (disponible <= mínimo; la web usa el mismo `enAlerta`, no se recalcula acá) y "Con stock" con stock de sobra
 * (las etiquetas de los estados de la web).
 */
export function chipDeFilaStock(f: Pick<FilaDeStock, 'cantidadDisponible' | 'enAlerta'>): ChipInfo | null {
  if (f.cantidadDisponible <= 0) return { estado: 'anulado', label: ESTADO_STOCK_LABEL.SinStock }
  if (f.enAlerta) return { estado: 'porAutorizar', label: ESTADO_STOCK_LABEL.EnAlerta }
  return { estado: 'entregado', label: ESTADO_STOCK_LABEL.ConStock }
}

/** "Mín. 24" o nada si el producto no tiene mínimo. */
export function textoMinimo(stockMinimo: number): string | null {
  return stockMinimo > 0 ? `Mín. ${stockMinimo}` : null
}

/** "Stock real 14 · Mín. 24": el físico va siempre; el mínimo, solo si existe. */
export function textoStockReal(actual: number, stockMinimo: number): string {
  return [`Stock real ${mostrarNumero(actual)}`, textoMinimo(stockMinimo)].filter(Boolean).join(' · ')
}

/** "Reservado 96 · Por entrar 0": las dos cantidades van siempre, aunque sean 0. La web nunca dice "Virtual". */
export function textoReservadas(reservadas: number, porEntrar: number): string {
  return `Reservado ${mostrarNumero(reservadas)} · Por entrar ${mostrarNumero(porEntrar)}`
}

/** Sin cantidades, lo único que se ve de stock (web `textoDisponibilidad`): nunca un "0" falso. */
export function textoDisponibilidad(puedeVenderse: boolean | null | undefined): string {
  return puedeVenderse ? 'con stock' : 'sin stock'
}

/** El servidor redactó las cantidades de la fragancia (perfil sin cantidades): `stockDisponible` viene null. */
export function cantidadesRedactadas(v: Pick<VarianteProducto, 'stockDisponible'>): boolean {
  return v.stockDisponible == null
}

/** "96 disponibles · 12 reservadas" (reservadas solo si hay); redactado, "con stock" / "sin stock" (web `textoStockAroma`). */
export function textoStockAroma(v: Pick<VarianteProducto, 'stockDisponible' | 'stockReservado' | 'puedeVenderse'>): string {
  if (cantidadesRedactadas(v)) return textoDisponibilidad(v.puedeVenderse)
  const reservado = v.stockReservado ?? 0
  const disponible = v.stockDisponible ?? 0
  return reservado > 0 ? `${disponible} disponibles · ${reservado} reservadas` : `${disponible} disponibles`
}

/**
 * Una fragancia con la forma de un renglón de stock, para abrir el MISMO detalle que cualquier artículo (web
 * `varianteToStockItem`). Lo que la consulta de variantes no trae va en un valor seguro: sin mínimo ni alerta,
 * por entrar 0; marca y categoría las hereda de la línea.
 */
export function varianteComoFila(v: VarianteProducto, linea: StockItem): StockItem {
  return {
    ...linea,
    id: v.id,
    productoId: v.id,
    producto: v.nombre,
    codigoPropio: v.codigoPropio,
    codigoBarra: v.codigoBarra ?? null,
    codigoProveedor: v.codigoProveedor ?? null,
    precioVenta: v.precioVenta,
    precioCompraBase: null,
    precioConOferta: v.precioConOferta ?? null,
    imageUrl: v.imageUrl ?? null,
    cantidadActual: v.stockActualDeposito ?? v.stockActual,
    cantidadVirtual: 0,
    cantidadTransito: 0,
    cantidadReservada: v.stockReservado ?? 0,
    cantidadDisponible: v.stockDisponible ?? 0,
    stockMinimo: 0,
    enAlerta: false,
    activo: v.activo,
    esPadreDeVariantes: false,
    productoPadreId: linea.productoId,
    fraganciaId: v.fraganciaId ?? null,
    puedeVenderse: v.puedeVenderse,
  }
}

/** Kilos con hasta tres decimales y coma ("1,05 kg"); sin dato, el texto que corresponda. */
export function textoKg(valor: number | null | undefined, vacio: string): string {
  return valor == null ? vacio : `${String(Math.round(valor * 1000) / 1000).replace('.', ',')} kg`
}

/** Cantidad de un movimiento con su signo: "+48", "-6", "0". */
export function cantidadConSigno(cantidad: number): string {
  return `${cantidad > 0 ? '+' : ''}${mostrarNumero(cantidad)}`
}

/**
 * Color del tipo de movimiento (web `getTipoBadgeClasses`): Venta y Rotura salen (peligro), Compra entra (bien),
 * Ajuste según el signo (entra o atención) y Transferencia u otro, en curso.
 */
export function estadoDeMovimiento(tipoLabel: string, cantidad: number): ChipEstado {
  if (tipoLabel === 'Venta' || tipoLabel === 'Rotura') return 'anulado'
  if (tipoLabel === 'Compra') return 'entregado'
  if (tipoLabel === 'Ajuste') return cantidad >= 0 ? 'entregado' : 'porAutorizar'
  return 'enCurso'
}

/** Filtros de la hoja "Filtros" (web FacetasStock). Línea y marca: una sola cada una (el servidor acepta una). */
export interface FiltrosDeStock {
  estados: EstadoStock[]
  linea: { id: string; nombre: string } | null
  marca: { clave: string; nombre: string } | null
  sinPeso: boolean
  soloOcultos: boolean
}

export const SIN_FILTROS: FiltrosDeStock = { estados: [], linea: null, marca: null, sinPeso: false, soloOcultos: false }

/** Cuántos filtros hay puestos, para el botón "Filtros (n activos)". */
export function contarFiltros(f: FiltrosDeStock): number {
  return f.estados.length + [f.linea, f.marca, f.sinPeso, f.soloOcultos].filter(Boolean).length
}

/** "Filtros", "Filtros (1 activo)", "Filtros (3 activos)". */
export function textoBotonFiltros(n: number): string {
  return n > 0 ? `Filtros (${n} activo${n === 1 ? '' : 's'})` : 'Filtros'
}

/**
 * Vacío (web InventarioGrid): solo con el estado "En alerta" y nada más puesto, la lista vacía quiere decir que no
 * hay nada en alerta; con otra búsqueda o filtro encima, el vacío puede venir de esos.
 */
export function textoVacio(f: FiltrosDeStock, busqueda: string): string {
  const soloEnAlerta = f.estados.length === 1 && f.estados[0] === 'EnAlerta' && contarFiltros(f) === 1 && !busqueda.trim()
  return soloEnAlerta ? 'No hay artículos en alerta. ¡El inventario está saludable!' : 'No hay artículos que coincidan con los filtros.'
}
