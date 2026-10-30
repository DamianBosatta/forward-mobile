import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'

/**
 * Hook Senior para gestión de red.
 * Sincroniza el estado de red de React Native con el OnlineManager de TanStack Query.
 */
export function useNetworkStatus({ desconocidoCuentaComoSinRed = true }: { desconocidoCuentaComoSinRed?: boolean } = {}) {
  const [isConnected, setIsConnected] = useState<boolean | null>(true)

  useEffect(() => {
    // 1. Vincular NetInfo con React Query para que las queries reintenten auto al volver el wifi
    return NetInfo.addEventListener((state) => {
      if (!desconocidoCuentaComoSinRed) {
        // Alcanzabilidad desconocida (null) no es "sin red": solo un false afirmado lo es.
        // No toca el OnlineManager: de eso se ocupa quien usa el modo por defecto (app/_layout).
        setIsConnected(state.isConnected !== false && state.isInternetReachable !== false)
        return
      }
      const status = !!state.isConnected && !!state.isInternetReachable
      setIsConnected(status)
      onlineManager.setOnline(status)
    })
  }, [desconocidoCuentaComoSinRed])

  return { isConnected }
}
