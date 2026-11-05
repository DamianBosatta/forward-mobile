import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { esperaDeReintento } from '@/features/venta-sin-senal/hooks/useVentasSinSenal'
import { suscribirPosiciones, textoDePosiciones } from './colaPosiciones'
import { enviarPosiciones } from './registroGps'

/** El servidor admite 6 llamadas por minuto por usuario: menos que esto entre rondas podría dar 429. */
const ESPERA_MINIMA_MS = 60_000

/**
 * Sube lo que quedó sin mandar sin esperar otra lectura del GPS: al volver la señal, al abrir la app y después de
 * finalizar el viaje, cuando ya no hay más lecturas. Sin señal no intenta nada. Montado en `EnvioConsolaSinSenal`.
 */
export function useEnvioPosiciones() {
  const usuarioId = useAuthStore((s) => s.user?.id)
  const { isConnected } = useNetworkStatus()
  const texto = useSyncExternalStore(suscribirPosiciones, () => textoDePosiciones(usuarioId))
  const hayPendientes = useMemo(() => !!texto && texto !== '[]', [texto])

  const conSenal = useRef(isConnected)
  conSenal.current = isConnected
  const fallos = useRef(0)
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Una ronda que termina cuando ya cambió el usuario no programa nada: el reintento era de su cola.
  const usuarioActual = useRef(usuarioId)
  usuarioActual.current = usuarioId

  const enviar = useCallback(async () => {
    if (!usuarioId || conSenal.current === false) return
    if (reintento.current) clearTimeout(reintento.current)
    reintento.current = null
    const r = await enviarPosiciones(usuarioId)
    if (usuarioActual.current !== usuarioId) return
    if (r === 'sinSenal') fallos.current += 1
    else fallos.current = 0
    if (r === 'sinSenal' || r === 'quedan') {
      reintento.current = setTimeout(() => { void enviar() }, Math.max(ESPERA_MINIMA_MS, esperaDeReintento(fallos.current)))
    }
  }, [usuarioId])

  useEffect(() => {
    if (isConnected === false || !hayPendientes) return
    fallos.current = 0
    void enviar()
  }, [isConnected, hayPendientes, enviar])

  // Cambiar de usuario, cerrar sesión o perder la señal corta el reintento; al volver la señal arranca de nuevo.
  useEffect(() => () => {
    if (reintento.current) clearTimeout(reintento.current)
    reintento.current = null
    fallos.current = 0
  }, [usuarioId, isConnected])
}
