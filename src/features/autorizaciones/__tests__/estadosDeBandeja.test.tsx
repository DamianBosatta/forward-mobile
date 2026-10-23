/**
 * Bloque 12, T13c (lienzo R16): la bandeja de autorizaciones muestra "vacío" y "sin conexión" con el
 * componente de estados de pantalla. Las frases de hoy no cambian.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { BandejaAutorizaciones } from '../components/BandejaAutorizaciones'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: (url: string) => mockGet(url), post: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

const SIN_RED = () => new TypeError('Network request failed')
const VENTA = {
  id: 'a', clienteId: 'c-a', clienteDisplayName: 'Dirección a - Cliente a', vendedorId: 'v1', vendedorNombre: 'Emanuel Parraquini',
  totalAmount: 1000, totalCurrency: 'ARS', fechaPendiente: '2026-10-11T10:00:00Z', motivoPendienteAutorizacion: 4,
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <BandejaAutorizaciones rutaDetalle={(id) => `/detalle/${id}`} detalle={() => <></>} />
    </QueryClientProvider>,
  )
  return qc
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({
    user: { id: 'u1', username: 'marina', roles: [], permissions: ['MOD_VENTAS', 'CAP_AUTORIZAR_VENTA'].map((module) => ({ module, canRead: true, canUpdate: module === 'MOD_VENTAS' })) },
  } as never)
  mockGet.mockResolvedValue([])
})

describe('Autorizaciones: estados de la bandeja', () => {
  it('sin ventas por autorizar: estado "vacío" con la frase de siempre', async () => {
    pintar()
    expect(await screen.findByRole('header', { name: 'No hay ventas por autorizar.' })).toBeTruthy()
  })

  it('sin conexión y sin nada guardado: estado "sin conexión" con Reintentar, que vuelve a pedir', async () => {
    mockGet.mockRejectedValue(SIN_RED())
    pintar()

    expect(await screen.findByRole('header', { name: 'No pudimos cargar las autorizaciones' })).toBeTruthy()
    expect(screen.getByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()

    mockGet.mockResolvedValue([VENTA])
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Dirección a - Cliente a')).toBeTruthy()
  })

  it('con lo guardado y sin conexión: la bandeja sigue y un aviso dice a qué hora se guardó', async () => {
    mockGet.mockResolvedValue([VENTA])
    const qc = pintar()
    await screen.findByText('Dirección a - Cliente a')

    mockGet.mockRejectedValue(SIN_RED())
    await act(async () => { await qc.refetchQueries() })

    expect(await screen.findByText(/^Parece que no hay señal\. Mostramos lo último que guardó el teléfono a las \d\d:\d\d\.$/)).toBeTruthy()
    expect(screen.getByText('Dirección a - Cliente a')).toBeTruthy()
  })

  it('otro error sin datos sigue siendo el aviso con el mensaje del servidor', async () => {
    mockGet.mockRejectedValue(new Error('Solo Administración o Gerencia pueden ver la bandeja.'))
    pintar()

    expect(await screen.findByText('Solo Administración o Gerencia pueden ver la bandeja.')).toBeTruthy()
    expect(screen.queryByRole('header', { name: 'No pudimos cargar las autorizaciones' })).toBeNull()
  })
})
