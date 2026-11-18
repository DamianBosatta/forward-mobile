import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, useMutation, type UseMutationResult } from '@tanstack/react-query'
import { useConfirmarCompra, useRecibirCompra, borradorCompraApi } from '../compras'
import { useCreateSocio } from '../socios'
import { useCrearEvento } from '../calendario'
import { guardarBorradorVenta, useAutorizarVenta, useConvertirPresupuesto, useIniciarBorradorVenta } from '../ventas'
import { useAjustarStock } from '../stock'
import { useAbrirCaja } from '../finanzas'
import { api } from '../client'

jest.mock('../client', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), postConSobre: jest.fn() },
  API_URL: 'x',
}))

const mock = api as unknown as Record<'get' | 'post' | 'put' | 'postConSobre', jest.Mock>
let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

beforeEach(() => {
  jest.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  mock.post.mockResolvedValue(true)
  mock.put.mockResolvedValue(undefined)
  mock.postConSobre.mockResolvedValue({ data: 'x', sobre: {} })
})

type Metodo = 'post' | 'put' | 'postConSobre'
interface Caso {
  nombre: string
  metodo: Metodo
  url: string
  /** Lo que ya mandaba la llamada antes de la clave: tiene que seguir viajando igual. */
  cuerpo: Record<string, unknown>
  usar: () => unknown
  vars: unknown
  otras: unknown
}

const LINEA = { compraDetalleId: 'd1', cantidadRecibida: 2 }

/** `borradorCompraApi.iniciar` es una llamada suelta (la usa `useCompraBorrador`): se la envuelve en una mutación para correr los mismos casos. */
const useIniciarBorradorCompra = () =>
  useMutation({ mutationFn: (v: { proveedorId: string; depositoId: string }) => borradorCompraApi.iniciar(v.proveedorId, v.depositoId) })

const SOCIO = { razonSocial: 'Almacén Don José', cuit: '20123456786', tipoRaw: 1, direccion: 'Mitre 123' }
const EVENTO = { tipo: 'Tarea', titulo: 'Visita', fechaInicio: '2026-11-20', avisarDiasAntes: 0, visibilidad: 'Personal' }

const casos: Caso[] = [
  {
    nombre: 'confirmar compra', metodo: 'post', url: '/api/v1/Compras/c1/confirmar', cuerpo: { compraId: 'c1' },
    usar: useConfirmarCompra, vars: 'c1', otras: 'c2',
  },
  {
    nombre: 'recibir compra', metodo: 'post', url: '/api/v1/Compras/c1/recibir',
    cuerpo: { compraId: 'c1', fechaFacturaProveedor: null },
    usar: useRecibirCompra, vars: { id: 'c1' }, otras: { id: 'c1', fechaFacturaProveedor: '2026-11-14' },
  },
  {
    nombre: 'recibir compra parcial', metodo: 'postConSobre', url: '/api/v1/Compras/c1/recibir-parcial',
    cuerpo: { fechaFacturaProveedor: null, lineas: [LINEA] },
    usar: useRecibirCompra, vars: { id: 'c1', lineas: [LINEA] }, otras: { id: 'c1', lineas: [{ ...LINEA, cantidadRecibida: 1 }] },
  },
  {
    nombre: 'autorizar venta', metodo: 'post', url: '/api/v1/Ventas/v1/autorizar',
    cuerpo: { ventaId: 'v1', version: 3, razon: null },
    usar: useAutorizarVenta, vars: { id: 'v1', version: 3 }, otras: { id: 'v1', version: 4 },
  },
  {
    nombre: 'convertir presupuesto a pedido', metodo: 'put', url: '/api/v1/Ventas/v1/convertir-a-pedido',
    cuerpo: { ventaId: 'v1', version: 3, usuarioGeneradorId: 'u1' },
    usar: useConvertirPresupuesto, vars: { id: 'v1', version: 3, usuarioGeneradorId: 'u1' }, otras: { id: 'v1', version: 4, usuarioGeneradorId: 'u1' },
  },
  {
    nombre: 'alta de borrador de venta', metodo: 'post', url: '/api/v1/Ventas/borradores',
    cuerpo: { clienteId: 'cl1', depositoId: 'd1' },
    usar: useIniciarBorradorVenta, vars: { clienteId: 'cl1', depositoId: 'd1' }, otras: { clienteId: 'cl2', depositoId: 'd1' },
  },
  {
    nombre: 'ajuste de stock', metodo: 'post', url: '/api/v1/Stocks/adjust',
    cuerpo: { productoId: 'p1', depositoId: 'd1', cantidad: 5 },
    usar: useAjustarStock, vars: { productoId: 'p1', depositoId: 'd1', cantidad: 5 }, otras: { productoId: 'p1', depositoId: 'd1', cantidad: 6 },
  },
  {
    nombre: 'abrir caja', metodo: 'post', url: '/api/v1/Cajas/abrir', cuerpo: { saldoInicial: 100 },
    usar: useAbrirCaja, vars: 100, otras: 200,
  },
  {
    nombre: 'alta de borrador de compra', metodo: 'post', url: '/api/v1/Compras/borradores',
    cuerpo: { proveedorId: 'pr1', depositoId: 'd1' },
    usar: useIniciarBorradorCompra, vars: { proveedorId: 'pr1', depositoId: 'd1' }, otras: { proveedorId: 'pr2', depositoId: 'd1' },
  },
  {
    nombre: 'alta de socio comercial', metodo: 'post', url: '/api/v1/socios-comerciales', cuerpo: SOCIO,
    usar: useCreateSocio, vars: SOCIO, otras: { ...SOCIO, razonSocial: 'Almacén Don José SRL' },
  },
  {
    nombre: 'alta de evento del calendario', metodo: 'post', url: '/api/v1/Calendario/eventos', cuerpo: EVENTO,
    usar: useCrearEvento, vars: EVENTO, otras: { ...EVENTO, titulo: 'Visita al cliente' },
  },
]

