import React from 'react'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { themeColors } from '@/libs/theme'
import { formatImporte as $ } from '@/core/ui/fw'
import { BandejaAutorizaciones } from '../components/BandejaAutorizaciones'

/** Propuesta "Finanzas como venta", frames 16 a 18 (bandeja de Autorizaciones). */

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body: unknown) => mockPost(url, body) },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('expo-router/react-navigation', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

const venta = (id: string, motivo: number, total: number, extra: object = {}) => ({
  id, clienteId: `c-${id}`, clienteDisplayName: `Dirección ${id} - Cliente ${id}`, vendedorId: 'v1', vendedorNombre: 'Emanuel Parraquini',
  totalAmount: total, totalCurrency: 'ARS', fechaPendiente: new Date(Date.now() - 2 * 86_400_000).toISOString(), motivoPendienteAutorizacion: motivo, ...extra,
})

function conPermisos(modificar = true) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'marina', roles: [], permissions: ['MOD_VENTAS', 'CAP_AUTORIZAR_VENTA'].map((module) => ({ module, canRead: true, canUpdate: modificar && module === 'MOD_VENTAS' })) },
  } as never)
}

const FECHA = '2026-10-11T10:00:00Z'

function pintar(lista: unknown) {
  mockGet.mockImplementation((url: string) => (url.includes('pendientes-autorizacion') ? (lista instanceof Promise ? lista : Promise.resolve(lista)) : Promise.resolve({ venta: { version: 7, fechaModificacion: FECHA } })))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BandejaAutorizaciones rutaDetalle={(id) => `/detalle/${id}`} detalle={() => <></>} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos()
  mockPost.mockResolvedValue(true)
})

describe('hero "Por autorizar" (frame 16)', () => {
  it('con todas de la misma moneda la cifra es el total; debajo, la cantidad y la más antigua', async () => {
    pintar([venta('a', 4, 1000.5), venta('b', 2, 500, { fechaPendiente: new Date().toISOString() })])

    const hero = await screen.findByTestId('hero-saldo')
    expect(within(hero).getByText('Por autorizar')).toBeTruthy()
    expect(within(hero).getByText($(1500.5))).toBeTruthy()
    expect(within(hero).getByText('2 ventas · la más antigua, hace 2 días')).toBeTruthy()
    expect(within(hero).getByLabelText(`Por autorizar: ${$(1500.5)}, 2 ventas · la más antigua, hace 2 días`)).toBeTruthy()
  })

  it('con monedas distintas la cifra es la cantidad', async () => {
    pintar([venta('a', 4, 100), venta('b', 4, 100, { totalCurrency: 'USD' })])

    const hero = await screen.findByTestId('hero-saldo')
    expect(within(hero).getByText('2')).toBeTruthy()
    expect(within(hero).getByText('ventas · la más antigua, hace 2 días')).toBeTruthy()
  })

  it('el hero sigue al filtro elegido', async () => {
    pintar([venta('a', 4, 1000.5), venta('b', 2, 500)])
    await screen.findByTestId('hero-saldo')

    await userEvent.press(screen.getByLabelText('Margen: 1'))

    expect(within(screen.getByTestId('hero-saldo')).getByText($(500))).toBeTruthy()
    expect(within(screen.getByTestId('hero-saldo')).getByText('1 venta · la más antigua, hace 2 días')).toBeTruthy()
  })
})

it('filtros de 44 px con tilde en el elegido y "·" antes de la cantidad (frame 16)', async () => {
  pintar([venta('a', 4, 100), venta('b', 2, 500)])

  const todas = await screen.findByLabelText('Todas: 2')
  expect(StyleSheet.flatten(todas.props.style).minHeight).toBe(44)
  expect(within(todas).getByText('Todas · 2')).toBeTruthy()
  expect(within(todas).getByTestId('chip-tilde')).toBeTruthy()
  expect(within(screen.getByLabelText('Margen: 1')).queryByTestId('chip-tilde')).toBeNull()
})

it('sin modificar Ventas: la línea con candado arriba de los filtros y tarjetas sin botones (frame 17)', async () => {
  conPermisos(false)
  pintar([venta('a', 4, 100)])

  const motivo = await screen.findByTestId('motivo-sin-decidir')
  expect(within(motivo).getByText('Para decidir necesitás el permiso de modificar ventas.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Rechazar la venta/ })).toBeNull()
})

it('cargando: esqueletos con la forma del hero y de una tarjeta (frame 18)', async () => {
  pintar(new Promise(() => {}))

  expect(await screen.findByTestId('esqueleto-hero')).toBeTruthy()
  expect(screen.getByTestId('esqueleto-tarjeta')).toBeTruthy()
})

it('"Rechazar" de la tarjeta no es rojo: el único botón rojo es el de la hoja de rechazo', async () => {
  pintar([venta('a', 4, 100)])
  const enTarjeta = await screen.findByRole('button', { name: 'Rechazar la venta de Dirección a - Cliente a' })
  expect(StyleSheet.flatten(enTarjeta.props.style).backgroundColor).not.toBe(themeColors.light.dangerStrong)

  await userEvent.press(enTarjeta)
  await userEvent.type(screen.getByLabelText('Motivo del rechazo · obligatorio'), 'Sin margen')

  const enHoja = within(screen.getByLabelText('Rechazar venta')).getByRole('button', { name: 'Rechazar' })
  expect(StyleSheet.flatten(enHoja.props.style).backgroundColor).toBe(themeColors.light.dangerStrong)
})

it('el cuerpo de rechazar no cambia: id, versión y motivo recortado', async () => {
  pintar([venta('a', 4, 100, { fechaPendiente: FECHA })])
  await userEvent.press(await screen.findByRole('button', { name: 'Rechazar la venta de Dirección a - Cliente a' }))
  await userEvent.type(screen.getByLabelText('Motivo del rechazo · obligatorio'), '  Sin margen  ')
  await userEvent.press(within(screen.getByLabelText('Rechazar venta')).getByRole('button', { name: 'Rechazar' }))

  await waitFor(() => expect(mockPost).toHaveBeenCalled())
  expect(mockPost.mock.calls).toEqual([['/api/v1/Ventas/a/rechazar-autorizacion', { ventaId: 'a', version: 7, motivoRechazo: 'Sin margen' }]])
})
