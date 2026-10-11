import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { BandejaAutorizaciones } from '../components/BandejaAutorizaciones'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body: unknown) => mockPost(url, body) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: mockAncho(), isTablet: mockAncho() >= 600, isTabletLandscape: mockAncho() >= 900, isLarge: mockAncho() >= 600 }),
}))

const venta = (id: string, motivo: number, total: number, extra: object = {}) => ({
  id,
  clienteId: `c-${id}`,
  clienteDisplayName: `Dirección ${id} - Cliente ${id}`,
  vendedorId: 'v1',
  vendedorNombre: 'Emanuel Parraquini',
  totalAmount: total,
  totalCurrency: 'ARS',
  fechaPendiente: '2026-10-11T10:00:00Z',
  motivoPendienteAutorizacion: motivo,
  ...extra,
})

function conCapacidades(...caps: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'marina', roles: [], permissions: ['MOD_VENTAS', ...caps].map((module) => ({ module, canRead: true })) },
  } as never)
}

function bandeja(lista: unknown, detalleVenta = { venta: { version: 7, fechaModificacion: '2026-10-11T10:00:00Z' } }) {
  mockGet.mockImplementation((url: string) =>
    url.includes('pendientes-autorizacion')
      ? (lista instanceof Error ? Promise.reject(lista) : Promise.resolve(lista))
      : Promise.resolve(detalleVenta))
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BandejaAutorizaciones rutaDetalle={(id) => `/detalle/${id}`} detalle={(id) => <></>} />
    </QueryClientProvider>,
  )
}

/** Lo que hay dentro de la hoja abierta (la lista sigue detrás). */
const hoja = (nombre: string) => within(screen.getByLabelText(nombre))

beforeEach(() => {
  jest.clearAllMocks()
  mockAncho.mockReturnValue(390)
  mockPost.mockResolvedValue(true)
})

