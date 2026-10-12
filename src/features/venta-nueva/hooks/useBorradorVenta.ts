import { useCallback, useEffect, useRef, useState } from 'react'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { VentaDetalleDto } from '@/libs/api-client/types'
import { guardarBorradorVenta, servidorGuardaElTipo, useDescartarBorradorVenta, useIniciarBorradorVenta, ventasKeys } from '@/libs/api-client/ventas'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useAutoguardado } from './useAutoguardado'
import { autoguardadoDesdeVenta } from '../lib/hidratar'
import { aAutoguardado, hastaElTope, superaElTope, type AutoguardadoVenta } from '../lib/payload'

/**
 * Borrador de la venta nueva (mismo flujo que la web): nace en el servidor al elegir el cliente y
 * desde ahí se autoguarda. Si no se puede crear, la venta se sigue armando sin autoguardado.
 *
 * `topePedido`: el tope de descuento del vendedor cuando se arma un Pedido (0 o ausente: no aplica). Un
 * servidor que guarda el tipo del borrador (forward-system #883) acepta en el autoguardado de un Pedido
 * un descuento sobre el tope; uno viejo crea todo borrador como Presupuesto y lo rechaza, así que ahí el
 * autoguardado manda cada descuento hasta el tope (`retenido`) y el elegido viaja en el POST /Ventas final.
 */
export function useBorradorVenta(valores: AutoguardadoVenta, topePedido = 0) {
  // `base`: lo que tiene el servidor al nacer el borrador (vacío); sin base, lo que hay en pantalla (retomar).
  // `guardaTipo`: el servidor guarda el tipo del borrador (true), no (false), o no se pudo saber (null / aún sin preguntar: se recorta).
  const [borrador, setBorrador] = useState<{ id: string; version: number; base?: AutoguardadoVenta; guardaTipo?: boolean | null } | null>(null)
  // Intentos de preguntarlo por borrador (máx. 2: el primero y un reintento en el siguiente cambio), y los valores del último fallo.
  const intentos = useRef(0)
  const valoresDelFallo = useRef<string | null>(null)
  const preguntando = useRef(false)
  const [errorAlCrear, setErrorAlCrear] = useState<string | null>(null)
  const iniciar = useIniciarBorradorVenta()
  const descartarMut = useDescartarBorradorVenta()
  const qc = useQueryClient()
  const guardar = useCallback(
    async (v: AutoguardadoVenta, version: number) => {
      const r = await guardarBorradorVenta(borrador!.id, version, { ...v })
      // El detalle en caché ya no es el del servidor: quien reabra el borrador tiene que traer el vigente (sin recargar ahora: nadie lo está mirando).
      void qc.invalidateQueries({ queryKey: ventasKeys.detail(borrador!.id), refetchType: 'none' })
      return r.version
    },
    [borrador, qc],
  )
  // Tras un fallo sin respuesta, lo que el servidor tiene de verdad (el PUT pudo haberse aplicado).
  const releer = useCallback(async () => {
    const d = await api.get<VentaDetalleDto>(`/api/v1/Ventas/${borrador!.id}`)
    return { version: d.venta.version, valores: autoguardadoDesdeVenta(d) }
  }, [borrador])
  const claveValores = JSON.stringify(valores)
  useEffect(() => {
    if (!borrador || topePedido <= 0 || typeof borrador.guardaTipo === 'boolean' || preguntando.current) return
    if (intentos.current >= 2 || (borrador.guardaTipo === null && valoresDelFallo.current === claveValores)) return
    const id = borrador.id
    preguntando.current = true
    intentos.current += 1
    void servidorGuardaElTipo(id).then((guardaTipo) => {
      preguntando.current = false
      valoresDelFallo.current = guardaTipo === null ? claveValores : null
      setBorrador((b) => (b && b.id === id ? { ...b, guardaTipo } : b))
    })
  }, [borrador, topePedido, claveValores])
  const retenido = topePedido > 0 && !borrador?.guardaTipo && superaElTope(valores, topePedido)
  const autoguardado = useAutoguardado({
    borradorId: borrador?.id, versionInicial: borrador?.version ?? 0, base: borrador?.base,
    valores: retenido ? hastaElTope(valores, topePedido) : valores, guardar, releer,
  })

  const crear = async (clienteId: string, tipoOperacion: 'Pedido' | 'Presupuesto') => {
    setErrorAlCrear(null)
    try {
      const r = await iniciar.mutateAsync({ clienteId, depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion })
      // El POST no devuelve el tipo: un Presupuesto no lo necesita, y para un Pedido se pregunta si el servidor lo guardó.
      const guardaTipo = tipoOperacion === 'Pedido' ? await servidorGuardaElTipo(r.ventaId) : false
      // Lo que se cargó mientras el POST estaba en vuelo no está en el servidor: el autoguardado lo manda.
      intentos.current = 1
      valoresDelFallo.current = guardaTipo === null ? JSON.stringify(valores) : null
      setBorrador({ id: r.ventaId, version: r.version, base: aAutoguardado([]), guardaTipo })
    } catch (e) {
      setErrorAlCrear(mensajeDelServidor(e, 'No se pudo crear el borrador.'))
    }
  }
  /** Retoma un borrador que ya existe en el servidor (no crea otro). */
  const retomar = (id: string, version: number) => {
    intentos.current = 0
    valoresDelFallo.current = null
    setBorrador({ id, version })
  }
  const descartar = async () => {
    if (borrador) await descartarMut.mutateAsync(borrador.id)
    setBorrador(null)
  }

  const etiqueta = iniciar.isPending ? 'Creando borrador…'
    : errorAlCrear ? 'Sin autoguardado'
    : !borrador ? undefined
    : autoguardado.estado === 'guardando' ? 'Guardando…'
    : autoguardado.estado === 'error' || autoguardado.estado === 'conflicto' ? 'Sin guardar' : 'Guardado'

  return { borrador, errorAlCrear, retenido, crear, retomar, descartar, etiqueta, ...autoguardado }
}
