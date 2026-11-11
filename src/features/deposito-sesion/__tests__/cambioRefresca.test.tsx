import React from 'react'
import { Text, View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { ENCABEZADO_DEPOSITO_SESION } from '@/core/api/depositoSesion'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { DepositoSesion } from '../components/DepositoSesion'
import { elegirDepositoDeSesion, limpiarDepositoDeSesion } from '../lib/depositoDeSesion'

// Regresión (verificador, sondas A y B): como la web (DepositoSesion.tsx), cambiar el depósito de la sesión invalida
// todo lo que está en caché, porque se pidió con el depósito anterior. Cliente HTTP real; solo `fetch` es falso.
jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }) }))

const SALTA = '11111111-1111-4111-8111-111111111111'
const NORTE = '22222222-2222-4222-8222-222222222222'
const DEPOSITOS = [{ id: SALTA, nombre: 'Salta', activo: true }, { id: NORTE, nombre: 'Zona Norte', activo: true }]
const mockFetch = jest.fn()
const nombreDe = (dep: string | null) => (dep === NORTE ? 'NORTE' : dep === SALTA ? 'SALTA' : 'TODOS')

function Clientes() {
  const { clientes } = useCartera('')
  return <Text testID="clientes">{(clientes as { razonSocial?: string }[]).map((c) => c.razonSocial).join(',')}</Text>
}
const pintar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })}>
    <View><DepositoSesion /><Clientes /></View>
  </QueryClientProvider>,
)
const mostrados = () => screen.getByTestId('clientes').props.children

beforeEach(() => {
  conTema('light')
  limpiarDepositoDeSesion()
  useAuthStore.setState({ user: { id: 'u1', username: 'ana', roles: [], depositoId: SALTA, permissions: [{ module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true }] } as never })
  mockFetch.mockReset().mockImplementation((url: string, init: RequestInit) => {
    const dep = new Headers(init.headers).get(ENCABEZADO_DEPOSITO_SESION)
    const body = url.endsWith('/api/v1/Depositos') ? DEPOSITOS
      : url.includes('/socios-comerciales?') ? { items: [{ id: `c-${dep}`, razonSocial: `cliente-de-${nombreDe(dep)}` }], hasNextPage: false, totalCount: 1 }
      : []
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
  })
  global.fetch = mockFetch as unknown as typeof fetch
})

it('cambiar el depósito de la sesión vuelve a pedir la lista de Clientes que ya estaba en caché', async () => {
  elegirDepositoDeSesion('u1', SALTA)
  pintar()
  await waitFor(() => expect(mostrados()).toBe('cliente-de-SALTA'))
  fireEvent.press(await screen.findByRole('button', { name: 'Depósito: Salta' }))
  fireEvent.press(screen.getByText('Zona Norte'))
  await screen.findByRole('button', { name: 'Depósito: Zona Norte' })
  await waitFor(() => expect(mostrados()).toBe('cliente-de-NORTE'))
})

it('la primera vez elige el depósito propio y vuelve a pedir lo que se pidió antes, ya con él', async () => {
  pintar()
  await screen.findByRole('button', { name: 'Depósito: Salta' })
  await act(async () => { await new Promise((r) => setTimeout(r, 300)) })
  await waitFor(() => expect(mostrados()).toBe('cliente-de-SALTA'))
})

it('el catálogo de la venta guardado sin señal y la cola de ventas sobreviven al cambio de depósito', async () => {
  const { CLAVE_CATALOGO } = require('@/features/venta-nueva/hooks/useCatalogoVenta')
  const { encolarVenta, leerCola } = require('@/features/venta-sin-senal/lib/cola')
  elegirDepositoDeSesion('u1', SALTA)
  encolarVenta('u1', {
    alta: { clienteId: 'c1', depositoId: SALTA, tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false, descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: 'mobile-k1' },
    cliente: {}, visto: { total: 600, precios: { p1: 100 } },
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const catalogo = { items: [{ id: 'p1' }], truncado: false }
  qc.setQueryData(CLAVE_CATALOGO, catalogo)
  qc.getQueryCache().find({ queryKey: CLAVE_CATALOGO })!.setOptions({ queryKey: CLAVE_CATALOGO, queryFn: () => Promise.reject(new Error('sin señal')) })
  render(<QueryClientProvider client={qc}><DepositoSesion /></QueryClientProvider>)
  fireEvent.press(await screen.findByRole('button', { name: 'Depósito: Salta' }))
  fireEvent.press(screen.getByText('Zona Norte'))
  await screen.findByRole('button', { name: 'Depósito: Zona Norte' })
  await act(async () => { await new Promise((r) => setTimeout(r, 100)) })
  expect(qc.getQueryData(CLAVE_CATALOGO)).toEqual(catalogo)
  expect(leerCola('u1').map((v: { alta: { depositoId: string } }) => v.alta.depositoId)).toEqual([SALTA])
})
