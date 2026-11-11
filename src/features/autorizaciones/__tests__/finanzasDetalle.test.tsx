import React from 'react'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { themeColors } from '@/libs/theme'
import { DetalleAutorizacion } from '../components/DetalleAutorizacion'

/** Propuesta "Finanzas como venta", frames 19 a 23 (detalle de una autorización y hojas de decisión). */

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body: unknown) => mockPost(url, body) },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

const VENTA = {
  venta: {
    id: 'v1', codigoPedido: 'A00428', estado: 9, version: 42, clienteId: 'c9', clienteNombre: 'Gral. Paz 10450 - Limpieza Total', vendedorNombre: 'Lucía Ferreyra',
    totalAmount: 336076.11, subtotalBrutoAmount: 331788.96, montoDescuentoAmount: 0, cargoFleteAmount: 4287.15,
    motivoPendienteAutorizacion: 2 | 1, motivoVentaSinStock: 'Entra el martes', gananciaBrutaAmount: null, margenBrutoPorcentaje: null,
  },
  detalles: [
    { id: 'd1', productoNombre: 'Detergente Magistral', cantidad: 10, precioUnitario: 2323.2, subtotal: 23232, porcentajeDescuentoItem: 0 },
    { id: 'd2', productoNombre: 'Lavandina Ayudín', cantidad: 5, precioUnitario: 1000, subtotal: 5000, porcentajeDescuentoItem: 0 },
  ],
}
const PREVIEW = {
  ventaId: 'v1', totalSacrificio: 0, valorStockLiberado: 0,
  items: [{ detalleId: 'd1', productoId: 'p1', productoNombre: 'Detergente Magistral', cantidad: 10, precioEfectivo: 2323.2, precioMinimoRentable: 2420, aporteOverhead: null, sacrificio: 96.8 }],
}
const SOCIO = { id: 'c9', condicionPago: 'Contado', puedeVerSaldo: true, saldoAmount: 1000 }

function permisos(...modulos: string[]) {
  useAuthStore.setState({ user: { id: 'u1', username: 'marina', roles: [], permissions: modulos.map((module) => ({ module, canRead: true, canUpdate: module === 'MOD_VENTAS' })) } } as never)
}

function pintar(venta: unknown = VENTA) {
  mockGet.mockImplementation((url: string) =>
    url.endsWith('autorizacion-preview') ? Promise.resolve(PREVIEW)
      : url.includes('socios') ? Promise.resolve(SOCIO)
        : venta instanceof Promise ? venta : Promise.resolve(venta))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue(true)
  permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA', 'MOD_CC', 'MOD_CLIENTES')
})

it('"Por qué espera" es un aviso ámbar con sus viñetas (frame 19)', async () => {
  pintar()
  const aviso = await screen.findByTestId('por-que-espera')

  expect(within(aviso).getByText('Por qué espera')).toBeTruthy()
  expect(within(aviso).getByText(/^• .*margen en amarillo/)).toBeTruthy()
  expect(StyleSheet.flatten(aviso.props.style).backgroundColor).toBe(themeColors.light.chip.porAutorizar.bg)
})

it('el enlace a la cuenta corriente es una fila con flecha dentro de la tarjeta del cliente (frame 19)', async () => {
  pintar()
  const cliente = await screen.findByTestId('bloque-cliente')

  const enlace = await within(cliente).findByRole('link', { name: 'Ver cuenta corriente del cliente' })
  expect(within(enlace).getByTestId('fila-chevron')).toBeTruthy()
})

it('"Debajo del mínimo": el precio y el mínimo van en rojo (frame 20)', async () => {
  pintar()
  const piso = await screen.findByTestId('bloque-piso')

  const precio = within(piso).getByText('Precio $ 2.323,20 · Mínimo $ 2.420,00')
  expect(StyleSheet.flatten(precio.props.style).color).toBe(themeColors.light.chip.anulado.text)
})

