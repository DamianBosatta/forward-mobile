/**
 * S8 (T1): el Administrador común se trata igual que en la web. La web no usa isAdmin() como atajo
 * para ver o pedir algo (RequirePermission.tsx, issues #620 y #688): un Administrador sin la fila de
 * MOD_VENTAS recibiría 403 de GET /api/v1/Ventas (VentasController, RequirePermission Ventas:Read).
 * La campana de autorizaciones pendientes consulta ventas solo con Ventas: leer.
 */
import React from 'react'
import { act, render } from '@testing-library/react-native'
import { useAuthStore, parsePermissionsFromArray } from '@/src/features/auth/store/auth.store'
import type { AppRole } from '@/libs/api-client/types'
import { TopHeaderActions } from '../TopHeaderActions'

const mockUseVentas = jest.fn()
jest.mock('@/libs/api-client', () => ({ useVentas: (...args: unknown[]) => mockUseVentas(...args) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('expo-blur', () => ({ BlurView: ({ children }: { children?: React.ReactNode }) => children ?? null }))
jest.mock('moti', () => ({ MotiView: ({ children }: { children?: React.ReactNode }) => children ?? null }))

function loguear(roles: string[], permisos: string[]) {
  act(() => {
    useAuthStore.getState().setUser({
      id: 'u1',
      username: 'admin',
      roles: roles as AppRole[],
      permissions: parsePermissionsFromArray(permisos),
    })
  })
}

const consultaHabilitada = () => mockUseVentas.mock.calls.at(-1)?.[1]?.enabled

beforeEach(() => mockUseVentas.mockReset().mockReturnValue({ data: undefined }))
afterEach(() => act(() => useAuthStore.getState().logout()))

describe('TopHeaderActions — Administrador común como en la web', () => {
  it('un Administrador sin Ventas: leer no consulta las ventas por autorizar', () => {
    loguear(['Administrador'], [])
    render(<TopHeaderActions />)
    expect(consultaHabilitada()).toBe(false)
  })

  it('con Ventas: leer las consulta, sea cual sea el rol', () => {
    loguear(['Empleado'], ['MOD_VENTAS:Read'])
    render(<TopHeaderActions />)
    expect(consultaHabilitada()).toBe(true)
  })
})
