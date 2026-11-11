import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react-native'
import { api } from '@/core/api/client'
import { ENCABEZADO_DEPOSITO_SESION } from '@/core/api/depositoSesion'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { CalendarioScreen } from '@/features/calendario/CalendarioScreen'
import { DepositoSesion } from '../components/DepositoSesion'
import { depositoDeSesionDe, elegirDepositoDeSesion, limpiarDepositoDeSesion } from '../lib/depositoDeSesion'

// Pantallas reales sobre el cliente HTTP real: solo `fetch` es falso, para ver el encabezado que sale.
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }) }))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))

const SALTA = '11111111-1111-4111-8111-111111111111'
const NORTE = '22222222-2222-4222-8222-222222222222'
const DEPOSITOS = [{ id: SALTA, nombre: 'Salta', activo: true }, { id: NORTE, nombre: 'Zona Norte', activo: true }]
const mockFetch = jest.fn()
const pedidos = () => mockFetch.mock.calls.map(([url, init]) => ({ url: String(url), deposito: new Headers((init as RequestInit).headers).get(ENCABEZADO_DEPOSITO_SESION) }))
const usuario = (caps: string[]) =>
  useAuthStore.setState({ user: { id: 'u1', username: 'ana', roles: [], depositoId: SALTA, permissions: caps.map((module) => ({ module, canRead: true })) } as never })
const pintar = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

beforeEach(() => {
  conTema('light')
  limpiarDepositoDeSesion()
  mockFetch.mockReset().mockImplementation((url: string) => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(url.endsWith('/api/v1/Depositos') ? DEPOSITOS : []),
  }))
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('X-Deposito-Sesion desde las pantallas (S8, G2)', () => {
  it('quien ve todos y entra por primera vez arranca en su depósito, y ese depósito viaja (como la web)', async () => {
    usuario(['CAP_VER_TODOS_LOS_DEPOSITOS'])
    pintar(<DepositoSesion />)
    await screen.findByRole('button', { name: 'Depósito: Salta' })
    expect(depositoDeSesionDe('u1')).toBe(SALTA)
    await api.get('/api/v1/Ventas')
    expect(pedidos().at(-1)).toEqual({ url: expect.stringContaining('/api/v1/Ventas'), deposito: SALTA })
  })

  it('sin la capacidad, una elección vieja se borra y el encabezado no viaja', async () => {
    elegirDepositoDeSesion('u1', NORTE)
    usuario([])
    pintar(<DepositoSesion />)
    await waitFor(() => expect(depositoDeSesionDe('u1')).toBeUndefined())
    await api.get('/api/v1/Ventas')
    expect(pedidos().at(-1)?.deposito).toBeNull()
  })

  it('una pantalla que no tiene nada que ver (Calendario) también lo manda', async () => {
    usuario(['CAP_VER_TODOS_LOS_DEPOSITOS'])
    elegirDepositoDeSesion('u1', NORTE)
    pintar(<CalendarioScreen />)
    await waitFor(() => expect(pedidos().some((p) => p.url.includes('/api/v1/Calendario?'))).toBe(true))
    expect(pedidos().filter((p) => p.url.includes('/api/v1/Calendario?')).every((p) => p.deposito === NORTE)).toBe(true)
  })
})
