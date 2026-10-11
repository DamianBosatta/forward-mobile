import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCompraBorrador } from '../../hooks/useCompraBorrador'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
  API_URL: 'x',
}))

const ESPERA = { timeout: 3000 }
const BALDE = { id: 'pr1', nombre: 'Balde Nuvia 10L' }
const BORRADOR = {
  id: 'b9', version: 40, proveedorId: 'p1', depositoId: 'd2', gastosOperativos: 500, subtotalBrutoAmount: 1000, descuentoTotalAmount: 99.99,
  detalles: [{ productoId: 'pr1', nombreProducto: 'Balde', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 0, descuentoPorcentaje: 10, moneda: 'USD' }],
}

function socio(id: string) {
  return id === 'p2'
    ? { id, razonSocial: 'Gorrión Mayorista', condicionesDeCompraFaltantes: ['condición de pago'] }
    : { id, razonSocial: 'Insumos del Sur SA', condicionPago: { descripcion: '30 días' }, condicionesDeCompraFaltantes: [] }
}

function usar(borrador?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { ...renderHook(() => useCompraBorrador(borrador), { wrapper }), qc }
}

const puts = () => mockPut.mock.calls.map(([, body]) => body as { version: number; descuentoPorcentaje: number; detalles: { cantidad: number; costoUnitario: number; monedaCosto: string; unidadCompra: string }[] })

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve(socio(url.split('/').pop()!))
    if (url === '/api/v1/Productos/pr1') return Promise.resolve({ id: 'pr1', precioCompraBase: 1020 })
    if (url === '/api/v1/Compras/b9') return Promise.resolve(BORRADOR)
    return Promise.reject(new Error(url))
  })
  mockPost.mockImplementation((url: string) =>
    Promise.resolve(url === '/api/v1/Compras/borradores' ? { compraId: 'c1', version: 10, message: 'ok' } : undefined))
  let v = 10
  mockPut.mockImplementation(() => Promise.resolve({ compraId: 'c1', version: ++v, message: 'ok' }))
})

