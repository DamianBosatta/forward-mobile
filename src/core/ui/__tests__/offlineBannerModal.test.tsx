import React from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { OfflineBanner } from '@/core/ui/OfflineBanner'
import { TopBar } from '@/core/ui/fw'

let mockConectado = false
let mockRuta = '/inventario'
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockConectado }) }))
jest.mock('expo-router', () => ({ usePathname: () => mockRuta, useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
// Real safe-area context: the notice must not change the device inset that screens and modals read.
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'))
const { SafeAreaInsetsContext } = jest.requireActual('react-native-safe-area-context')
const INSETS = { top: 30, bottom: 10, left: 0, right: 0 }

/** Same placement as app/_layout.tsx: the Stack (screens, with their RN <Modal>s) is the child of OfflineBanner. */
function Arbol() {
  return (
    <SafeAreaInsetsContext.Provider value={INSETS}>
      <View style={{ flex: 1 }}>
        <OfflineBanner>
          <View testID="pantalla">
            <TopBar title="Inventario" />
            <Modal visible animationType="slide"><View testID="modal"><TopBar title="Ficha de producto" /></View></Modal>
          </View>
        </OfflineBanner>
      </View>
    </SafeAreaInsetsContext.Provider>
  )
}
const margenSuperior = (titulo: string) => {
  let n: any = screen.getByText(titulo)
  while (n && !(StyleSheet.flatten(n.props.style ?? {}) as any).backgroundColor) n = n.parent
  return (StyleSheet.flatten(n.props.style) as any).paddingTop
}

describe('Aviso sin conexión y modales de pantalla completa', () => {
  beforeEach(() => { mockConectado = false; mockRuta = '/inventario' })

  it.each(['/inventario', '/compras/nueva'])('sin señal en %s el modal conserva el margen del sistema (su barra no queda bajo la hora)', (ruta) => {
    mockRuta = ruta
    render(<Arbol />)
    expect(screen.getByTestId('aviso-sin-conexion')).toBeTruthy()
    expect(margenSuperior('Ficha de producto')).toBe(30)
    expect(margenSuperior('Inventario')).toBe(30)
  })

  it('con señal no hay aviso y los márgenes son los del sistema', () => {
    mockConectado = true
    render(<Arbol />)
    expect(screen.queryByTestId('aviso-sin-conexion')).toBeNull()
    expect(margenSuperior('Inventario')).toBe(30)
    expect(margenSuperior('Ficha de producto')).toBe(30)
  })

  it('en la venta nueva (aviso propio) no hay aviso global y los márgenes son los del sistema', () => {
    mockRuta = '/ventas/nueva'
    render(<Arbol />)
    expect(screen.queryByTestId('aviso-sin-conexion')).toBeNull()
    expect(margenSuperior('Inventario')).toBe(30)
    expect(margenSuperior('Ficha de producto')).toBe(30)
  })
})
