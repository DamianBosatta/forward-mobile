import React from 'react'
import { StyleSheet } from 'react-native'
import { screen, within } from '@testing-library/react-native'
import ClientesScreen from '../../../../app/(tabs)/socios/index'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

// P17 A / MC-28: el buscador y las pestañas de Clientes usan la columna de 640 de la lista; el teléfono no cambia.

jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('expo-router/react-navigation', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), isLarge: mockAncho() >= 600, isTablet: mockAncho() >= 600, isTabletLandscape: mockAncho() >= 900 }),
}))

const get = api.get as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canCreate: true }])
  get.mockResolvedValue(pagina([clienteDeLista()], 142))
})

describe('Clientes: encabezado de la lista', () => {
  it('en tablet vertical usa la columna de 640, la misma de la lista', async () => {
    mockAncho.mockReturnValue(700)
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Av. del Valle 89')
    const estilo = StyleSheet.flatten(screen.getByTestId('encabezado-clientes').props.style)
    expect(estilo.maxWidth).toBe(640)
    expect(estilo.alignSelf).toBe('center')
  })

  it('en tablet horizontal queda dentro de la columna de la lista', async () => {
    mockAncho.mockReturnValue(1000)
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Av. del Valle 89')
    expect(within(screen.getByTestId('columna-lista-clientes')).getByTestId('encabezado-clientes')).toBeTruthy()
  })

  it('en el teléfono no cambia: sin ancho máximo ni dos paneles', async () => {
    renderConQuery(<ClientesScreen />)
    await screen.findByText('Av. del Valle 89')
    expect(StyleSheet.flatten(screen.getByTestId('encabezado-clientes').props.style)?.maxWidth).toBeUndefined()
    expect(screen.queryByTestId('columna-lista-clientes')).toBeNull()
  })
})
