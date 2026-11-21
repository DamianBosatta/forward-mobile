import React from 'react'
import { act, render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { OfflineBanner } from '@/core/ui/OfflineBanner'
import { TopBar } from '@/core/ui/fw'

// El aviso global con el hook de red real (NetInfo simulado): lo que ve el usuario según la alcanzabilidad (RED-03).
type Estado = { isConnected: boolean | null; isInternetReachable: boolean | null }
let emitir: (e: Estado) => void = () => {}
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: (cb: (e: Estado) => void) => { emitir = cb; return () => {} } },
}))
jest.mock('expo-router', () => ({ usePathname: () => '/inventario/stock' }))
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'))
const { SafeAreaInsetsContext } = jest.requireActual('react-native-safe-area-context')

const TEXTO = /Sin conexión - Modo lectura/

const pintar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SafeAreaInsetsContext.Provider value={{ top: 30, bottom: 10, left: 0, right: 0 }}>
        <OfflineBanner><TopBar title="Stock" /></OfflineBanner>
      </SafeAreaInsetsContext.Provider>
    </QueryClientProvider>,
  )

beforeEach(() => { onlineManager.setOnline(true) })

describe('aviso global sin conexión según la alcanzabilidad', () => {
  it('con la alcanzabilidad todavía desconocida (null) no dice "Sin conexión"', () => {
    pintar()
    act(() => emitir({ isConnected: true, isInternetReachable: null }))
    expect(screen.queryByText(TEXTO)).toBeNull()
  })

  it('sin red de verdad (false) sigue diciendo "Sin conexión - Modo lectura"', () => {
    pintar()
    act(() => emitir({ isConnected: false, isInternetReachable: false }))
    expect(screen.getByText(TEXTO)).toBeTruthy()
  })
})
