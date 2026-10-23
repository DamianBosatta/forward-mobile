import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import type { GestorStock, OyenteStock } from '@/core/realtime/stockEnVivo'
import { CLAVE_CATALOGO } from '../hooks/useCatalogoVenta'
import { useStockVivoVenta } from '../hooks/useStockVivoVenta'
import { producto } from '../__testing__/producto'
import type { LineaCarrito } from '../lib/carrito'

jest.mock('@/core/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

function gestorFalso() {
  const g = { oyente: null as OyenteStock | null, ids: [] as string[] }
  const gestor = {
    suscribir: jest.fn((ids: string[], o: OyenteStock) => { g.oyente = o; g.ids = ids; return jest.fn() }),
    reintentar: jest.fn(),
    enVivo: () => false,
  } as unknown as GestorStock
  return { g, gestor }
}

let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const linea = (id: string, cantidad: number, nombre = 'Producto X'): LineaCarrito => ({ productoId: id, producto: producto({ id, nombre }), cantidad, descuentoPct: 0 })

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(CLAVE_CATALOGO, { items: [producto({ id: 'p1', disponible: 9 }), producto({ id: 'p2', disponible: 4 })], truncado: false })
})

describe('useStockVivoVenta (S1, S2)', () => {
  it('se une al depósito de la venta', () => {
    const { g, gestor } = gestorFalso()
    renderHook(() => useStockVivoVenta([linea('p1', 5)], gestor), { wrapper })
    expect(g.ids).toEqual([DEPOSITO_CENTRAL_ID])
  })

  it('una línea cuyo producto cambió queda marcada con su aviso; las demás no', () => {
    const { g, gestor } = gestorFalso()
    const lineas = [linea('p1', 5), linea('p2', 1, 'Otro')]
    const { result } = renderHook(() => useStockVivoVenta(lineas, gestor), { wrapper })
    act(() => g.oyente!.alCambio({ depositoId: DEPOSITO_CENTRAL_ID, productos: [{ productoId: 'p1', estado: 'EnAlerta', disponible: 3, stockMinimo: 10 }] }))
    expect(result.current.avisos).toEqual({ p1: 'Quedan 3 de Producto X (cargaste 5)' })
  })

  it('el aviso sigue a la cantidad de la línea y se va si ya alcanza', () => {
    const { g, gestor } = gestorFalso()
    let lineas = [linea('p1', 5)]
    const { result, rerender } = renderHook(() => useStockVivoVenta(lineas, gestor), { wrapper })
    act(() => g.oyente!.alCambio({ depositoId: 'd', productos: [{ productoId: 'p1', estado: 'SinStock', disponible: 0, stockMinimo: 10 }] }))
    expect(result.current.avisos.p1).toMatch(/sin stock/)
    act(() => g.oyente!.alCambio({ depositoId: 'd', productos: [{ productoId: 'p1', estado: 'ConStock', disponible: 80, stockMinimo: 10 }] }))
    lineas = [linea('p1', 6)]
    rerender({})
    expect(result.current.avisos).toEqual({})
  })

  it('un producto que no está en las líneas no genera aviso', () => {
    const { g, gestor } = gestorFalso()
    const lineas = [linea('p1', 5)]
    const { result } = renderHook(() => useStockVivoVenta(lineas, gestor), { wrapper })
    act(() => g.oyente!.alCambio({ depositoId: 'd', productos: [{ productoId: 'p2', estado: 'SinStock' }] }))
    expect(result.current.avisos).toEqual({})
  })

  it('con cantidades actualiza el disponible de esa fila del catálogo sin volver a pedirlo', () => {
    const { g, gestor } = gestorFalso()
    const lineas = [linea('p1', 5)]
    renderHook(() => useStockVivoVenta(lineas, gestor), { wrapper })
    act(() => g.oyente!.alCambio({ depositoId: 'd', productos: [{ productoId: 'p1', estado: 'EnAlerta', disponible: 3, stockMinimo: 10 }] }))
    const d = qc.getQueryData<{ items: { id: string; disponible: number }[] }>(CLAVE_CATALOGO)!
    expect(d.items.find((p) => p.id === 'p1')!.disponible).toBe(3)
    expect(qc.getQueryState(CLAVE_CATALOGO)!.isInvalidated).toBe(false)
  })

  it('solo con el estado (sin números) vuelve a pedir el catálogo', () => {
    const { g, gestor } = gestorFalso()
    const lineas = [linea('p1', 5)]
    renderHook(() => useStockVivoVenta(lineas, gestor), { wrapper })
    act(() => g.oyente!.alCambio({ depositoId: 'd', productos: [{ productoId: 'p1', estado: 'EnAlerta' }] }))
    expect(qc.getQueryState(CLAVE_CATALOGO)!.isInvalidated).toBe(true)
  })

  it('al (re)conectar invalida el catálogo y descarta los avisos viejos', () => {
    const { g, gestor } = gestorFalso()
    const lineas = [linea('p1', 5)]
    const { result } = renderHook(() => useStockVivoVenta(lineas, gestor), { wrapper })
    act(() => g.oyente!.alCambio({ depositoId: 'd', productos: [{ productoId: 'p1', estado: 'SinStock' }] }))
    expect(result.current.avisos.p1).toBeDefined()
    act(() => g.oyente!.alConectar())
    expect(qc.getQueryState(CLAVE_CATALOGO)!.isInvalidated).toBe(true)
    expect(result.current.avisos).toEqual({})
  })

  it('informa si hay conexión', () => {
    const { g, gestor } = gestorFalso()
    const { result } = renderHook(() => useStockVivoVenta([], gestor), { wrapper })
    expect(result.current.enVivo).toBe(false)
    act(() => g.oyente!.alEstado(true))
    expect(result.current.enVivo).toBe(true)
  })
})
