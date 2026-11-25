import React from 'react'
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { ApiError } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { leerCola } from '@/features/venta-sin-senal'
import { storage } from '@/core/utils/storage'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'
import { PREVIEW_IVA } from '../__testing__/vistaPreviaIva'

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
const mockBack = jest.fn()
const mockReplace = jest.fn()
let mockTipo = 'Pedido'
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => mockBoton(`redirige a ${href}`, jest.fn()),
}))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
// La lista de clientes y el catálogo tienen sus tests: acá solo se elige y se agrega.
const mockBoton = (label: string, onPress: () => void) => {
  const { Pressable: P, Text: T } = require('react-native')
  return <P accessibilityRole="button" onPress={onPress}><T>{label}</T></P>
}
jest.mock('../components/ElegirClienteVenta', () => ({
  ElegirClienteVenta: ({ onElegir }: { onElegir: (c: object) => void }) =>
    mockBoton('Elegir Tarantino', () => onElegir({ id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' })),
}))
jest.mock('../components/CatalogoVenta', () => ({ CatalogoVenta: ({ onVerVenta }: { onVerVenta: () => void }) => mockBoton('Ver venta', onVerVenta) }))

const TODOS = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true }
const URL_DEFECTO = '/api/v1/Ventas/con-factura-por-defecto'
let porDefecto: unknown
let vistaPrevia: () => Promise<unknown>
const pala = producto({ real: 100, disponible: 100 })

function pantalla() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla /></QueryClientProvider>)
}
async function abrirConfirmar() {
  pantalla()
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  await userEvent.press(screen.getByRole('button', { name: /^Continuar a productos/ }))
  await userEvent.press(screen.getByRole('button', { name: 'Ver venta' }))
  useCarritoVenta.setState({ lineas: [{ productoId: pala.id, producto: pala, cantidad: 12, descuentoPct: 0 }] })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar a entrega' })).toBeEnabled())
  await userEvent.press(screen.getByRole('button', { name: 'Continuar a entrega' }))
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith(URL_DEFECTO))
  await screen.findByRole('switch', { name: 'Con factura' })
}
async function abrirPresupuesto() {
  pantalla()
  await userEvent.press(screen.getByRole('radio', { name: 'Presupuesto' }))
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  await userEvent.press(screen.getByRole('button', { name: /^Continuar a productos/ }))
  await userEvent.press(screen.getByRole('button', { name: 'Ver venta' }))
  useCarritoVenta.setState({ lineas: [{ productoId: pala.id, producto: pala, cantidad: 12, descuentoPct: 0 }] })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar a entrega' })).toBeEnabled())
  await userEvent.press(screen.getByRole('button', { name: 'Continuar a entrega' }))
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith(URL_DEFECTO))
  await screen.findByRole('switch', { name: 'Con factura' })
}
const cuerpoDelAlta = () => mockPost.mock.calls.find((c) => c[0] === '/api/v1/Ventas')?.[1]
const pedidosDeVistaPrevia = () => mockPost.mock.calls.filter((c) => c[0] === '/api/v1/Ventas/vista-previa')

beforeEach(() => {
  porDefecto = { ventaConFacturaPorDefecto: true }
  vistaPrevia = () => Promise.resolve(PREVIEW_IVA)
  mockPost.mockReset().mockImplementation((url: string) => url === '/api/v1/Ventas/vista-previa' ? vistaPrevia()
    : Promise.resolve({ ventaId: 'b1', version: 7, message: 'Borrador creado.' }))
  mockPut.mockReset().mockImplementation((_u: string, body: { version: number }) => Promise.resolve({ ventaId: 'b1', version: body.version + 1, message: 'ok' }))
  mockGet.mockReset().mockImplementation((url: string) => Promise.resolve(
    url === URL_DEFECTO ? porDefecto : url.includes('dias-entrega') ? TODOS : url.includes('feriados') ? [] : undefined))
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  storage.clearAll()
  useCarritoVenta.setState({ lineas: [] })
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never })
})


