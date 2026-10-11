import type { CatalogoStockItem } from '@/libs/api-client'
import type { SocioDetailDto, VentaDetalleDto, VentaDetalleItemDto, VentaHeaderDto } from '@/libs/api-client/types'
import { METODO_ENTREGA, type MetodoEntregaValue } from '@/features/ventas/lib/venta-form-retiro'
import { aElegido, type ClienteElegido } from '@/features/clientes/lib/recientes'
import type { LineaCarrito } from './carrito'
import { aAutoguardado, type AutoguardadoVenta } from './payload'
import { codigoDeVenta, tipoDeVenta } from './ventaGuardada'

/**
 * Llevar una venta del servidor a la pantalla de venta (retomar un borrador; después editar y
 * duplicar). Las líneas usan la fila del catálogo de venta de HOY (precio, piso, venta mínima y
 * disponibilidad del servidor); si el producto ya no está en el catálogo, la línea se arma con lo
 * que trae la venta y el servidor la vuelve a validar al guardar.
 */
export interface VentaCargada {
  cliente: ClienteElegido
  lineas: LineaCarrito[]
  descuentoGeneral: number
  cabecera: { metodoEntrega: MetodoEntregaValue; fecha: string | null; flete: number; observaciones: string }
  version: number
  tipo: 'Pedido' | 'Presupuesto'
  /** A00001 (o el comienzo del id si no tiene número). */
  codigo: string
}

function productoDesdeItem(it: VentaDetalleItemDto): CatalogoStockItem {
  return {
    id: it.productoId, nombre: it.productoNombre, precioVenta: it.precioUnitario, precioConOferta: null,
    precioCompraBase: it.precioCostoSnapshot ?? null, precioMinimoRentable: it.precioMinimoRentable ?? null, costoDirecto: null,
    deposito: it.stockDeposito, reservado: it.stockReservado, real: it.stockDisponible, virtual: it.stockVirtual, stockMinimo: 0,
    puedeVenderse: it.stockDisponible > 0, esPadreDeVariantes: false, unidadMedida: 'Unidad', bultoContenido: 1,
    fraccionMinimaVenta: 'Unidad', ventaMinimaUnidades: 1, almacenes: [],
  }
}

export function lineasDesdeVenta(detalles: VentaDetalleItemDto[], catalogo: CatalogoStockItem[]): LineaCarrito[] {
  return detalles.map((it) => ({
    productoId: it.productoId,
    producto: catalogo.find((p) => p.id === it.productoId) ?? productoDesdeItem(it),
    cantidad: it.cantidad,
    descuentoPct: it.porcentajeDescuentoItem,
  }))
}

// Como la web (resolveMetodoEntregaDesdeHeader): manda el nombre canónico; el número es el respaldo.
const POR_NOMBRE: Record<string, MetodoEntregaValue> = {
  LogisticaPropia: METODO_ENTREGA.Logistica, RetiroEnLocal: METODO_ENTREGA.RetiroEnLocal, Expreso: METODO_ENTREGA.Expreso,
}
const METODOS: number[] = Object.values(METODO_ENTREGA)

/** La fecha viaja como el día "YYYY-MM-DD" que eligió el vendedor: se toma tal cual, sin pasar por zonas horarias. */
export function cabeceraDesdeVenta(h: VentaHeaderDto): VentaCargada['cabecera'] {
  const metodo = (h.metodoEntregaNombre ? POR_NOMBRE[h.metodoEntregaNombre] : undefined)
    ?? (METODOS.includes(h.metodoEntrega ?? -1) ? (h.metodoEntrega as MetodoEntregaValue) : METODO_ENTREGA.Logistica)
  const dia = h.fechaEntrega?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  return { metodoEntrega: metodo, fecha: dia, flete: h.cargoFleteAmount ?? 0, observaciones: h.observaciones ?? '' }
}

/** Lo que el servidor tiene de la venta, en la misma forma que el snapshot del autoguardado (para compararlos). */
export const autoguardadoDesdeVenta = (v: VentaDetalleDto): AutoguardadoVenta =>
  aAutoguardado(lineasDesdeVenta(v.detalles, []), v.venta.porcentajeDescuento, cabeceraDesdeVenta(v.venta))

export function ventaCargada(venta: VentaDetalleDto, socio: SocioDetailDto, catalogo: CatalogoStockItem[]): VentaCargada {
  return {
    cliente: aElegido(socio),
    lineas: lineasDesdeVenta(venta.detalles, catalogo),
    descuentoGeneral: venta.venta.porcentajeDescuento,
    cabecera: cabeceraDesdeVenta(venta.venta),
    version: venta.venta.version,
    tipo: tipoDeVenta(venta.venta),
    codigo: codigoDeVenta(venta.venta),
  }
}