describe('Autorizaciones: la bandeja', () => {
  it('muestra cada venta con todos sus motivos, los filtros con su cantidad y el total de la lista', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 32 | 4, 1000.5), venta('b', 2, 500)])
    pintar()

    expect(await screen.findByText('• Supera el tope de crédito del cliente')).toBeTruthy()
    expect(screen.getByText('• Supera el tope de descuento del vendedor')).toBeTruthy()
    expect(screen.getByText(/margen en amarillo/)).toBeTruthy()
    expect(screen.getByLabelText('Todas: 2')).toBeTruthy()
    expect(screen.getByLabelText('Crédito: 1')).toBeTruthy()
    expect(screen.queryByLabelText(/Sin stock/)).toBeNull()
    expect(screen.getByText('2 POR AUTORIZAR · $ 1.500,50')).toBeTruthy()

    await userEvent.press(screen.getByLabelText('Margen: 1'))
    expect(screen.queryByText('Dirección a - Cliente a')).toBeNull()
    expect(screen.getByText('1 POR AUTORIZAR · $ 500,00')).toBeTruthy()
  })

  it('con monedas distintas no suma un total', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100), venta('b', 4, 100, { totalCurrency: 'USD' })])
    pintar()
    expect(await screen.findByText('2 POR AUTORIZAR')).toBeTruthy()
  })

  it('sin CAP_AUTORIZAR_VENTA no pide la bandeja y lo explica', async () => {
    conCapacidades()
    bandeja([venta('a', 4, 100)])
    pintar()
    expect(screen.getByText(/necesita el permiso de autorizar ventas/)).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('si el servidor rechaza, muestra su mensaje', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja(new Error('Solo Administración o Gerencia pueden ver la bandeja de autorizaciones.'))
    pintar()
    expect(await screen.findByText('Solo Administración o Gerencia pueden ver la bandeja de autorizaciones.')).toBeTruthy()
  })

  it('rechazar pide el motivo y lo manda con la versión vigente de la venta', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100)])
    pintar()

    await userEvent.press(await screen.findByLabelText('Rechazar la venta de Dirección a - Cliente a'))
    const boton = hoja('Rechazar venta').getByRole('button', { name: 'Rechazar' })
    expect(boton.props.accessibilityState.disabled).toBe(true)

    await userEvent.type(screen.getByLabelText('Motivo del rechazo · obligatorio'), '  Sin margen  ')
    await userEvent.press(hoja('Rechazar venta').getByRole('button', { name: 'Rechazar' }))

    expect(mockGet).toHaveBeenCalledWith('/api/v1/Ventas/a')
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/a/rechazar-autorizacion', { ventaId: 'a', version: 7, motivoRechazo: 'Sin margen' })
  })

  it('si la venta cambió desde que se cargó la lista, no decide y lo avisa', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100)], { venta: { version: 8, fechaModificacion: '2026-10-11T11:30:00Z' } })
    pintar()

    await userEvent.press(await screen.findByLabelText('Autorizar la venta de Dirección a - Cliente a'))
    await userEvent.press(hoja('Autorizar venta').getByRole('button', { name: 'Autorizar' }))

    expect(await screen.findByText(/La venta cambió desde que se cargó la lista/)).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('si la venta cambió, vuelve a pedir la bandeja, cierra la hoja y avisa (no queda la tarjeta vieja fallando)', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100)], { venta: { version: 8, fechaModificacion: '2026-10-11T11:30:00Z' } })
    pintar()
    await userEvent.press(await screen.findByLabelText('Autorizar la venta de Dirección a - Cliente a'))
    const pedidas = () => mockGet.mock.calls.filter(([u]) => String(u).includes('pendientes-autorizacion')).length
    const antes = pedidas()
    await userEvent.press(hoja('Autorizar venta').getByRole('button', { name: 'Autorizar' }))

    expect(await screen.findByText(/La venta cambió desde que se cargó la lista/)).toBeTruthy()
    await waitFor(() => expect(pedidas()).toBeGreaterThan(antes))
    expect(screen.queryByLabelText('Autorizar venta')).toBeNull()
  })

  it('un 409 real del servidor cierra la hoja y avisa; el aviso se va al abrir otra venta', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100), venta('b', 4, 200)])
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Conflicto'), { status: 409 }))
    pintar()
    await userEvent.press(await screen.findByLabelText('Autorizar la venta de Dirección a - Cliente a'))
    await userEvent.press(hoja('Autorizar venta').getByRole('button', { name: 'Autorizar' }))

    expect(await screen.findByText(/Otra persona modificó o resolvió esta venta/)).toBeTruthy()
    expect(screen.queryByLabelText('Autorizar venta')).toBeNull()

    await userEvent.press(screen.getByLabelText('Ver la venta de Dirección b - Cliente b'))
    expect(screen.queryByText(/Otra persona modificó o resolvió esta venta/)).toBeNull()
  })

  it('autorizar sin razón la manda en null; con margen en amarillo la tarjeta lleva a revisar', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 1, 100), venta('b', 2 | 1, 200)])
    pintar()

    await userEvent.press(await screen.findByLabelText('Revisar la venta de Dirección b - Cliente b'))
    expect(mockPush).toHaveBeenCalledWith('/detalle/b')
    expect(screen.queryByLabelText('Autorizar la venta de Dirección b - Cliente b')).toBeNull()

    await userEvent.press(screen.getByLabelText('Autorizar la venta de Dirección a - Cliente a'))
    await userEvent.press(hoja('Autorizar venta').getByRole('button', { name: 'Autorizar' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/a/autorizar', { ventaId: 'a', version: 7, razon: null })
  })

  it('en teléfono, tocar la tarjeta abre el detalle', async () => {
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100)])
    pintar()
    await userEvent.press(await screen.findByLabelText('Ver la venta de Dirección a - Cliente a'))
    expect(mockPush).toHaveBeenCalledWith('/detalle/a')
  })

  it('en tablet horizontal el detalle se abre al lado, sin salir de la lista', async () => {
    mockAncho.mockReturnValue(1194)
    conCapacidades('CAP_AUTORIZAR_VENTA')
    bandeja([venta('a', 4, 100)])
    pintar()

    await userEvent.press(await screen.findByLabelText('Ver la venta de Dirección a - Cliente a'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(within(screen.getByTestId('two-pane-detail')).queryByText('Elegí una venta para decidir.')).toBeNull()
  })
})
