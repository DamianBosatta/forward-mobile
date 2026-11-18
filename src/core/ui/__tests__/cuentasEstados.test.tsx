import React from 'react'
import { screen, userEvent } from '@testing-library/react-native'
import CuentasScreen from '../../../../app/(tabs)/cuentas/index'
import { useThemeStore } from '@/libs/theme'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))

const mockRefetch = jest.fn()
let mockError: unknown = null
jest.mock('@/features/clientes/hooks/useCartera', () => ({
  useCartera: () => ({
    clientes: [], totalCount: 0, saldoTotal: 0, isLoading: false, isRefetching: false,
    error: mockError, dataUpdatedAt: 0, refetch: mockRefetch, cargarMas: jest.fn(),
  }),
}))

describe.each(['light', 'dark'] as const)('Cuentas: lista vacía con error (%s)', (modo) => {
  beforeEach(() => {
    jest.clearAllMocks()
    useThemeStore.setState({ mode: modo })
    conPermisos([{ module: 'MOD_CLIENTES', canRead: true }])
  })

  it('un error que no es de red muestra el estado "error" con Reintentar (antes no mostraba nada)', async () => {
    mockError = new Error('No tenés permisos para esta acción.')
    renderConQuery(<CuentasScreen />)
    expect(await screen.findByText('No pudimos cargar los clientes')).toBeTruthy()
    expect(screen.getByText('No tenés permisos para esta acción.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('la falla de red sigue mostrando "sin conexión" con Reintentar', async () => {
    mockError = new TypeError('Network request failed')
    renderConQuery(<CuentasScreen />)
    expect(await screen.findByText('No pudimos cargar los clientes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})
