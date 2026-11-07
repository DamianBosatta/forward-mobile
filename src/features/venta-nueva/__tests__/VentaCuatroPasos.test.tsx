import React from 'react'
import { BackHandler } from 'react-native'
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockPut = jest.fn()
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
jest.mock('@/core/realtime/stockEnVivo', () => ({
  ...jest.requireActual('@/core/realtime/stockEnVivo'),
  gestorStock: { suscribir: () => () => {}, reintentar: jest.fn(), enVivo: () => false },
}))
// La lista de clientes y el catálogo tienen sus tests: acá solo se elige y se pasa a la revisión.
const mockBoton = (label: string, onPress: () => void) => {
  const { Pressable: P, Text: T } = require('react-native')
  return <P accessibilityRole="button" onPress={onPress}><T>{label}</T></P>
}
jest.mock('../components/ElegirClienteVenta', () => ({
  ElegirClienteVenta: ({ onElegir }: { onElegir: (c: object) => void }) =>
    mockBoton('Elegir Tarantino', () => onElegir({ id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' })),
}))
jest.mock('../components/CatalogoVenta', () => ({
  CatalogoVenta: ({ onVerVenta }: { onVerVenta: () => void }) => (
    <>
      {mockBoton('Añadir pala', () => require('../hooks/useCarritoVenta').useCarritoVenta.getState().agregar(require('../__testing__/producto').producto()))}
      {mockBoton('Ver venta', onVerVenta)}
    </>
  ),
}))
const { ApiError } = jest.requireActual('@/core/api/client')

const TODOS = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true }
const calendario = (url: string) => url.includes('dias-entrega') ? TODOS : url.includes('feriados') ? [] : undefined
const pala = producto()
const ESPERA = { timeout: 3000 }

function pantalla(props: React.ComponentProps<typeof VentaNuevaPantalla> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla {...props} /></QueryClientProvider>)
}
/** Cliente, catálogo, una pala en el carrito y "Ver venta": se llega al paso 3 (Carrito). */
async function alCarrito() {
  pantalla()
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  await userEvent.press(screen.getByRole('button', { name: /^Continuar a productos/ }))
  await userEvent.press(screen.getByRole('button', { name: 'Añadir pala' }))
  await userEvent.press(screen.getByRole('button', { name: 'Ver venta' }))
  await screen.findByText('Paso 3 de 4')
}
async function aEntrega() {
  await alCarrito()
  await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('Paso 4 de 4')
}
/** El atrás de Android: manda el último oyente registrado que lo atiende, como el sistema. */
const hardwareBack = () => {
  const oyentes = (BackHandler.addEventListener as unknown as jest.SpyInstance).mock.calls.map((c) => c[1] as () => boolean)
  return [...oyentes].reverse().some((f) => f())
}

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ ventaId: 'b1', version: 7, message: 'Borrador creado.' })
  mockPut.mockReset().mockImplementation((_u: string, b: { version: number }) => Promise.resolve({ ventaId: 'b1', version: b.version + 1, message: 'ok' }))
  mockGet.mockReset().mockImplementation((url: string) => Promise.resolve(calendario(url)))
  mockBack.mockReset()
  mockDims.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 })
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never })
  useCarritoVenta.setState({ lineas: [] })
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }))
})
afterEach(() => jest.restoreAllMocks())

