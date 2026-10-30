import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ventasKeys } from '@/libs/api-client/ventas'
import { VentaNuevaPantalla, type AbrirVenta } from '../components/VentaNuevaPantalla'
import { AccionesVenta } from '../components/AccionesVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'
import { aplicarDescuentoGeneral } from '../__testing__/descuentoGeneral'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace }) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))

const { ApiError } = jest.requireActual('@/core/api/client')
jest.setTimeout(20000)

const pala = producto({ real: 100, disponible: 100 })
const cabecera = (o: Record<string, unknown> = {}) => ({
  id: 'v9', codigoPedido: 'A00419', clienteId: 'c7', version: 4, estado: 2, tipoOperacion: 2, porcentajeDescuento: 0,
  metodoEntregaNombre: 'LogisticaPropia', metodoEntrega: 1, fechaEntrega: '2026-01-02T00:00:00', cargoFleteAmount: 0, observaciones: null, ...o,
})
const venta = { venta: cabecera(), detalles: [{ id: 'i1', productoId: 'p1', productoNombre: 'Pala', cantidad: 12, porcentajeDescuentoItem: 0, stockDisponible: 100 }], bultos: [] }
const socio = { id: 'c7', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }
const ESPERA = { timeout: 3000 }

function conQuery(ui: React.ReactElement, qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}
const abrir = (a: AbrirVenta, qc?: QueryClient) => conQuery(<VentaNuevaPantalla abrir={a} />, qc)
const permisos = (p: Record<string, boolean>) =>
  useAuthStore.setState({ user: { id: 'u1', roles: ['Vendedor'], permissions: [{ module: 'MOD_VENTAS', canRead: true, ...p }], maxDescuentoPorcentaje: 10 } as never })

beforeEach(() => {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  permisos({ canCreate: true, canUpdate: true })
  useCarritoVenta.setState({ lineas: [] })
  for (const m of [mockPush, mockReplace]) m.mockReset()
  mockPost.mockReset().mockImplementation((url: string) => Promise.resolve(url === '/api/v1/Ventas/borradores' ? { ventaId: 'b1', version: 1, message: '' } : undefined))
  mockPut.mockReset().mockImplementation((_u: string, b: { version: number }) => Promise.resolve({ ventaId: 'v9', version: b.version + 1, message: 'Venta actualizada.' }))
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/api/v1/Ventas/v9') return Promise.resolve(venta)
    if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
    if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [pala], hasNextPage: false })
    return Promise.resolve(undefined)
  })
})

