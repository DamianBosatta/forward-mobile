import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { OfflineBanner } from '../OfflineBanner'

let mockConectado = false
let mockRuta = '/'
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockConectado }) }))
jest.mock('expo-router', () => ({ usePathname: () => mockRuta }))
// El aviso corre el margen superior del sistema: estas pruebas usan el contexto real de márgenes.
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'))

const TEXTO = /Sin conexión - Modo lectura/

describe('OfflineBanner', () => {
  beforeEach(() => { mockConectado = false; mockRuta = '/' })

  it('en una pantalla de solo lectura sin señal sigue mostrando el aviso', () => {
    mockRuta = '/inventario/stock'
    render(<OfflineBanner />)
    expect(screen.getByText(TEXTO)).toBeTruthy()
  })

  it('va en el flujo, no flotando: no tapa el encabezado de la pantalla', () => {
    mockRuta = '/inventario/stock'
    render(<OfflineBanner />)
    const estilo = StyleSheet.flatten(screen.getByTestId('aviso-sin-conexion').props.style)
    expect(estilo.position).not.toBe('absolute')
  })

  it('no se muestra en la consola del chofer: ahí el trabajo se encola y ella avisa', () => {
    mockRuta = '/logistica/consola'
    render(<OfflineBanner />)
    expect(screen.queryByText(TEXTO)).toBeNull()
  })

  it('no se muestra en la venta nueva, que también vende sin señal', () => {
    mockRuta = '/ventas/nueva'
    render(<OfflineBanner />)
    expect(screen.queryByText(TEXTO)).toBeNull()
  })

  it('con señal no se muestra en ninguna pantalla', () => {
    mockConectado = true
    render(<OfflineBanner />)
    expect(screen.queryByText(TEXTO)).toBeNull()
  })
})

describe('OfflineBanner arriba de la pantalla (propuesta de Inicio, frame 10)', () => {
  const { SafeAreaInsetsContext, useSafeAreaInsets } = jest.requireActual('react-native-safe-area-context')
  const { Text } = jest.requireActual('react-native')
  const INSETS = { top: 30, bottom: 10, left: 0, right: 0 }
  let montajes = 0
  function Pantalla() {
    React.useEffect(() => { montajes += 1 }, [])
    const { top } = useSafeAreaInsets()
    return <Text testID="pantalla">{`arriba ${top}`}</Text>
  }
  const pintar = () =>
    render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <OfflineBanner><Pantalla /></OfflineBanner>
      </SafeAreaInsetsContext.Provider>,
    )
  beforeEach(() => { montajes = 0; mockConectado = false; mockRuta = '/inventario/stock' })

  it('sin señal va arriba, antes de la pantalla y con el margen del sistema; la pantalla ya no lo suma', () => {
    pintar()
    const aviso = screen.getByTestId('aviso-sin-conexion')
    const pantalla = screen.getByTestId('pantalla')
    const orden = screen.toJSON() as unknown as { children: { props: { testID?: string } }[] }
    expect(orden.children[0].props.testID).toBe('aviso-sin-conexion')
    expect(StyleSheet.flatten(aviso.props.style).paddingTop).toBeGreaterThanOrEqual(INSETS.top)
    expect(pantalla.props.children).toBe('arriba 0')
  })

  it('en la consola del chofer y en la venta nueva sigue oculto y la pantalla conserva su margen', () => {
    for (const ruta of ['/logistica/consola', '/ventas/nueva']) {
      mockRuta = ruta
      const r = pintar()
      expect(screen.queryByText(TEXTO)).toBeNull()
      expect(screen.getByTestId('pantalla').props.children).toBe('arriba 30')
      r.unmount()
    }
  })

  it('con señal no hay aviso y la pantalla conserva su margen', () => {
    mockConectado = true
    pintar()
    expect(screen.queryByText(TEXTO)).toBeNull()
    expect(screen.getByTestId('pantalla').props.children).toBe('arriba 30')
  })

  it('perder la señal no vuelve a montar la pantalla (no se pierde la navegación)', () => {
    mockConectado = true
    const r = pintar()
    mockConectado = false
    r.rerender(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <OfflineBanner><Pantalla /></OfflineBanner>
      </SafeAreaInsetsContext.Provider>,
    )
    expect(screen.getByText(TEXTO)).toBeTruthy()
    expect(montajes).toBe(1)
  })
})
