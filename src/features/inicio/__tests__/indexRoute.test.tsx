import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import InicioRoute from '../../../../app/(tabs)/index'

jest.mock('../../../../app/(tabs)/logistica/consola', () => ({ __esModule: true, default: () => require('react').createElement(require('react-native').Text, null, 'RUTA_DEL_DIA') }))
jest.mock('@/features/inicio/components/InicioScreen', () => ({ InicioScreen: () => require('react').createElement(require('react-native').Text, null, 'GESTION') }))
jest.mock('@/features/inicio/components/MiDiaScreen', () => ({ MiDiaScreen: () => require('react').createElement(require('react-native').Text, null, 'MIDIA') }))
jest.mock('@/src/components/layout/AccesosRapidos', () => ({ ConAccesosRapidos: ({ children }: { children: React.ReactNode }) => children }))
const mockChofer = jest.fn(() => false)
jest.mock('@/src/components/layout/menuModules', () => ({ esChofer: () => mockChofer() }))

const conPermisos = (...modulos: string[]) =>
  useAuthStore.setState({ user: { id: 'u', username: 'u', roles: [], permissions: modulos.map((module) => ({ module, canRead: true })) } } as never)

describe('inicio por capacidad (D12)', () => {
  beforeEach(() => mockChofer.mockReturnValue(false))
  it('con CAP_VER_COSTOS, el inicio de gestión', () => {
    conPermisos('CAP_VER_COSTOS')
    render(<InicioRoute />)
    expect(screen.getByText('GESTION')).toBeTruthy()
  })
  it('sin CAP_VER_COSTOS, Mi día', () => {
    conPermisos('MOD_VENTAS')
    render(<InicioRoute />)
    expect(screen.getByText('MIDIA')).toBeTruthy()
    expect(screen.queryByText('RUTA_DEL_DIA')).toBeNull()
  })
  it('el chofer entra a la pantalla de su ruta (no al tablero viejo) aunque tenga CAP_VER_COSTOS', () => {
    mockChofer.mockReturnValue(true)
    conPermisos('CAP_VER_COSTOS')
    render(<InicioRoute />)
    expect(screen.getByText('RUTA_DEL_DIA')).toBeTruthy()
    expect(screen.queryByText('MIDIA')).toBeNull()
  })
})