describe('editar y duplicar (PR 2.9b)', () => {
  it('Editar solo en Pendiente o Confirmada y con permiso; Duplicar con permiso de crear', async () => {
    const r = conQuery(<AccionesVenta venta={venta as never} rotulo="Tarantino 1898" />)
    await userEvent.press(screen.getByRole('button', { name: 'Editar' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva?editar=v9')
    await userEvent.press(screen.getByRole('button', { name: 'Duplicar' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva?duplicar=v9')
    r.unmount()
    conQuery(<AccionesVenta venta={{ ...venta, venta: cabecera({ estado: 5 }) } as never} rotulo="Tarantino 1898" />)
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  })

  it('editar carga la venta sin autoguardar y "Guardar cambios" la manda con PUT y su versión', async () => {
    abrir({ modo: 'editar', ventaId: 'v9' })
    expect(await screen.findByText('Editar pedido A00419')).toBeTruthy()
    await aplicarDescuentoGeneral(5)
    await new Promise((r) => setTimeout(r, 1200))
    expect(mockPut).not.toHaveBeenCalled()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    expect(mockPut.mock.calls[0][0]).toBe('/api/v1/Ventas/v9')
    expect(mockPut.mock.calls[0][1]).toEqual({
      id: 'v9', version: 4, descuentoGeneral: 5, metodoEntrega: 1, fechaEntrega: '2026-01-02', cargoFlete: 0,
      items: [{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 0 }],
      // T4d: como la web, el PUT de la edición manda el tilde de la venta (esta no lo trae: `?? false`); lo demás igual.
      conFactura: false,
    })
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Ventas/borradores', expect.anything())
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Ventas', expect.anything())
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/ventas/guardada', params: { id: 'v9', mensaje: 'Venta actualizada.' } }))
  })

  it('editar con un caché viejo de la venta hidrata lo vigente del servidor (líneas y versión), no lo cacheado', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    qc.setQueryData(ventasKeys.detail('v9'), venta)
    const vigente = { ...venta, venta: cabecera({ version: 7 }), detalles: [{ ...venta.detalles[0], cantidad: 20 }] }
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/v1/Ventas/v9') return Promise.resolve(vigente)
      if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
      if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [pala], hasNextPage: false })
      return Promise.resolve(undefined)
    })
    abrir({ modo: 'editar', ventaId: 'v9' }, qc)
    await userEvent.press(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    expect(mockPut.mock.calls[0][1]).toMatchObject({ version: 7, items: [{ productoId: 'p1', cantidad: 20, descuentoPorcentaje: 0 }] })
  })

  it('el autoguardado del borrador invalida el detalle en caché, así reabrirlo trae la última versión', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    abrir({ modo: 'duplicar', ventaId: 'v9' }, qc)
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    qc.setQueryData(ventasKeys.detail('b1'), venta)
    expect(qc.getQueryState(ventasKeys.detail('b1'))?.isInvalidated).toBe(false)
    await aplicarDescuentoGeneral(3)
    await waitFor(() => expect(mockPut.mock.calls.length).toBeGreaterThan(1), ESPERA)
    await waitFor(() => expect(qc.getQueryState(ventasKeys.detail('b1'))?.isInvalidated).toBe(true), ESPERA)
  })

  it('si otro la cambió (409), se ve el mensaje del servidor y no sale de la pantalla', async () => {
    mockPut.mockRejectedValue(new ApiError(409, 'Error de concurrencia: la venta fue modificada.'))
    abrir({ modo: 'editar', ventaId: 'v9' })
    await userEvent.press(await screen.findByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Error de concurrencia: la venta fue modificada.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('editar una venta de logística sin fecha guardada no propone ni manda una fecha que no se eligió', async () => {
    const sinFecha = { ...venta, venta: cabecera({ fechaEntrega: null }) }
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/v1/Ventas/v9') return Promise.resolve(sinFecha)
      if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
      if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [pala], hasNextPage: false })
      return Promise.resolve(undefined)
    })
    abrir({ modo: 'editar', ventaId: 'v9' })
    expect(await screen.findByText('Sin fecha: elegí el día de entrega.')).toBeTruthy()
    const dias = screen.getAllByRole('radio', { name: /^(dom|lun|mar|mié|jue|vie|sáb) \d+/ })
    expect(dias.length).toBeGreaterThan(0)
    expect(dias.some((r) => r.props.accessibilityState?.selected)).toBe(false)
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
    expect(mockPut.mock.calls[0][1]).not.toHaveProperty('fechaEntrega')
  })

  it('si el catálogo de hoy no llega, no hidrata con lo guardado: muestra el error y Reintentar', async () => {
    let catalogoFalla = true
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/v1/Ventas/v9') return Promise.resolve(venta)
      if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
      if (url.startsWith('/api/v1/Productos/catalogo-stock')) {
        return catalogoFalla ? Promise.reject(new ApiError(500, 'Error interno')) : Promise.resolve({ items: [pala], hasNextPage: false })
      }
      return Promise.resolve(undefined)
    })
    abrir({ modo: 'duplicar', ventaId: 'v9' })
    expect(await screen.findByText('No se pudo traer el catálogo con los precios y el stock de hoy.')).toBeTruthy()
    expect(screen.queryByText('Nuevo pedido')).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
    catalogoFalla = false
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Nuevo pedido')).toBeTruthy()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c7', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 'Pedido' }))
  })

  it('duplicar crea un borrador nuevo para el mismo cliente y le autoguarda las líneas, sin copiar la fecha', async () => {
    abrir({ modo: 'duplicar', ventaId: 'v9' })
    expect(await screen.findByText('Nuevo pedido')).toBeTruthy()
    expect(screen.getByText('Tarantino 1898 · Autoservicio Abel')).toBeTruthy()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c7', depositoId: DEPOSITO_CENTRAL_ID, tipoOperacion: 'Pedido' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    expect(mockPut.mock.calls[0][0]).toBe('/api/v1/Ventas/b1')
    expect(mockPut.mock.calls[0][1]).toMatchObject({ id: 'b1', version: 1, items: [{ productoId: 'p1', cantidad: 12, descuentoPorcentaje: 0 }] })
    expect(mockPut.mock.calls[0][1].fechaEntrega).not.toBe('2026-01-02')
  })
})

