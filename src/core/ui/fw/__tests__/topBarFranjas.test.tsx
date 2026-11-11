import React from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { Search } from 'lucide-react-native'
import { space, themeColors } from '@/libs/theme'
import { OfflineBanner } from '@/core/ui/OfflineBanner'
import { TopBar } from '../index'

let mockConectado = false
let mockRuta = '/inventario'
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockConectado }) }))
jest.mock('expo-router', () => ({ usePathname: () => mockRuta }))
// Márgenes reales del sistema: la barra los lee y el aviso no debe sumarlos de nuevo.
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'))
const { SafeAreaInsetsContext } = jest.requireActual('react-native-safe-area-context')
const INSETS = { top: 30, bottom: 10, left: 0, right: 0 }

type Nodo = { type: string; props: Record<string, any>; children: (Nodo | string)[] | null }
const estilo = (n: { props: { style?: unknown } }) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, any>
/** El bloque oscuro de la barra: el primer ancestro del título con fondo. */
const bloqueDeLaBarra = (titulo: string) => {
  let n: any = screen.getByText(titulo)
  while (n && !estilo(n).backgroundColor) n = n.parent
  return n
}
const conMargenes = (el: React.ReactElement) => <SafeAreaInsetsContext.Provider value={INSETS}>{el}</SafeAreaInsetsContext.Provider>
const contiene = (padre: any, hijo: any): boolean => {
  for (let n = hijo; n; n = n.parent) if (n === padre) return true
  return false
}

beforeEach(() => { mockConectado = false; mockRuta = '/inventario' })

describe('TopBar: logo FWD (propuesta de Inicio)', () => {
  it('con logo muestra la marca FWD en la fila de la barra, entre el menú y el título', () => {
    render(conMargenes(<TopBar logo title="Hola, Emanuel" leading={{ kind: 'menu', onPress: jest.fn() }} />))
    const logo = screen.getByTestId('logo-fwd', { includeHiddenElements: true })
    expect(contiene(bloqueDeLaBarra('Hola, Emanuel'), logo)).toBe(true)
  })

  it('sin pedirlo no hay logo', () => {
    render(conMargenes(<TopBar title="Ventas" leading={{ kind: 'menu', onPress: jest.fn() }} />))
    expect(screen.queryByTestId('logo-fwd', { includeHiddenElements: true })).toBeNull()
  })
})

describe('TopBar: campo en la barra (propuesta de Cuenta, Buscar)', () => {
  it('el campo va dentro de la barra, en la fila del botón de volver, y reemplaza al título', () => {
    render(
      conMargenes(
        <TopBar
          title="Buscar"
          leading={{ kind: 'atras', onPress: jest.fn() }}
          campo={<TextInput accessibilityLabel="Buscar" placeholder="Cliente, pedido o cuenta" />}
        />,
      ),
    )
    const campo = screen.getByLabelText('Buscar')
    const volver = screen.getByRole('button', { name: 'Volver' })
    let barra: any = campo
    while (barra && estilo(barra).backgroundColor !== themeColors.light.topBar) barra = barra.parent
    expect(barra).toBeTruthy()
    // Misma fila: el campo y el botón de volver comparten la fila de 64 de la barra.
    let fila: any = campo
    while (fila && estilo(fila).flexDirection !== 'row') fila = fila.parent
    expect(contiene(fila, volver)).toBe(true)
    // El título no se ve: queda solo como encabezado para el lector de pantalla.
    expect(estilo(screen.getByText('Buscar')).opacity).toBe(0)
  })

  it('con campo, el título sigue siendo el encabezado de la pantalla para el lector de pantalla', () => {
    render(conMargenes(<TopBar title="Buscar" leading={{ kind: 'atras', onPress: jest.fn() }} campo={<TextInput accessibilityLabel="Texto a buscar" />} />))
    expect(screen.getByRole('header', { name: 'Buscar' })).toBeTruthy()
  })
})

