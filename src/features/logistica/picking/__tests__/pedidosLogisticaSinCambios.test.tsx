import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { PorPrepararScreen } from '@/features/logistica/porPreparar/PorPrepararScreen'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: (url: string) => mockGet(url) } }))
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useIsFocused: () => true,
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []) },
}))

// La pantalla nueva no toca "Pedidos de logística": sigue pidiendo lo mismo que antes, sin DepositoId.
it('Pedidos de logística sigue pidiendo la lista y los conteos del día, igual que antes', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T01:30:00Z'))
  useAuthStore.setState({ user: { id: 'u9', username: 'ramiro', roles: [], depositoId: 'd1', permissions: [{ module: 'MOD_VIAJES', canRead: true }] } } as never)
  mockGet.mockImplementation((url: string) =>
    url.includes('preparacion/conteos') ? Promise.resolve({ columnas: [] })
      : url.includes('ventas-para-preparacion') ? Promise.resolve([])
      : url.includes('dias-entrega') ? Promise.resolve({ lunes: true, martes: true, miercoles: true, jueves: true, viernes: true })
      : url.includes('feriados') ? Promise.resolve([])
      : Promise.reject(new Error(`sin respuesta: ${url}`)),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><PorPrepararScreen /></QueryClientProvider>)
  expect(await screen.findByText('No hay pedidos para entregar ese día.')).toBeTruthy()
  const urls = mockGet.mock.calls.map(([u]) => String(u))
  expect(urls.filter((u) => u.includes('ventas-para-preparacion'))).toEqual(['/api/v1/Logistica/ventas-para-preparacion?FechaDesde=2026-10-09&FechaHasta=2026-10-09'])
  expect(urls.filter((u) => u.includes('preparacion/conteos'))).toEqual(['/api/v1/Logistica/preparacion/conteos?FechaDesde=2026-10-09&FechaHasta=2026-10-09'])
  jest.restoreAllMocks()
})