describe('IVA encima del neto: pantalla de entrega (S2, S6)', () => {
  it('con el tilde: muestra neto, IVA por alícuota y el total del servidor, y manda totalEsperado = ese total', async () => {
    await abrirConfirmar()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Con factura' })).toBeChecked())
    expect(await screen.findByText('Neto')).toBeTruthy()
    expect(screen.getByText('IVA 21 %')).toBeTruthy()
    expect(screen.getByTestId('revisar-total')).toHaveTextContent(/1\.452,00/)
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta().totalEsperado).toBe(1452)
    expect(cuerpoDelAlta().conFactura).toBe(true)
  })

  it('sin el tilde: la pantalla y el cuerpo son los de siempre (sin totalEsperado ni filas de IVA)', async () => {
    porDefecto = { ventaConFacturaPorDefecto: false }
    await abrirConfirmar()
    expect(await screen.findByRole('switch', { name: 'Con factura' })).not.toBeChecked()
    expect(screen.queryByText('Neto')).toBeNull()
    expect(screen.getByText('Total estimado')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta()).not.toHaveProperty('totalEsperado')
  })

  it('mientras el cálculo no llegó no manda: Confirmar espera y explica por qué', async () => {
    vistaPrevia = () => new Promise(() => undefined)
    await abrirConfirmar()
    expect(await screen.findByText('Calculando…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
    expect(screen.getByText('Esperá a que se calcule el total con IVA.')).toBeTruthy()
    expect(cuerpoDelAlta()).toBeUndefined()
  })

  it('si el cálculo falla con red: no manda, avisa con un mensaje claro y reintenta', async () => {
    vistaPrevia = () => Promise.reject(new ApiError(500, 'Error del servidor'))
    await abrirConfirmar()
    expect(await screen.findByText(/No pudimos calcular el IVA de la venta/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
    expect(cuerpoDelAlta()).toBeUndefined()
    vistaPrevia = () => Promise.resolve(PREVIEW_IVA)
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Neto')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta().totalEsperado).toBe(1452))
  })

  it('sin señal: avisa y la venta se manda con el neto que vio el vendedor como totalEsperado (nunca sin total)', async () => {
    vistaPrevia = () => Promise.reject(new TypeError('Network request failed'))
    await abrirConfirmar()
    expect(await screen.findByText(/El total no incluye el IVA/)).toBeTruthy()
    expect(screen.getByTestId('revisar-total')).toHaveTextContent(/29\.952,00/)
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta()).toBeDefined())
    expect(cuerpoDelAlta().totalEsperado).toBe(29952)
  })

  it('tilde de régimen viejo (IVA 0): un solo total, sin filas de IVA; igual manda el total que vio', async () => {
    vistaPrevia = () => Promise.resolve({ ...PREVIEW_IVA, total: 1200, iva: 0, ivaPorAlicuota: [] })
    await abrirConfirmar()
    await waitFor(() => expect(pedidosDeVistaPrevia().length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled())
    expect(screen.queryByText('Neto')).toBeNull()
    expect(screen.queryByText(/^IVA/)).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(cuerpoDelAlta().totalEsperado).toBe(1200))
  })

  it('409 TotalCambiado: no graba, muestra el total de hoy y el próximo intento usa el total nuevo', async () => {
    await abrirConfirmar()
    expect(await screen.findByText('Neto')).toBeTruthy()
    mockPost.mockImplementation((url: string) => url === '/api/v1/Ventas/vista-previa' ? vistaPrevia()
      : Promise.reject(new ApiError(409, 'El total cambió', undefined, 'TotalCambiado', { total: 1500, lineas: [] })))
    vistaPrevia = () => Promise.resolve({ ...PREVIEW_IVA, total: 1500, totalNeto: 1239.67, iva: 260.33 })
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(await screen.findByText(/El total cambió: ahora es .*1\.500,00/)).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('revisar-total')).toHaveTextContent(/1\.500,00/))
  })
})

