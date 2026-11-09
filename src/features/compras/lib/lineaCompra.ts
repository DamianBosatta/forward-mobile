import type { CompraDetalle } from '@/libs/api-client'
import { mostrarNumero } from '@/core/utils/numero'
import { nivelesDeEmpaque, nivelInicial, pasoDeUnidad, type EmpaqueProducto, type UnidadCompra } from '@/core/utils/empaque'

export type { UnidadCompra }

/**
 * Línea de una compra en el teléfono. La cantidad va en la unidad elegida; el costo es SIEMPRE
 * por unidad (CompraDetalleDto.CostoUnitario: "2 bultos de 12 a $100 son 24 unidades a $100").
 */
export interface LineaCompra {
  productoId: string
  nombre: string
  cantidad: number
  unidad: UnidadCompra
  /** Unidades que trae una unidad de compra (1 en Unidad; el bulto del producto en Bulto). */
  unidadesPorUnidad: number
  /** null = sin costo: no hay uno previo y el usuario no lo cargó. Nunca se inventa. */
  costoUnitario: number | null
  /** Moneda del costo tal como la guardó el servidor; sin valor (línea nueva) se manda ARS. */
  monedaCosto?: string
}

export function sinCosto(l: LineaCompra): boolean {
  return l.costoUnitario === null || l.costoUnitario <= 0
}

export function unidadesDe(l: LineaCompra): number {
  return l.cantidad * l.unidadesPorUnidad
}

/** Subtotal sin descuento global; null si la línea no tiene costo. */
export function subtotalDe(l: LineaCompra): number | null {
  return sinCosto(l) ? null : unidadesDe(l) * l.costoUnitario!
}

/** Nombre de cada empaque, en singular y plural (la compra sí habla de bultos: es la unidad de compra). */
const EMPAQUE: Record<UnidadCompra, { singular: string; plural: string }> = {
  Unidad: { singular: 'Unidad', plural: 'Unidades' },
  Pack: { singular: 'Pack', plural: 'Packs' },
  Bulto: { singular: 'Bulto', plural: 'Bultos' },
  BultoMadre: { singular: 'Bulto madre', plural: 'Bultos madre' },
}

export function nombreDeEmpaque(unidad: UnidadCompra, plural = false): string {
  return plural ? EMPAQUE[unidad].plural : EMPAQUE[unidad].singular
}

/** "20 bultos × 12 = 240 u": lo pedido en la unidad de compra y lo que son en unidades; "240 u" si va por unidad. */
export function textoDeLinea(l: Pick<LineaCompra, 'cantidad' | 'unidad' | 'unidadesPorUnidad'>): string {
  const unidades = mostrarNumero(l.cantidad * l.unidadesPorUnidad)
  if (l.unidad === 'Unidad' || l.unidadesPorUnidad === 1) return `${unidades} u`
  return `${mostrarNumero(l.cantidad)} ${EMPAQUE[l.unidad].plural.toLowerCase()} × ${mostrarNumero(l.unidadesPorUnidad)} = ${unidades} u`
}

/** "Bulto ×12 = 240 u" (paso Productos); "240 u" si va por unidad. */
export function textoDeEmpaque(l: Pick<LineaCompra, 'cantidad' | 'unidad' | 'unidadesPorUnidad'>): string {
  const unidades = `${mostrarNumero(l.cantidad * l.unidadesPorUnidad)} u`
  return l.unidad === 'Unidad' ? unidades : `${EMPAQUE[l.unidad].singular} ×${mostrarNumero(l.unidadesPorUnidad)} = ${unidades}`
}

/** Total con la misma cuenta que el servidor (TotalesCompra): bruto con descuento más gastos. */
export function totalCompra(lineas: LineaCompra[], descuentoPorcentaje: number, gastos: number): number {
  const bruto = lineas.reduce((acc, l) => acc + (subtotalDe(l) ?? 0), 0)
  return bruto * (1 - descuentoPorcentaje / 100) + gastos
}

/**
 * Detalles para PUT /Compras/{id}. Mientras es borrador el servidor acepta costo 0 (línea a medio
 * cargar); guardar la nota o confirmar exige costo > 0, y eso lo vuelve a validar el servidor.
 */
export function detallesParaServidor(lineas: LineaCompra[]) {
  return lineas.map((l) => ({
    productoId: l.productoId,
    cantidad: l.cantidad,
    costoUnitario: l.costoUnitario ?? 0,
    monedaCosto: l.monedaCosto ?? 'ARS',
    unidadCompra: l.unidad,
  }))
}

