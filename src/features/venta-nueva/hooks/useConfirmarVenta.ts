import { useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { ventasKeys } from '@/libs/api-client/ventas'
import type { VentaActionResponseDto, VentaDetalleDto } from '@/libs/api-client/types'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { aAlta, nuevaClaveIdempotencia, type Cabecera } from '../lib/payload'
import { ESTADO_PENDIENTE_AUTORIZACION, motivosAutorizacion } from '../lib/motivosAutorizacion'
import type { LineaCarrito } from '../lib/carrito'
import type { useBorradorVenta } from './useBorradorVenta'

interface Datos {
  clienteId: string
  esPedido: boolean
  lineas: LineaCarrito[]
  descuentoGeneral: number
  cabecera: Cabecera
  porcentajeCedido?: number
  borrador: ReturnType<typeof useBorradorVenta>
  alGuardar: () => void
}

/** El servidor pide justificación cuando un Pedido no tiene stock (CreateVentaCommandHandler). */
const pideMotivo = (e: unknown) => /justificaci[oó]n/i.test(mensajeDelServidor(e, ''))

/**
 * Confirmar (plan 9 §2.1, igual que la web). Presupuesto: el borrador autoguardado YA es el
 * presupuesto → POST /Ventas/{id}/guardar-presupuesto. Pedido: POST /Ventas con una clave de
 * idempotencia por alta (un doble toque o un reintento sin señal no duplica el pedido) y después
 * se descarta el borrador. Lo que decide el servidor (guardado o por autorizar y por qué) se muestra.
 */
export function useConfirmarVenta(d: Datos) {
  const router = useRouter()
  const qc = useQueryClient()
  const [clave] = useState(nuevaClaveIdempotencia)
  const [enviando, setEnviando] = useState(false)
  // El estado no alcanza como guardia: dos toques antes del re-render leen el mismo `enviando`.
  const enVuelo = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [pedirMotivo, setPedirMotivo] = useState(false)
  const sinStock = d.esPedido && d.lineas.some((l) => l.cantidad > l.producto.real)

  async function enviar(motivo?: string) {
    const { borrador: b } = d
    let r: VentaActionResponseDto
    if (!d.esPedido && b.borrador) {
      r = await api.post<VentaActionResponseDto>(`/api/v1/Ventas/${b.borrador.id}/guardar-presupuesto`, { ventaId: b.borrador.id, version: await b.flush() })
    } else {
      r = await api.post<VentaActionResponseDto>('/api/v1/Ventas', aAlta(d.lineas, d.descuentoGeneral, d.cabecera, {
        clienteId: d.clienteId, depositoId: DEPOSITO_CENTRAL_ID, esPedido: d.esPedido, claveIdempotencia: clave,
        motivoVentaSinStock: motivo, porcentajeComisionCedido: d.porcentajeCedido,
      }))
      // La venta ya existe: el borrador quedó huérfano. Si no se puede descartar, vence solo a las 48 h.
      if (b.borrador) await b.descartar().catch(() => undefined)
    }
    let titulo = d.esPedido ? 'Pedido guardado' : 'Presupuesto guardado'
    let mensaje = r.message
    if (d.esPedido) {
      const detalle = await api.get<VentaDetalleDto>(`/api/v1/Ventas/${r.ventaId}`).catch(() => null)
      const motivos = motivosAutorizacion(detalle?.venta.motivoPendienteAutorizacion)
      if (detalle?.venta.estado === ESTADO_PENDIENTE_AUTORIZACION) {
        titulo = 'Quedó por autorizar'
        mensaje = motivos.length ? `Porque ${motivos.join(', ')}. Te avisamos cuando lo resuelvan.` : r.message
      }
    }
    void qc.invalidateQueries({ queryKey: ventasKeys.all })
    // La venta ya está guardada: vaciar el carrito no puede disparar un PUT con items=[] al borrador.
    b.cerrar()
    d.alGuardar()
    router.replace(`/(tabs)/ventas/${r.ventaId}` as never)
    Alert.alert(titulo, mensaje)
  }

  async function confirmar(motivo?: string) {
    if (enVuelo.current) return
    if (sinStock && !motivo) return setPedirMotivo(true)
    enVuelo.current = true
    setEnviando(true)
    setError(null)
    try {
      await enviar(motivo)
      setPedirMotivo(false)
    } catch (e) {
      if (d.esPedido && pideMotivo(e) && !motivo) setPedirMotivo(true)
      setError(mensajeDelServidor(e, 'No se pudo guardar la venta.'))
    } finally {
      enVuelo.current = false
      setEnviando(false)
    }
  }

  return { confirmar, enviando, error, pedirMotivo, cerrarMotivo: () => setPedirMotivo(false) }
}