describe('editar, retomar y duplicar usan la revisión nueva (S9)', () => {
  const CAP = { module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }

  it('editar abre "Revisar venta", sin la revisión vieja (Seguir, pestañas), y el botón dice Guardar cambios', async () => {
    abrir({ modo: 'editar', ventaId: 'v9' })
    expect(await screen.findByText('Revisar venta')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Seguir' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Cabecera' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar venta' })).toBeNull()
  })

  it('editar no avisa de falta de stock por lo que la venta ya tenía (disponible 5 + 12 de la venta)', async () => {
    permisos({ canCreate: true, canUpdate: true, canRead: true })
    useAuthStore.setState({ user: { ...useAuthStore.getState().user, permissions: [{ module: 'MOD_VENTAS', canRead: true, canCreate: true, canUpdate: true }, CAP] } as never })
    const escaso = producto({ real: 5, disponible: 5 })
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/v1/Ventas/v9') return Promise.resolve(venta)
      if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
      if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [escaso], hasNextPage: false })
      return Promise.resolve(undefined)
    })
    abrir({ modo: 'editar', ventaId: 'v9' })
    expect(await screen.findByText('Stock confirmado ahora')).toBeTruthy()
    expect(screen.queryByText(/Quedan 5, pediste 12/)).toBeNull()
    expect(screen.queryByText('Esta venta necesita autorización')).toBeNull()
  })

  it('editar sí avisa si pide más que lo disponible más lo que la venta ya tenía', async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user, permissions: [{ module: 'MOD_VENTAS', canRead: true, canCreate: true, canUpdate: true }, CAP] } as never })
    const escaso = producto({ real: 0, disponible: 0 })
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/v1/Ventas/v9') return Promise.resolve({ ...venta, detalles: [{ ...venta.detalles[0], cantidad: 12 }] })
      if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
      if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [escaso], hasNextPage: false })
      return Promise.resolve(undefined)
    })
    abrir({ modo: 'editar', ventaId: 'v9' })
    await screen.findByText('Revisar venta')
    await userEvent.press(await screen.findByRole('button', { name: /Pala/ }))
    await userEvent.press(await screen.findByRole('button', { name: 'Uno más' }))
    expect(await screen.findByText('Pediste más de lo disponible: la venta va a autorización')).toBeTruthy()
  })

  it('duplicar abre "Revisar venta" y "Confirmar venta" crea una venta nueva (POST /Ventas), no pisa la original', async () => {
    mockPost.mockImplementation((url: string) => Promise.resolve(
      url === '/api/v1/Ventas/borradores' ? { ventaId: 'b1', version: 1, message: '' } : { ventaId: 'v10', version: 1, message: 'Venta creada.', estado: 1 }))
    abrir({ modo: 'duplicar', ventaId: 'v9' })
    expect(await screen.findByText('Revisar venta')).toBeTruthy()
    await waitFor(() => expect(mockPut).toHaveBeenCalled(), ESPERA)
    await userEvent.press(await screen.findByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas', expect.objectContaining({ clienteId: 'c7', items: [expect.objectContaining({ productoId: 'p1', cantidad: 12 })] })))
    expect(mockPut.mock.calls.every(([u]: [string]) => u !== '/api/v1/Ventas/v9')).toBe(true)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/ventas/guardada', params: { id: 'v10', mensaje: 'Venta creada.' } }))
  })
})
