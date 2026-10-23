import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { api } from '@/core/api/client'
import type { BorradorVenta } from '@/libs/api-client/ventas'
import { limpiarBorradoresResueltos, limpiarEnviadasViejas, parsearCola, suscribirCola, textoDeCola, type VentaEnCola } from '../lib/cola'
import { enviarPendientes } from '../lib/enviar'

const PRIMERA_ESPERA_MS = 15_000
const ESPERA_MAXIMA_MS = 10 * 60_000

/** Cuánto esperar antes del reintento número `intento` (1, 2, …): se duplica, hasta 10 minutos. */
export function esperaDeReintento(intento: number): number {
  return Math.min(PRIMERA_ESPERA_MS * 2 ** Math.max(0, intento - 1), ESPERA_MAXIMA_MS)
}

/** Solo lectura: las ventas guardadas en el teléfono del usuario logueado (sin enviar nada: eso lo hace useVentasSinSenal). */
export function useColaDelUsuario(): VentaEnCola[] {
  const usuarioId = useAuthStore((s) => s.user?.id)
  const texto = useSyncExternalStore(suscribirCola, () => textoDeCola(usuarioId))
  return useMemo(() => parsearCola(texto), [texto])
}

/**
 * Las ventas guardadas en el teléfono del usuario logueado (V9), y su envío: cuando hay señal
 * (`useNetworkStatus`, NetInfo) manda lo que espera; si se corta, reintenta más tarde, cada vez
 * esperando más, y nunca mientras no hay señal. Las enviadas de otro día se limpian al abrir.
 */
export function useVentasSinSenal() {
  const usuarioId = useAuthStore((s) => s.user?.id)
  const { isConnected } = useNetworkStatus()
  const items = useColaDelUsuario()
  const grupos = useMemo(() => agrupar(items), [items])

  const conSenal = useRef(isConnected)
  conSenal.current = isConnected
  const fallos = useRef(0)
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null)
  // El usuario de ahora: una ronda que termina cuando ya cambió no programa nada (el reintento es de su cola).
  const usuarioActual = useRef(usuarioId)
  usuarioActual.current = usuarioId

  const enviar = useCallback(async () => {
    if (!usuarioId || conSenal.current === false) return
    if (reintento.current) clearTimeout(reintento.current)
    reintento.current = null
    const r = await enviarPendientes(usuarioId)
    if (usuarioActual.current !== usuarioId) return
    if (r !== 'sinSenal') {
      fallos.current = 0
      return
    }
    fallos.current += 1
    reintento.current = setTimeout(() => { void enviar() }, esperaDeReintento(fallos.current))
  }, [usuarioId])

  useEffect(() => {
    if (usuarioId) limpiarEnviadasViejas(usuarioId)
  }, [usuarioId])

  const hayEsperando = grupos.esperando.length > 0
  useEffect(() => {
    if (isConnected === false || !hayEsperando) return
    // Volvió la señal (o llegó una venta nueva): se manda ya, sin esperar el reintento.
    fallos.current = 0
    void enviar()
  }, [isConnected, hayEsperando, enviar])

  // Cambiar de usuario o cerrar sesión (y desmontar) corta el reintento y la cuenta de fallos: son de la cola de quien se fue.
  useEffect(() => () => {
    if (reintento.current) clearTimeout(reintento.current)
    reintento.current = null
    fallos.current = 0
  }, [usuarioId])

  // Las que quedaron en Borradores se sacan de la cola cuando el vendedor ya las resolvió (confirmó o descartó).
  const enBorradores = items.flatMap((v) => (v.estado.tipo === 'enBorradores' ? [v.estado.ventaId] : [])).join(',')
  useEffect(() => {
    if (!usuarioId || !enBorradores || isConnected === false) return
    let vigente = true
    api.get<BorradorVenta[]>('/api/v1/Ventas/borradores/mios')
      .then((mios) => { if (vigente && Array.isArray(mios)) limpiarBorradoresResueltos(usuarioId, mios.map((b) => b.id)) })
      .catch(() => undefined) // sin lista no se saca nada: se vuelve a probar con la próxima señal
    return () => { vigente = false }
  }, [usuarioId, enBorradores, isConnected])

  return { items, ...grupos, sinSenal: isConnected === false, enviarAhora: enviar }
}

/** Esperando (en el teléfono), para revisar (el servidor la rechazó o quedó en Borradores) y enviadas. */
export function agrupar(items: VentaEnCola[]) {
  return {
    esperando: items.filter((v) => v.estado.tipo === 'esperando'),
    paraRevisar: items.filter((v) => v.estado.tipo === 'revisar' || v.estado.tipo === 'enBorradores'),
    enviadas: items.filter((v) => v.estado.tipo === 'enviada'),
  }
}