describe('IVA encima del neto: entrega con flete, sin señal y presupuesto (L24)', () => {
  it('con flete: Total de productos y Flete como siempre, y debajo Neto, el IVA y el total del servidor', async () => {
    await abrirConfirmar()
    fireEvent.changeText(screen.getByLabelText(/^Flete/), '50')
    expect(await screen.findByText('Neto')).toBeTruthy()
    expect(screen.getByText('Total de productos')).toBeTruthy()
    expect(screen.getByText('Flete (logística propia)')).toBeTruthy()
    expect(screen.getByText('IVA 21 %')).toBeTruthy()
  })

  it('sin flete "Total de productos" y "Neto" son lo mismo: se muestra solo Neto', async () => {
    await abrirConfirmar()
    expect(await screen.findByText('Neto')).toBeTruthy()
    expect(screen.queryByText('Total de productos')).toBeNull()
  })

  it('sin señal en la entrega: el total es el estimado sin IVA y lo dice con todas las letras', async () => {
    vistaPrevia = () => Promise.reject(new TypeError('Network request failed'))
    await abrirConfirmar()
    expect(await screen.findByText('El total no incluye el IVA: se calcula cuando se envía la venta.')).toBeTruthy()
    expect(screen.getByText('Total estimado sin IVA')).toBeTruthy()
    expect(screen.getByTestId('revisar-total')).not.toHaveTextContent(/1\.452/)
  })

  it('sin señal del todo: la venta queda en el teléfono con el tilde y el MISMO cuerpo que se mandó, con el neto como totalEsperado', async () => {
    vistaPrevia = () => Promise.reject(new TypeError('Network request failed'))
    await abrirConfirmar()
    await screen.findByText(/no incluye el IVA/)
    const neto = screen.getByTestId('revisar-total').props.children
    mockPost.mockImplementation((url: string) => url === '/api/v1/Ventas/vista-previa' ? vistaPrevia()
      : url === '/api/v1/Ventas' ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve({ ventaId: 'b1', version: 7, message: '' }))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(leerCola('u')).toHaveLength(1))
    const [v] = leerCola('u')
    expect(v.alta.conFactura).toBe(true)
    expect(v.alta.totalEsperado).toBe(29952)
    expect(JSON.stringify(v.alta)).toBe(JSON.stringify(cuerpoDelAlta()))
    expect(v.estado).toMatchObject({ tipo: 'esperando', fase: { paso: 'altaEnviada' } })
    expect(typeof v.visto.total).toBe('number')
    expect(neto).toBeDefined()
  })

  it('con el cálculo a la vista pero sin respuesta al grabar: la cola guarda el MISMO cuerpo que se mandó (con su totalEsperado)', async () => {
    await abrirConfirmar()
    expect(await screen.findByText('Neto')).toBeTruthy()
    mockPost.mockImplementation((url: string) => url === '/api/v1/Ventas/vista-previa' ? vistaPrevia()
      : url === '/api/v1/Ventas' ? Promise.reject(new TypeError('Network request failed')) : Promise.resolve({ ventaId: 'b1', version: 7, message: '' }))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(leerCola('u')).toHaveLength(1))
    expect(JSON.stringify(leerCola('u')[0].alta)).toBe(JSON.stringify(cuerpoDelAlta()))
    expect(cuerpoDelAlta().totalEsperado).toBe(1452)
  })

  it('un Presupuesto con factura muestra el mismo desglose (se pide la vista previa como Presupuesto) y no espera el cálculo para guardarse', async () => {
    await abrirPresupuesto()
    expect(await screen.findByText('Neto')).toBeTruthy()
    expect(screen.getByText('IVA 21 %')).toBeTruthy()
    expect(pedidosDeVistaPrevia()[0][1].tipoOperacion).toBe(1)
  })

  it('un Presupuesto sin factura no pide la vista previa (como hoy)', async () => {
    porDefecto = { ventaConFacturaPorDefecto: false }
    await abrirPresupuesto()
    expect(await screen.findByRole('switch', { name: 'Con factura' })).not.toBeChecked()
    expect(pedidosDeVistaPrevia()).toHaveLength(0)
    expect(screen.queryByText('Neto')).toBeNull()
  })
})
