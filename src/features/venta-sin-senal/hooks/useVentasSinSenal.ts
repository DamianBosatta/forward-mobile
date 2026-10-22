import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { limpiarEnviadasViejas, parsearCola, suscribirCola, textoDeCola, type VentaEnCola } from '../lib/cola'
import { enviarPendientes } from '../lib/enviar'

const PRIMERA_ESPERA_MS = 15_000
const ESPERA_MAXIMA_MS = 10 * 60_000

/** Cuánto esperar antes del reintento número `intento` (1, 2, …): se duplica, hasta 10 minutos. */
export function esperaDeReintento(intento: number): number {
  return Math.min(PRIMERA_ESPERA_MS * 2 ** Math.max(0, intento - 1), ESPERA_MAXIMA_MS)
}

/**
 * Las ventas guardadas en el teléfono del usuario logueado (V9), y su envío: cuando hay señal
 * (`useNetworkStatus`, NetInfo) manda lo que espera; si se corta, reintenta más tarde, cada vez
 * esperando más, y nunca mientras no hay señal. Las enviadas de otro día se limpian al abrir.
 */
export function useVentasSinSenal() {
  const usuarioId = useAuthStore((s) => s.user?.id)
  const { isConnected } = useNetworkStatus()
  const texto = useSyncExternalStore(suscribirCola, () => textoDeCola(usuarioId))
  const items = useMemo(() => parsearCola(texto), [texto])
  const grupos = useMemo(() => agrupar(items), [items])

  const conSenal = useRef(isConnected)
  conSenal.current = isConnected
  const fallos = useRef(0)
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enviar = useCallback(async () => {
    if (!usuarioId || conSenal.current === false) return
    if (reintento.current) clearTimeout(reintento.current)
    reintento.current = null
    const r = await enviarPendientes(usuarioId)
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

  useEffect(() => () => { if (reintento.current) clearTimeout(reintento.current) }, [])

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