describe('TopBar: aviso sin conexión debajo de la barra (propuesta de Inicio, frame 10)', () => {
  const pintar = (barra: React.ReactElement) =>
    render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <OfflineBanner>{barra}</OfflineBanner>
      </SafeAreaInsetsContext.Provider>,
    )

  it('sin señal el aviso va debajo de la barra, fuera del bloque oscuro, y no vuelve a sumar el margen del sistema', () => {
    pintar(<TopBar title="Inventario" leading={{ kind: 'menu', onPress: jest.fn() }} />)
    const aviso = screen.getByTestId('aviso-sin-conexion')
    const barra = bloqueDeLaBarra('Inventario')
    expect(contiene(barra, aviso)).toBe(false)
    expect(estilo(barra).paddingTop).toBe(INSETS.top)
    expect(estilo(aviso).paddingTop).toBe(space[2])
    // Orden: primero la barra (con el margen del sistema), después el aviso; nada arriba de la barra.
    const raiz = screen.toJSON() as unknown as Nodo
    const hijos = (raiz.children ?? []) as Nodo[]
    expect(estilo(hijos[0]).backgroundColor).toBe(themeColors.light.topBar)
    expect(hijos[1].props.testID).toBe('aviso-sin-conexion')
    expect(screen.getByText('Sin conexión - Modo lectura (Cache)')).toBeTruthy()
  })

  it('el aviso va debajo de las pestañas cuando la barra las tiene', () => {
    pintar(<TopBar title="Ventas" tabs={[{ label: 'Borradores', selected: true, onPress: jest.fn() }]} />)
    const aviso = screen.getByTestId('aviso-sin-conexion')
    const pestana = screen.getByRole('tab', { name: 'Borradores' })
    expect(contiene(bloqueDeLaBarra('Ventas'), pestana)).toBe(true)
    expect(contiene(bloqueDeLaBarra('Ventas'), aviso)).toBe(false)
  })

  it.each(['/logistica/consola', '/ventas/nueva'])('en %s (aviso propio) la barra no muestra el aviso global', (ruta) => {
    mockRuta = ruta
    pintar(<TopBar title="Consola" />)
    expect(screen.queryByTestId('aviso-sin-conexion')).toBeNull()
  })

  it('con señal la barra no muestra el aviso', () => {
    mockConectado = true
    pintar(<TopBar title="Inventario" />)
    expect(screen.queryByTestId('aviso-sin-conexion')).toBeNull()
  })
})

describe('TopBar sin pedir logo ni campo se ve como antes', () => {
  it('un solo bloque oscuro con el margen del sistema, título, acciones y sin logo ni aviso', () => {
    const { toJSON } = render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <TopBar title="Stock" subtitle="Depósito central" leading={{ kind: 'atras', onPress: jest.fn() }} actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: jest.fn() }]} />
      </SafeAreaInsetsContext.Provider>,
    )
    const raiz = toJSON() as unknown as Nodo
    expect(Array.isArray(raiz)).toBe(false)
    expect(estilo(raiz)).toEqual({ backgroundColor: themeColors.light.topBar, paddingTop: INSETS.top, borderBottomWidth: 1, borderBottomColor: themeColors.light.topBarBorder })
    expect(screen.getByText('Stock')).toBeTruthy()
    expect(screen.getByText('Depósito central')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeTruthy()
    expect(screen.queryByTestId('logo-fwd', { includeHiddenElements: true })).toBeNull()
    expect(screen.queryByTestId('aviso-sin-conexion')).toBeNull()
  })

  it('fuera del aviso global (pantallas sueltas, pruebas) la barra no consulta la red ni muestra el aviso', () => {
    mockConectado = false
    render(conMargenes(<View><TopBar title="Stock" /></View>))
    expect(screen.queryByTestId('aviso-sin-conexion')).toBeNull()
  })
})
