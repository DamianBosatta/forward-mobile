import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'

/**
 * Hook Senior para gestión de red.
 * Sincroniza el estado de red de React Native con el OnlineManager de TanStack Query.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true)

  useEffect(() => {
    // 1. Vincular NetInfo con React Query para que las queries reintenten auto al volver el wifi
    return NetInfo.addEventListener((state) => {
      const status = !!state.isConnected && !!state.isInternetReachable
      setIsConnected(status)
      onlineManager.setOnline(status)
    })
  }, [])

  return { isConnected }
}
