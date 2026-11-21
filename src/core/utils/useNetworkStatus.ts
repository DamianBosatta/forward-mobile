import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'

/**
 * Hook Senior para gestión de red.
 * Sincroniza el estado de red de React Native con el OnlineManager de TanStack Query.
 *
 * Alcanzabilidad desconocida (`isInternetReachable === null`, lo normal recién arrancada la app) no es "sin red":
 * solo un `false` afirmado lo es (RED-03), en los dos modos.
 * `desconocidoCuentaComoSinRed` ya no cambia cómo se lee `null` (el nombre quedó de antes); solo decide quién maneja
 * el OnlineManager: el modo por defecto (el aviso global, app/_layout) lo actualiza; con `false` no lo toca.
 */
export function useNetworkStatus({ desconocidoCuentaComoSinRed = true }: { desconocidoCuentaComoSinRed?: boolean } = {}) {
  const [isConnected, setIsConnected] = useState<boolean | null>(true)

  useEffect(() => {
    // 1. Vincular NetInfo con React Query para que las queries reintenten auto al volver el wifi
    return NetInfo.addEventListener((state) => {
      const status = state.isConnected !== false && state.isInternetReachable !== false
      setIsConnected(status)
      if (desconocidoCuentaComoSinRed) onlineManager.setOnline(status)
    })
  }, [desconocidoCuentaComoSinRed])

  return { isConnected }
}
