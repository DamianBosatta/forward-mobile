import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { OfflineBanner } from '../OfflineBanner'
import { TopBar } from '../fw'

let mockConectado = false
let mockRuta = '/'
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockConectado }) }))
jest.mock('expo-router', () => ({ usePathname: () => mockRuta }))
// El aviso no cambia el margen superior del sistema: estas pruebas usan el contexto real de márgenes.
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'))
const { SafeAreaInsetsContext, useSafeAreaInsets } = jest.requireActual('react-native-safe-area-context')
const INSETS = { top: 30, bottom: 10, left: 0, right: 0 }

const TEXTO = /Sin conexión - Modo lectura/

/** Igual que app/_layout.tsx: las pantallas (con su TopBar) van dentro de OfflineBanner. */
const pintar = (hijo: React.ReactElement = <TopBar title="Stock" />) =>
  render(
    <SafeAreaInsetsContext.Provider value={INSETS}>
      <OfflineBanner>{hijo}</OfflineBanner>
    </SafeAreaInsetsContext.Provider>,
  )

describe('OfflineBanner', () => {
  beforeEach(() => { mockConectado = false; mockRuta = '/' })

  it('en una pantalla de solo lectura sin señal sigue mostrando el aviso', () => {
    mockRuta = '/inventario/stock'
    pintar()
    expect(screen.getByText(TEXTO)).toBeTruthy()
  })

  it('va en el flujo, no flotando: no tapa el encabezado de la pantalla', () => {
    mockRuta = '/inventario/stock'
    pintar()
    const estilo = StyleSheet.flatten(screen.getByTestId('aviso-sin-conexion').props.style)
    expect(estilo.position).not.toBe('absolute')
  })

  it('no se muestra en la consola del chofer: ahí el trabajo se encola y ella avisa', () => {
    mockRuta = '/logistica/consola'
    pintar()
    expect(screen.queryByText(TEXTO)).toBeNull()
  })

  it('no se muestra en la venta nueva, que también vende sin señal', () => {
    mockRuta = '/ventas/nueva'
    pintar()
    expect(screen.queryByText(TEXTO)).toBeNull()
  })

  it('con señal no se muestra en ninguna pantalla', () => {
    mockConectado = true
    pintar()
    expect(screen.queryByText(TEXTO)).toBeNull()
  })
})

describe('OfflineBanner debajo de la barra (propuesta de Inicio, frame 10)', () => {
  const { Text } = jest.requireActual('react-native')
  let montajes = 0
  function Pantalla() {
    React.useEffect(() => { montajes += 1 }, [])
    const { top } = useSafeAreaInsets()
    return (
      <>
        <TopBar title="Stock" />
        <Text testID="pantalla">{`arriba ${top}`}</Text>
      </>
    )
  }
  beforeEach(() => { montajes = 0; mockConectado = false; mockRuta = '/inventario/stock' })

  it('sin señal nada va arriba de la barra: la barra pone el margen del sistema y el aviso va después; la pantalla conserva su margen (los modales lo necesitan)', () => {
    pintar(<Pantalla />)
    const orden = screen.toJSON() as unknown as { children: { props: { testID?: string; style?: unknown } }[] }
    const barra = StyleSheet.flatten(orden.children[0].props.style as never) as { paddingTop?: number }
    expect(barra.paddingTop).toBe(INSETS.top)
    expect(orden.children[1].props.testID).toBe('aviso-sin-conexion')
    expect(StyleSheet.flatten(screen.getByTestId('aviso-sin-conexion').props.style).paddingTop).toBeLessThan(INSETS.top)
    expect(screen.getByTestId('pantalla').props.children).toBe('arriba 30')
  })

  it('en la consola del chofer y en la venta nueva sigue oculto y la pantalla conserva su margen', () => {
    for (const ruta of ['/logistica/consola', '/ventas/nueva']) {
      mockRuta = ruta
      const r = pintar(<Pantalla />)
      expect(screen.queryByText(TEXTO)).toBeNull()
      expect(screen.getByTestId('pantalla').props.children).toBe('arriba 30')
      r.unmount()
    }
  })

  it('con señal no hay aviso y la pantalla conserva su margen', () => {
    mockConectado = true
    pintar(<Pantalla />)
    expect(screen.queryByText(TEXTO)).toBeNull()
    expect(screen.getByTestId('pantalla').props.children).toBe('arriba 30')
  })

  it('perder la señal no vuelve a montar la pantalla (no se pierde la navegación)', () => {
    mockConectado = true
    const r = pintar(<Pantalla />)
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
