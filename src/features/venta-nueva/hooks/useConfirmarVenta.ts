import { useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/core/api/client'
import { esError } from '@/core/api/errores'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { ventasKeys } from '@/libs/api-client/ventas'
import { inicioKeys } from '@/core/query/queryClient'
import type { VentaActionResponseDto, VentaDetalleDto } from '@/libs/api-client/types'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { ClienteNombrable } from '@/features/clientes/lib/cliente'
import { encolarSiFaltaSenal, loQueVio } from '@/features/venta-sin-senal'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { aAlta, aAutoguardado, errorDeAltaVenta, nuevaClaveIdempotencia, type Cabecera } from '../lib/payload'
import { motivosAutorizacion } from '../lib/motivosAutorizacion'
import { esEstadoVenta } from '@/core/constants/estados'
import type { LineaCarrito } from '../lib/carrito'
import type { useBorradorVenta } from './useBorradorVenta'

interface Datos {
  clienteId: string
  /** Para mostrarlo en Pendientes si la venta queda en el teléfono (V9). */
  cliente?: ClienteNombrable | null
  esPedido: boolean
  lineas: LineaCarrito[]
  descuentoGeneral: number
  cabecera: Cabecera
  porcentajeCedido?: number
  borrador: ReturnType<typeof useBorradorVenta>
  alGuardar: () => void
  /** Editar una venta existente: PUT /Ventas/{id} con su versión, sin borrador. */
  edicion?: { ventaId: string; version: number } | null
}

/** El servidor pide justificación cuando un Pedido no tiene stock (CreateVentaCommandHandler). */
const pideMotivo = (e: unknown) => esError(e, 'VentaFaltaStockSinJustificacion')
/** El servidor devolvió la venta que ya existía con esa clave (CreateVentaCommandHandler, operación repetida). */
const yaExistia = (r: VentaActionResponseDto) => /ya hab[ií]a sido creada/i.test(r.message ?? '')
/**
 * Estado y motivos que el servidor nuevo manda en la respuesta del alta (forward-system #916), leídos de la venta
 * grabada. Sin `estado` es el servidor viejo; un pedido por autorizar sin sus motivos tampoco alcanza: se lee la venta.
 */
const resultadoDelAlta = (r: VentaActionResponseDto) => {
  if (typeof r.estado !== 'number') return null
  if (esEstadoVenta(r.estado, 'PendienteAutorizacion') && typeof r.motivoPendienteAutorizacion !== 'number') return null
  return { estado: r.estado, motivos: r.motivoPendienteAutorizacion }
}
/** La clave ya grabó otro pedido: 409 con la venta que quedó en `data` (forward-system #867, CreateVentaCommandHandler). */
const ventaConOtroCuerpo = (e: unknown): VentaActionResponseDto | null => {
  if (!esError(e, 'ClaveIdempotenciaConOtroCuerpo')) return null
  const v = e.data as Partial<VentaActionResponseDto> | undefined
  return typeof v?.ventaId === 'string' && v.ventaId ? (v as VentaActionResponseDto) : null
}
/**
 * 409 `Duplicado` por la restricción única (ErrorHandlerMiddleware, 23505): otro intento con la misma clave
 * se estaba grabando. Los demás 409 (clave foránea, concurrencia) llevan otro código y no son eso.
 */
const claveEnCurso = (e: unknown) => esError(e, 'Duplicado')
const CLAVE_EN_CURSO = 'Este pedido ya se estaba grabando. Tocá Confirmar de nuevo para ver cómo quedó: no se va a duplicar.'

/**
 * Confirmar (plan 9 §2.1, igual que la web). Presupuesto: el borrador autoguardado YA es el
 * presupuesto → POST /Ventas/{id}/guardar-presupuesto. Pedido: POST /Ventas con una clave de
 * idempotencia por alta (un doble toque o un reintento sin señal no duplica el pedido) y después
 * se descarta el borrador. La clave se reusa SIEMPRE en la pantalla: un pedido duplicado es peor
 * que perder ediciones. Con la misma clave el servidor devuelve la venta que ya existe; si el pedido
 * cambió desde un intento sin respuesta, se avisa y se lleva a esa venta para revisarla. El servidor
 * nuevo lo dice con un 409 con código y la venta en `data`; el viejo (o los campos que no compara)
 * con el 200 «ya había sido creada», que se cruza con los intentos sin respuesta. Lo que decide el servidor (guardado o por autorizar y por qué) se muestra.
 */
export function useConfirmarVenta(d: Datos) {
  const router = useRouter()
  const qc = useQueryClient()
  const usuarioId = useAuthStore((s) => s.user?.id)
  const [clave] = useState(nuevaClaveIdempotencia)
  // Cuerpos (sin la clave) de los intentos de alta que quedaron sin respuesta: alguno pudo grabarse.
  const sinRespuesta = useRef(new Set<string>())
  const [enviando, setEnviando] = useState(false)
  // El estado no alcanza como guardia: dos toques antes del re-render leen el mismo `enviando`.
  const enVuelo = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [pedirMotivo, setPedirMotivo] = useState(false)
  // Al editar, el stock del catálogo no cuenta lo que esta venta ya reservó: el motivo lo pide el servidor si hace falta.
  const sinStock = !d.edicion && d.esPedido && d.lineas.some((l) => l.cantidad > l.producto.disponible)

  async function enviar(motivo?: string) {
    const { borrador: b } = d
    let r: VentaActionResponseDto
    let conLoDeAntes = false
    if (d.edicion) {
      // Igual que la web (buildUpdateVentaPayload): la cesión viaja solo si se cambió; ausente = no tocar.
      r = await api.put<VentaActionResponseDto>(`/api/v1/Ventas/${d.edicion.ventaId}`, {
        ...aAutoguardado(d.lineas, d.descuentoGeneral, d.cabecera), id: d.edicion.ventaId, version: d.edicion.version,
        ...(motivo?.trim() ? { motivoVentaSinStock: motivo.trim() } : {}),
        ...(d.esPedido && d.porcentajeCedido ? { porcentajeComisionCedido: d.porcentajeCedido } : {}),
        // buildUpdateVentaPayload de la web: el tilde viaja si ya tiene valor; ausente = no tocar.
        ...(d.cabecera.conFactura !== undefined ? { conFactura: d.cabecera.conFactura } : {}),
      })
    } else if (!d.esPedido && b.borrador) {
      r = await api.post<VentaActionResponseDto>(`/api/v1/Ventas/${b.borrador.id}/guardar-presupuesto`, { ventaId: b.borrador.id, version: await b.flush() })
    } else {
      const cuerpo = (claveIdempotencia: string) => aAlta(d.lineas, d.descuentoGeneral, d.cabecera, {
        clienteId: d.clienteId, depositoId: DEPOSITO_CENTRAL_ID, esPedido: d.esPedido, claveIdempotencia,
        motivoVentaSinStock: motivo, porcentajeComisionCedido: d.porcentajeCedido,
      })
      const invalido = errorDeAltaVenta(cuerpo(clave))
      if (invalido) throw new Error(invalido)
      const firma = JSON.stringify(cuerpo(''))
      try {
        r = await api.post<VentaActionResponseDto>('/api/v1/Ventas', cuerpo(clave))
        // Grabada por un intento anterior con otro cuerpo: las ediciones de después no están en la venta.
        conLoDeAntes = yaExistia(r) && [...sinRespuesta.current].some((f) => f !== firma)
      } catch (e) {
        const grabada = ventaConOtroCuerpo(e)
        if (!grabada) {
          // Sin respuesta: no llegó (red) o un gateway cortó (5xx); el alta pudo haberse grabado igual.
          if (!(e instanceof ApiError) || e.status >= 500) sinRespuesta.current.add(firma)
          // Sin señal (V9): la venta queda en el teléfono con esta misma clave y se manda sola al volver la red.
          const enCola = encolarSiFaltaSenal(usuarioId, e, { alta: cuerpo(clave), cliente: d.cliente ?? {}, visto: loQueVio(d.lineas, d.descuentoGeneral, d.cabecera.flete) })
          if (enCola) {
            b.cerrar()
            d.alGuardar()
            Alert.alert('Sin señal', 'La venta queda en el teléfono y se manda sola cuando vuelva la señal. La ves en Pendientes.')
            router.replace('/(tabs)/ventas' as never)
            return
          }
          // La clave sigue siendo la misma: el reintento devuelve la venta o el 409 con código.
          if (claveEnCurso(e)) throw new Error(CLAVE_EN_CURSO)
          throw e
        }
        r = grabada
        conLoDeAntes = true
      }
      // La venta ya existe: el borrador quedó huérfano. Si no se puede descartar, vence solo a las 48 h.
      if (b.borrador) await b.descartar().catch(() => undefined)
    }
    // Reintento idéntico: el texto del servidor («…clave de idempotencia (operación repetida)») es técnico.
    let mensaje = yaExistia(r) ? 'El pedido ya estaba grabado.' : r.message
    if (d.esPedido) {
      // Servidor nuevo: el alta ya dice cómo quedó. Viejo (o editar): se lee la venta, como antes.
      const resultado = resultadoDelAlta(r)
        ?? await api.get<VentaDetalleDto>(`/api/v1/Ventas/${r.ventaId}`)
          .then((detalle) => ({ estado: detalle.venta.estado, motivos: detalle.venta.motivoPendienteAutorizacion }))
          .catch(() => null)
      const motivos = motivosAutorizacion(resultado?.motivos)
      if (esEstadoVenta(resultado?.estado, 'PendienteAutorizacion') && motivos.length) {
        mensaje = `Quedó por autorizar porque ${motivos.join(', ')}. Te avisamos cuando lo resuelvan.`
      }
    }
    if (conLoDeAntes) mensaje = 'El pedido ya se había grabado con lo de antes. Revisalo y editalo si cambiaste algo.'
    void qc.invalidateQueries({ queryKey: ventasKeys.all })
    // No es una mutación de react-query: Inicio (que el QueryClient refresca tras cada mutación) se marca a mano.
    void qc.invalidateQueries({ queryKey: inicioKeys.all })
    // La venta ya está guardada: vaciar el carrito no puede disparar un PUT con items=[] al borrador.
    b.cerrar()
    d.alGuardar()
    // Lámina Guardada: el resumen, lo que dijo el servidor y las acciones (compartir, convertir, agendar, anular).
    router.replace({ pathname: '/(tabs)/ventas/guardada', params: { id: r.ventaId, mensaje } } as never)
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