it('las líneas son filas de una tarjeta y los totales van en otra (frame 20)', async () => {
  pintar()
  const lineas = await screen.findByTestId('tarjeta-lineas')

  expect(within(lineas).getByText('Detergente Magistral')).toBeTruthy()
  expect(within(lineas).getByText('Lavandina Ayudín')).toBeTruthy()
  expect(within(screen.getByTestId('tarjeta-totales')).getByLabelText(/^Total: /)).toBeTruthy()
})

it('hoja Autorizar: los cambios del pedido van en una tarjeta gris (frame 21)', async () => {
  pintar()
  await userEvent.type(await screen.findByLabelText('Cantidad de Detergente Magistral'), '9')
  await userEvent.press(screen.getByRole('button', { name: 'Revisar y autorizar' }))

  const cambios = within(screen.getByLabelText('Autorizar venta')).getByLabelText('Cambios en el pedido')
  expect(StyleSheet.flatten(cambios.props.style).backgroundColor).toBe(themeColors.light.surface2)
})

it('hoja Rechazar: "Rechazar" es el único botón rojo; el del pie del detalle no (frame 22)', async () => {
  pintar()
  const enPie = await screen.findByRole('button', { name: 'Rechazar' })
  expect(StyleSheet.flatten(enPie.props.style).backgroundColor).not.toBe(themeColors.light.dangerStrong)

  await userEvent.press(enPie)
  const hoja = within(screen.getByLabelText('Rechazar venta'))
  await userEvent.type(hoja.getByLabelText('Motivo del rechazo · obligatorio'), 'Precio fuera de lista')
  expect(StyleSheet.flatten(hoja.getByRole('button', { name: 'Rechazar' }).props.style).backgroundColor).toBe(themeColors.light.dangerStrong)
  expect(StyleSheet.flatten(hoja.getByRole('button', { name: 'Cancelar' }).props.style).backgroundColor).not.toBe(themeColors.light.dangerStrong)
})

it('cargando: esqueletos con la forma de las tarjetas en lugar de la ruedita (frame 23)', async () => {
  pintar(new Promise(() => {}))

  expect(await screen.findByTestId('esqueleto-tarjeta')).toBeTruthy()
  expect(screen.UNSAFE_queryAllByType(require('react-native').ActivityIndicator)).toHaveLength(0)
})

it('los cuerpos de autorizar con ajuste y de rechazar no cambian', async () => {
  pintar()
  await userEvent.type(await screen.findByLabelText('Cantidad de Detergente Magistral'), '9')
  await userEvent.press(screen.getByRole('button', { name: 'Revisar y autorizar' }))
  const autorizar = within(screen.getByLabelText('Autorizar venta'))
  await userEvent.type(autorizar.getByLabelText('Razón para autorizar · obligatoria'), 'Cliente estratégico')
  await userEvent.press(autorizar.getByRole('button', { name: 'Autorizar' }))

  await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
  expect(mockPost.mock.calls[0]).toEqual(['/api/v1/Ventas/v1/autorizar', {
    ventaId: 'v1', version: 42, razon: 'Cliente estratégico', ajustes: [{ ventaDetalleId: 'd1', cantidadNueva: 9 }],
  }])
})

it('el cuerpo de rechazar no cambia', async () => {
  pintar()
  await userEvent.press(await screen.findByRole('button', { name: 'Rechazar' }))
  const hoja = within(screen.getByLabelText('Rechazar venta'))
  await userEvent.type(hoja.getByLabelText('Motivo del rechazo · obligatorio'), ' Precio fuera de lista ')
  await userEvent.press(hoja.getByRole('button', { name: 'Rechazar' }))

  await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
  expect(mockPost.mock.calls[0]).toEqual(['/api/v1/Ventas/v1/rechazar-autorizacion', { ventaId: 'v1', version: 42, motivoRechazo: 'Precio fuera de lista' }])
})