/** Línea del teléfono a partir del detalle que devuelve GET /Compras/{id}. */
export function lineaDesdeDetalle(d: CompraDetalle): LineaCompra {
  // Un borrador viejo en Pack se relee en unidades: ya no hay nivel Pack, y las unidades son múltiplo del pack.
  const esPack = d.unidadCompra === 'Pack'
  const ingresada = esPack ? d.cantidad : d.cantidadIngresada > 0 ? d.cantidadIngresada : d.cantidad
  return {
    productoId: d.productoId,
    nombre: d.nombreProducto,
    cantidad: ingresada,
    unidad: esPack ? 'Unidad' : d.unidadCompra,
    unidadesPorUnidad: esPack ? 1 : ingresada > 0 ? d.cantidad / ingresada : 1,
    costoUnitario: d.costoUnitarioBaseAmount > 0 ? d.costoUnitarioBaseAmount : null,
    monedaCosto: d.moneda ?? undefined,
  }
}

/** Umbral del aviso de cambio de costo (plan 9 §2.2): más del 50 % respecto del último. */
export const UMBRAL_CAMBIO_COSTO = 50

/**
 * Cuánto cambia el costo tipeado respecto del último costo del producto, en %. null si no hay
 * último costo (no llegó: sin permiso o nunca se compró) o si no cambia.
 */
export function cambioDeCosto(costo: number | null, ultimo: number | null | undefined): { pct: number; fuerte: boolean } | null {
  if (costo === null || costo <= 0 || ultimo == null || ultimo <= 0 || costo === ultimo) return null
  const pct = ((costo - ultimo) / ultimo) * 100
  return { pct, fuerte: Math.abs(pct) > UMBRAL_CAMBIO_COSTO }
}

/** Empaques en los que se puede comprar el producto: la regla única vive en `core/utils/empaque`. */
export function unidadesDisponibles(ficha: EmpaqueProducto | undefined) {
  return nivelesDeEmpaque(ficha)
}

/** Cuánto suma el "+" y de a cuánto va la cantidad: el pack en Unidad (igual que venta), 1 en bultos. */
export function pasoDeCantidad(unidad: UnidadCompra, ficha: EmpaqueProducto | undefined): number {
  return unidad === 'Unidad' ? pasoDeUnidad(ficha) : 1
}

/** Lleva una cantidad al paso de su nivel: hacia arriba (mínimo un paso) o hacia abajo (0 si no llega a un paso). */
export function ajustarAlPaso(unidad: UnidadCompra, cantidad: number, ficha: EmpaqueProducto | undefined, hacia: 'arriba' | 'abajo' = 'arriba'): number {
  const paso = pasoDeCantidad(unidad, ficha)
  if (paso <= 1) return cantidad
  return hacia === 'arriba' ? Math.max(paso, Math.ceil(cantidad / paso) * paso) : Math.floor(cantidad / paso) * paso
}

/** Línea nueva de un producto recién agregado: abre en `nivelInicial` (Bulto si hay) con la cantidad ajustada a su paso. */
export function lineaNueva(prod: { id: string; nombre: string } & EmpaqueProducto, cantidad: number): LineaCompra {
  const unidad = nivelInicial(prod)
  const unidadesPorUnidad = nivelesDeEmpaque(prod).find((n) => n.unidad === unidad)?.unidades ?? 1
  return { productoId: prod.id, nombre: prod.nombre, cantidad: ajustarAlPaso(unidad, cantidad, prod), unidad, unidadesPorUnidad, costoUnitario: null }
}

/** Cantidad válida: mayor a 0, entera en bultos y en Unidad múltiplo del pack. */
export function cantidadValida(unidad: UnidadCompra, cantidad: number | null, ficha: EmpaqueProducto | undefined): boolean {
  if (cantidad === null || cantidad <= 0) return false
  const paso = pasoDeCantidad(unidad, ficha)
  return unidad === 'Unidad' && paso === 1 ? true : Number.isInteger(cantidad) && cantidad % paso === 0
}

/** "Costo +4,5 % sobre la última compra ($ 710,00)." El importe del último costo llega ya formateado. */
export function textoDeCambioDeCosto(cambio: { pct: number; fuerte: boolean }, ultimoTexto: string): string {
  const signo = cambio.pct > 0 ? '+' : '−'
  return `Costo ${signo}${mostrarNumero(Math.round(Math.abs(cambio.pct) * 10) / 10)} % sobre la última compra (${ultimoTexto}).${cambio.fuerte ? ' Cambia más del 50 %: revisalo.' : ''} Al confirmar la compra, este pasa a ser el costo del producto.`
}

/** Empaques en los que se compra el producto; la línea suma el suyo si la ficha no lo trae (compra ya guardada). */
export function opcionesDeCompra(
  ficha: Parameters<typeof unidadesDisponibles>[0],
  linea: Pick<LineaCompra, 'unidad' | 'unidadesPorUnidad'>,
) {
  const opciones = unidadesDisponibles(ficha)
  if (!opciones.some((o) => o.unidad === linea.unidad)) opciones.push({ unidad: linea.unidad, unidades: linea.unidadesPorUnidad })
  return opciones
}
