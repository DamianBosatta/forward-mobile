import React from 'react'
import { View } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { OfflineBanner } from '@/core/ui/OfflineBanner'
import { TopBar, TwoPane } from '..'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims(),
}))
let mockConectado = false
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockConectado }) }))
jest.mock('expo-router', () => ({ usePathname: () => '/ventas' }))
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'))
const { SafeAreaInsetsContext } = jest.requireActual('react-native-safe-area-context')
const INSETS = { top: 30, bottom: 10, left: 0, right: 0 }

const conAncho = (width: number) => mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 })

/** Como Ventas, Compras y Autorizaciones: la barra de la lista arriba y el detalle con su propia barra. */
function Lista() {
  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Ventas" />
      <TwoPane list={<View testID="lista" />} detail={<View style={{ flex: 1 }}><TopBar title="Venta A00419" /></View>} />
    </View>
  )
}
const pintar = () =>
  render(
    <SafeAreaInsetsContext.Provider value={INSETS}>
      <OfflineBanner><Lista /></OfflineBanner>
    </SafeAreaInsetsContext.Provider>,
  )

describe('TwoPane sin señal: un solo aviso', () => {
  beforeEach(() => { mockConectado = false })

  it.each([1280, 390])('con el detalle abierto (ancho %i) el aviso sale una sola vez, debajo de la barra de la pantalla', (ancho) => {
    conAncho(ancho)
    pintar()
    expect(screen.getAllByTestId('aviso-sin-conexion')).toHaveLength(1)
  })

  it('con señal no hay aviso en ninguna barra', () => {
    mockConectado = true
    conAncho(1280)
    pintar()
    expect(screen.queryAllByTestId('aviso-sin-conexion')).toHaveLength(0)
  })
})
