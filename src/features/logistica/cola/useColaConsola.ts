import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { safeHaptics } from '@/core/utils/haptics'
import { logisticaKeys } from '@/libs/api-client/logistica'
import { esperaDeReintento } from '@/features/venta-sin-senal/hooks/useVentasSinSenal'
import { parsearCola, suscribirCola, textoDeCola, type AccionEnCola } from './colaConsola'
import { enviarPendientesConsola } from './enviarConsola'

/** Solo lectura: lo que el chofer logueado dejó en el teléfono (sin enviar nada: eso lo hace `useEnvioConsolaSinSenal`). */
export function useColaConsola(): { items: AccionEnCola[]; esperando: AccionEnCola[]; paraRevisar: AccionEnCola[] } {
  const usuarioId = useAuthStore((s) => s.user?.id)
  const texto = useSyncExternalStore(suscribirCola, () => textoDeCola(usuarioId))
  return useMemo(() => {
    const items = parsearCola(texto)
    return {
      items,
      esperando: items.filter((a) => a.estado.tipo === 'esperando'),
      paraRevisar: items.filter((a) => a.estado.tipo === 'revisar'),
    }
  }, [texto])
}

/**
 * El envío: cuando hay señal (`useNetworkStatus`, NetInfo) manda lo que espera, en orden; si se corta, reintenta más
 * tarde, cada vez esperando más, y nunca mientras no hay señal. Se monta una vez en la app (`EnvioConsolaSinSenal`).
 */
export function useEnvioConsolaSinSenal() {
  const usuarioId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()
  const { isConnected } = useNetworkStatus()
  const { esperando } = useColaConsola()

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
    const r = await enviarPendientesConsola(usuarioId, {
      alEnviar: (hojaDeRutaId) => { void qc.invalidateQueries({ queryKey: logisticaKeys.hojaRuta(hojaDeRutaId) }) },
      alFallar: () => safeHaptics.notification('warning'),
    })
    if (usuarioActual.current !== usuarioId) return
    if (r !== 'sinSenal') {
      fallos.current = 0
      return
    }
    fallos.current += 1
    reintento.current = setTimeout(() => { void enviar() }, esperaDeReintento(fallos.current))
  }, [usuarioId, qc])

  const hayEsperando = esperando.length > 0
  useEffect(() => {
    if (isConnected === false || !hayEsperando) return
    // Volvió la señal (o llegó una acción nueva): se manda ya, sin esperar el reintento.
    fallos.current = 0
    void enviar()
  }, [isConnected, hayEsperando, enviar])

  // Cambiar de usuario o cerrar sesión (y desmontar) corta el reintento y la cuenta de fallos: son de la cola de quien se fue.
  useEffect(() => () => {
    if (reintento.current) clearTimeout(reintento.current)
    reintento.current = null
    fallos.current = 0
  }, [usuarioId])

  return { enviarAhora: enviar }
}
