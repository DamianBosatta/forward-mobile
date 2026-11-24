import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { esSinRespuesta } from '@/core/api/errores'
import { useVistaPreviaVenta } from '@/libs/api-client/ventas'
import { aAlta, type Cabecera } from '../lib/payload'
import type { LineaCarrito } from '../lib/carrito'
import { desgloseDe, firmaDeVistaPrevia, type TotalConIva } from '../lib/totalConIva'

interface Datos {
  cliente: { id: string } | null
  esPedido: boolean
  lineas: LineaCarrito[]
  descuentoGeneral: number
  cabecera: Cabecera
  depositoId: string
  porcentajeCedido?: number
  /** Falso con el flete o la cesión inválidos: no se pide la vista previa. */
  habilitado: boolean
}

/**
 * La vista previa del servidor de un pedido (motivos de autorización, rechazos) y, con el tilde de factura, el total con
 * IVA y su desglose (IVA encima del neto). El IVA nunca se calcula acá: `totalConIva` solo dice si la respuesta del
 * servidor corresponde a la venta que se está por mandar.
 */
export function useTotalConIva(d: Datos) {
  const inmediato = d.cliente && d.lineas.length > 0
    ? aAlta(d.lineas, d.descuentoGeneral, d.cabecera, {
      clienteId: d.cliente.id, depositoId: d.depositoId, esPedido: d.esPedido, claveIdempotencia: '',
      motivoVentaSinStock: 'Vista previa', porcentajeComisionCedido: d.porcentajeCedido,
    })
    : null
  const cuerpo = useDebouncedValue(inmediato)
  const vistaPrevia = useVistaPreviaVenta(cuerpo, d.habilitado)
  const reintentar = () => { void vistaPrevia.refetch() }
  const conIva = d.cabecera.conFactura === true && !!inmediato && d.habilitado
  const totalConIva = ((): TotalConIva => {
    if (!conIva) return { estado: 'sin' }
    // Lo que se ve debe ser la respuesta a ESTE cuerpo: ni la de antes de la última edición ni la del reintento en curso.
    const vigente = !vistaPrevia.isPlaceholderData
    if (firmaDeVistaPrevia(inmediato) !== firmaDeVistaPrevia(cuerpo)) return { estado: 'calculando' }
    if (vistaPrevia.isError && !vistaPrevia.isFetching) {
      return { estado: 'error', sinSenal: vistaPrevia.fetchStatus === 'paused' || esSinRespuesta(vistaPrevia.error) }
    }
    if (vistaPrevia.isSuccess && vigente && !vistaPrevia.isFetching) {
      const total = vistaPrevia.data?.total
      return { estado: 'listo', total: typeof total === 'number' ? total : null, desglose: desgloseDe(vistaPrevia.data) }
    }
    // Sin red la consulta queda en pausa: no se espera una respuesta que no va a llegar.
    if (vistaPrevia.fetchStatus === 'paused') return { estado: 'error', sinSenal: true }
    return { estado: 'calculando' }
  })()
  return { vistaPrevia, totalConIva, reintentar }
}