describe('venta en cuatro pasos: Cliente, Productos, Carrito, Entrega', () => {
  it('la barra tiene los cuatro nombres y el encabezado dice "Paso N de 4" en cada paso', async () => {
    pantalla()
    expect(screen.getByText('Paso 1 de 4')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    await userEvent.press(screen.getByRole('button', { name: /^Continuar a productos/ }))
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy()
    for (const [n, nombre] of [[1, 'Cliente'], [2, 'Productos'], [3, 'Carrito'], [4, 'Entrega']] as const) {
      expect(screen.getByLabelText(`Paso ${n} de 4: ${nombre}`)).toBeTruthy()
    }
    await userEvent.press(screen.getByRole('button', { name: 'Añadir pala' }))
    await userEvent.press(screen.getByRole('button', { name: 'Ver venta' }))
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
    expect(screen.getByLabelText('Paso 3 de 4: Carrito')).toHaveProp('accessibilityState', { selected: true })
    await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Paso 4 de 4')).toBeTruthy()
    expect(screen.getByLabelText('Paso 4 de 4: Entrega')).toHaveProp('accessibilityState', { selected: true })
  })

  it('el paso 3 es solo el carrito: líneas, descuento general y "Continuar", sin entrega ni factura ni confirmar', async () => {
    await alCarrito()
    expect(screen.getByText('Pala c/Cabo Fija LP')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Descuento a toda la venta' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar productos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    expect(screen.queryByRole('switch', { name: 'Con factura' })).toBeNull()
    expect(screen.queryByText('Fecha de entrega')).toBeNull()
    expect(screen.queryByLabelText('Observaciones')).toBeNull()
    expect(screen.queryByLabelText(/^Flete/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar venta' })).toBeNull()
  })

  it('el paso 4 trae entrega, fecha, observaciones y factura, con el total y "Confirmar venta", y no las líneas', async () => {
    await aEntrega()
    expect(screen.getByRole('switch', { name: 'Con factura' })).toBeTruthy()
    expect(screen.getByText('Fecha de entrega')).toBeTruthy()
    expect(screen.getByLabelText('Observaciones')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Logística' })).toBeTruthy()
    expect(screen.getByLabelText(/^Flete/)).toBeTruthy()
    expect(screen.getByTestId('revisar-total')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Volver al carrito' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Descuento a toda la venta' })).toBeNull()
    expect(screen.queryByText('Pala c/Cabo Fija LP')).toBeNull()
  })

  it('con el carrito vacío "Continuar" está apagado y no se llega al paso 4', async () => {
    await alCarrito()
    useCarritoVenta.setState({ lineas: [] })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled())
    await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.queryByText('Paso 4 de 4')).toBeNull()
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
  })

  it('la flecha de la barra y el atrás de Android van un paso atrás, sin salir de la venta', async () => {
    await aEntrega()
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Paso 4 de 4')).toBeTruthy()
    act(() => { expect(hardwareBack()).toBe(true) })
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
    act(() => { expect(hardwareBack()).toBe(true) })
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('en el catálogo de una venta nueva el atrás de Android no se intercepta: sale como hoy', async () => {
    pantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    await userEvent.press(screen.getByRole('button', { name: /^Continuar a productos/ }))
    expect(hardwareBack()).toBe(false)
  })

  describe('confirmar que falla en el paso 4', () => {
    const falla = () => mockPost.mockImplementation((u: string) => u === '/api/v1/Ventas'
      ? Promise.reject(new ApiError(400, 'El descuento de Pala supera tu tope.', undefined, 'VentaDescuentoSuperaElTope'))
      : Promise.resolve({ ventaId: 'b1', version: 7, message: '' }))

    it('el error queda visible en el paso 4, dice qué corregir y ofrece volver al carrito', async () => {
      falla()
      await aEntrega()
      await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
      expect(await screen.findByText(/El descuento de Pala supera tu tope/)).toBeTruthy()
      expect(screen.getByText('Paso 4 de 4')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Volver al carrito' })).toBeTruthy()
    })

    it('al volver al carrito para corregirlo, el aviso sigue ahí', async () => {
      falla()
      await aEntrega()
      await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
      await screen.findByText(/El descuento de Pala supera tu tope/)
      await userEvent.press(screen.getByRole('button', { name: 'Volver al carrito' }))
      expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
      expect(screen.getByText(/El descuento de Pala supera tu tope/)).toBeTruthy()
    })
  })
})

describe('borrador retomado (el paso no se guarda en el borrador)', () => {
  const venta = {
    venta: {
      id: 'b9', clienteId: 'c7', version: 4, estado: 1, tipoOperacion: 1, porcentajeDescuento: 5, metodoEntrega: 2,
      metodoEntregaNombre: 'RetiroEnLocal', fechaEntrega: null, cargoFleteAmount: 0, observaciones: 'Portón negro',
    },
    detalles: [{ id: 'i1', productoId: 'p1', productoNombre: 'Pala vieja', cantidad: 3, precioUnitario: 2496, porcentajeDescuentoItem: 10, stockDisponible: 0 }],
    bultos: [],
  }
  it('abre en el paso 3 con sus líneas y descuento, y la entrega (observaciones) está en el paso 4', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/v1/Ventas/b9') return Promise.resolve(venta)
      if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve({ id: 'c7', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' })
      if (url.startsWith('/api/v1/Productos/catalogo-stock')) return Promise.resolve({ items: [pala], hasNextPage: false })
      return Promise.resolve(calendario(url))
    })
    pantalla({ abrir: { modo: 'retomar', ventaId: 'b9', tipo: 'Presupuesto' } })
    expect(await screen.findByText('Paso 3 de 4', undefined, ESPERA)).toBeTruthy()
    expect(screen.getByText('Pala c/Cabo Fija LP')).toBeTruthy()
    expect(screen.queryByLabelText('Observaciones')).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByLabelText('Observaciones')).toHaveProp('value', 'Portón negro')
    // Una venta abierta sale de la pantalla desde el paso 3, como hoy.
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