const llamadas = (c: Caso) => mock[c.metodo].mock.calls.filter((l) => l[0] === c.url)
const claveDe = (c: Caso, n: number) => (llamadas(c)[n][1] as { claveIdempotencia: string }).claveIdempotencia
type Mut = UseMutationResult<unknown, Error, never>

describe.each(casos)('$nombre: una clave por intento', (c) => {
  const hook = () => renderHook(() => c.usar() as Mut, { wrapper })

  it('manda la clave y deja el resto del cuerpo como estaba', async () => {
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync(c.vars as never) })
    expect(llamadas(c)).toHaveLength(1)
    expect(llamadas(c)[0][1]).toEqual({ ...c.cuerpo, claveIdempotencia: expect.stringMatching(/^mobile-/) })
  })

  it('el reintento tras un corte de red repite la misma clave', async () => {
    mock[c.metodo].mockRejectedValueOnce(new Error('Network request failed'))
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync(c.vars as never).catch(() => undefined) })
    await act(async () => { await result.current.mutateAsync(c.vars as never) })
    expect(llamadas(c)).toHaveLength(2)
    // Sin clave, `undefined` sería igual a `undefined`: primero se exige que la clave viaje.
    expect(claveDe(c, 0)).toMatch(/^mobile-/)
    expect(claveDe(c, 1)).toBe(claveDe(c, 0))
  })

  it('un doble toque con la primera todavía en vuelo manda la misma clave', async () => {
    const { result } = hook()
    await act(async () => { await Promise.all([result.current.mutateAsync(c.vars as never), result.current.mutateAsync(c.vars as never)]) })
    expect(claveDe(c, 0)).toMatch(/^mobile-/)
    expect(claveDe(c, 1)).toBe(claveDe(c, 0))
  })

  it('después de grabar, la operación siguiente (mismo cuerpo) usa otra clave', async () => {
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync(c.vars as never) })
    await act(async () => { await result.current.mutateAsync(c.vars as never) })
    expect(claveDe(c, 1)).not.toBe(claveDe(c, 0))
  })

  it('si el cuerpo cambió tras un error es otro intento: otra clave', async () => {
    mock[c.metodo].mockRejectedValueOnce(new Error('400'))
    const { result } = hook()
    await act(async () => { await result.current.mutateAsync(c.vars as never).catch(() => undefined) })
    await act(async () => { await result.current.mutateAsync(c.otras as never) })
    // `otras` puede ir a otra URL (otra compra): se comparan las dos llamadas del método.
    const todas = mock[c.metodo].mock.calls as [string, { claveIdempotencia: string }][]
    expect(todas).toHaveLength(2)
    expect(todas[1][1].claveIdempotencia).not.toBe(todas[0][1].claveIdempotencia)
  })
})

describe('compras: una sola llamada de confirmar para el hook y el borrador', () => {
  it('el borrador confirma con la misma función y la misma clave en el reintento', async () => {
    mock.post.mockRejectedValueOnce(new Error('Network request failed'))
    await borradorCompraApi.confirmar('c9').catch(() => undefined)
    await borradorCompraApi.confirmar('c9')
    const l = mock.post.mock.calls.filter((x) => x[0] === '/api/v1/Compras/c9/confirmar')
    expect(l).toHaveLength(2)
    expect(l[1][1]).toEqual({ compraId: 'c9', claveIdempotencia: l[0][1].claveIdempotencia })
  })
})

describe('autoguardado del borrador de venta (PUT /Ventas/{id})', () => {
  it('la misma versión y el mismo cuerpo repiten la clave; la versión siguiente es otra', async () => {
    mock.put.mockRejectedValueOnce(new Error('Network request failed'))
    await guardarBorradorVenta('v1', 1, { items: [] }).catch(() => undefined)
    await guardarBorradorVenta('v1', 1, { items: [] })
    await guardarBorradorVenta('v1', 2, { items: [] })
    const l = mock.put.mock.calls.filter((x) => x[0] === '/api/v1/Ventas/v1')
    expect(l[1][1].claveIdempotencia).toBe(l[0][1].claveIdempotencia)
    expect(l[2][1].claveIdempotencia).not.toBe(l[0][1].claveIdempotencia)
    expect(l[0][1]).toMatchObject({ items: [], id: 'v1', version: 1 })
  })
})