describe('useCompraBorrador', () => {
  it('a un proveedor sin condiciones de compra no se le crea el borrador: se informa lo que falta', async () => {
    const { result } = usar()
    await act(() => result.current.elegirProveedor('p2'))
    expect(result.current.faltantes).toEqual({ nombre: 'Gorrión Mayorista', lista: ['condición de pago'] })
    expect(result.current.proveedor).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('crea el borrador en el depósito por defecto, precarga el último costo y encadena la versión de cada PUT', async () => {
    const { result } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/borradores', { proveedorId: 'p1', depositoId: DEPOSITO_CENTRAL_ID })
    expect(result.current.proveedor).toEqual({ id: 'p1', nombre: 'Insumos del Sur SA', condicion: '30 días' })

    act(() => result.current.setCantidadProducto(BALDE, 2))
    await waitFor(() => expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 2, costoUnitario: 1020 }), ESPERA)
    act(() => result.current.setCantidadProducto(BALDE, 5))
    await waitFor(() => expect(puts().at(-1)?.detalles[0].cantidad).toBe(5), ESPERA)
    expect(puts().map((p) => p.version)).toEqual(puts().map((_, i) => 10 + i))
  })

  it('confirmar guarda primero lo que todavía no se guardó y después confirma', async () => {
    const { result } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setLineas([{ productoId: 'pr1', nombre: 'Balde', cantidad: 3, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: 900 }]))
    await act(() => result.current.confirmar())
    expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 3, costoUnitario: 900 })
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Compras/c1/confirmar', { compraId: 'c1' })
    expect(mockPut.mock.invocationCallOrder.at(-1)!).toBeLessThan(mockPost.mock.invocationCallOrder.at(-1)!)
  })

  it('confirmar marca el resumen de Inicio para volver a pedirlo (no pasa por una mutación de react-query)', async () => {
    const { result, qc } = usar()
    qc.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: null })
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setLineas([{ productoId: 'pr1', nombre: 'Balde', cantidad: 3, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: 900 }]))
    await act(() => result.current.confirmar())
    expect(qc.getQueryState(['inicio', 'resumen'])?.isInvalidated).toBe(true)
  })

  it('retomar un borrador lo trae del servidor sin reenviarlo, con unidad de compra y descuento', async () => {
    const { result } = usar('b9')
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.lineas[0]).toMatchObject({ cantidad: 4, unidad: 'Bulto', unidadesPorUnidad: 12, costoUnitario: null })
    expect(result.current.descuentoPorcentaje).toBe(10)
    await new Promise((r) => setTimeout(r, 1000))
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('un 409 (otro usuario cambió el borrador) frena el autoguardado', async () => {
    mockPut.mockRejectedValue(Object.assign(new Error('Error de concurrencia'), { status: 409 }))
    const { result } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setCantidadProducto(BALDE, 1))
    await waitFor(() => expect(result.current.estado).toBe('conflicto'), ESPERA)
    const intentos = mockPut.mock.calls.length
    act(() => result.current.setCantidadProducto(BALDE, 2))
    await new Promise((r) => setTimeout(r, 1200))
    expect(mockPut.mock.calls.length).toBe(intentos)
  })

  it('retomar un borrador con 10 % y líneas en USD: lo que se vuelve a guardar conserva el 10 y el USD exactos', async () => {
    const { result } = usar('b9')
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.descuentoPorcentaje).toBe(10)
    act(() => result.current.setLineas((prev) => prev.map((l) => ({ ...l, cantidad: 5 }))))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    expect(puts()[0].descuentoPorcentaje).toBe(10)
    expect(puts()[0].detalles[0]).toMatchObject({ monedaCosto: 'USD', unidadCompra: 'Bulto', cantidad: 5 })
  })

  it('un rechazo del servidor (400) no se reintenta solo: un único PUT; un cambio nuevo o "Reintentar" sí guardan', async () => {
    mockPut.mockRejectedValueOnce(Object.assign(new Error('Costo inválido'), { status: 400 }))
    const { result } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setCantidadProducto(BALDE, 1))
    await waitFor(() => expect(result.current.estado).toBe('error'), ESPERA)
    await new Promise((r) => setTimeout(r, 2000))
    expect(mockPut).toHaveBeenCalledTimes(1)
    act(() => result.current.setCantidadProducto(BALDE, 2))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2), ESPERA)
    await waitFor(() => expect(result.current.estado).toBe('guardado'), ESPERA)
  })

  it('"Reintentar" vuelve a mandar la misma instantánea que falló', async () => {
    mockPut.mockRejectedValueOnce(Object.assign(new Error('Error'), { status: 500 }))
    const { result } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setCantidadProducto(BALDE, 1))
    await waitFor(() => expect(result.current.estado).toBe('error'), ESPERA)
    await act(() => result.current.reintentar())
    expect(mockPut).toHaveBeenCalledTimes(2)
    expect(result.current.estado).toBe('guardado')
  })

  it('salir antes de los 800 ms manda igual lo que se había cambiado', async () => {
    const { result, unmount } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setLineas([{ productoId: 'pr1', nombre: 'Balde', cantidad: 7, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: 900 }]))
    expect(mockPut).not.toHaveBeenCalled()
    unmount()
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    expect(puts()[0]).toMatchObject({ version: 10 })
    expect(puts()[0].detalles[0]).toMatchObject({ cantidad: 7, costoUnitario: 900 })
  })

  it('descartar con un cambio pendiente no lo guarda: ni el debounce ni la salida mandan nada', async () => {
    mockPost.mockImplementation((url: string) =>
      Promise.resolve(url === '/api/v1/Compras/borradores' ? { compraId: 'c1', version: 10, message: 'ok' } : true))
    const { result, unmount } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setLineas([{ productoId: 'pr1', nombre: 'Balde', cantidad: 7, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: 900 }]))
    await act(() => result.current.descartar())
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Compras/c1/descartar-borrador', {})
    await new Promise((r) => setTimeout(r, 1200))
    unmount()
    await new Promise((r) => setTimeout(r, 50))
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('descartar espera al guardado que está en vuelo antes de borrar', async () => {
    let soltar: () => void = () => {}
    mockPut.mockImplementation(() => new Promise((res) => { soltar = () => res({ compraId: 'c1', version: 11, message: 'ok' }) }))
    mockPost.mockImplementation((url: string) =>
      Promise.resolve(url === '/api/v1/Compras/borradores' ? { compraId: 'c1', version: 10, message: 'ok' } : true))
    const { result } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setCantidadProducto(BALDE, 1))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    let listo = false
    const d = result.current.descartar().then(() => { listo = true })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Compras/c1/descartar-borrador', {})
    await act(async () => { soltar(); await d })
    expect(listo).toBe(true)
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Compras/c1/descartar-borrador', {})
  })

  it('salir con un cambio pendiente y reabrir el mismo borrador: el GET espera al guardado de salida y trae lo guardado, sin 409 después', async () => {
    let soltar: () => void = () => {}
    mockPut.mockImplementationOnce(() => new Promise((res) => { soltar = () => res({ compraId: 'c1', version: 11, message: 'ok' }) }))
    const { result, unmount } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setLineas([{ productoId: 'pr1', nombre: 'Balde', cantidad: 7, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: 900 }]))
    unmount()
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    const antes = mockGet.mock.calls.length
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve(socio(url.split('/').pop()!))
      if (url === '/api/v1/Compras/c1') return Promise.resolve({ ...BORRADOR, id: 'c1', version: 11, detalles: [{ ...BORRADOR.detalles[0], cantidad: 7, cantidadIngresada: 7, unidadCompra: 'Unidad', descuentoPorcentaje: 0 }] })
      return Promise.reject(new Error(url))
    })
    const otra = usar('c1')
    await new Promise((r) => setTimeout(r, 50))
    expect(mockGet.mock.calls.slice(antes).some(([u]) => u === '/api/v1/Compras/c1')).toBe(false)
    await act(async () => { soltar() })
    await waitFor(() => expect(otra.result.current.cargando).toBe(false))
    expect(otra.result.current.lineas[0].cantidad).toBe(7)
    act(() => otra.result.current.setLineas((prev) => prev.map((l) => ({ ...l, cantidad: 8 }))))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2), ESPERA)
    expect(puts()[1]).toMatchObject({ version: 11 })
  })

  it('salir mientras el guardado en vuelo ya guardó esa misma instantánea no manda un PUT de más', async () => {
    let soltar: () => void = () => {}
    mockPut.mockImplementationOnce(() => new Promise((res) => { soltar = () => res({ compraId: 'c1', version: 11, message: 'ok' }) }))
    const { result, unmount } = usar()
    await act(() => result.current.elegirProveedor('p1'))
    act(() => result.current.setCantidadProducto(BALDE, 1))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    unmount()
    await act(async () => { soltar() })
    await new Promise((r) => setTimeout(r, 100))
    expect(mockPut).toHaveBeenCalledTimes(1)
  })
})
