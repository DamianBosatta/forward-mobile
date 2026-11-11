import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { dehydrate, hydrate, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/libs/api-client'
import { crearQueryClient, opcionesDePersistencia } from '@/core/query/queryClient'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { elegirDepositoDeSesion, limpiarDepositoDeSesion } from '@/features/deposito-sesion'
import { useHoraDelCatalogo } from '@/features/venta-sin-senal/hooks/useHoraDelCatalogo'
import { CLAVE_CATALOGO, claveCatalogo, useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useDepositoElegidoStore } from '../hooks/useDepositoDeVenta'
import { producto } from '../__testing__/producto'

jest.mock('@/libs/api-client', () => ({ api: { get: jest.fn() }, productosKeys: { all: ['productos'] } }))
const get = api.get as jest.Mock

const PROPIO = '11111111-1111-4111-8111-111111111111'
const NORTE = '22222222-2222-4222-8222-222222222222'
const SUR = '33333333-3333-4333-8333-333333333333'

let qc: ReturnType<typeof crearQueryClient>
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

/** Lo que queda en el teléfono (el mismo filtro que PersistQueryClientProvider). */
const guardadas = () => dehydrate(qc, opcionesDePersistencia).queries.map((q) => JSON.stringify(q.queryKey))
const clave = (k: readonly unknown[]) => JSON.stringify(k)

const conCapacidad = () =>
  useAuthStore.setState({ user: { id: 'u', roles: [], depositoId: PROPIO, permissions: [{ module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true }] } as never })

async function montarCatalogo() {
  const r = renderHook(() => useCatalogoVenta(''), { wrapper })
  await waitFor(() => expect(r.result.current.cargado).toBe(true))
  return r
}

beforeEach(() => {
  qc = crearQueryClient({ retry: false })
  conCapacidad()
  useDepositoElegidoStore.setState({ elegido: null })
  get.mockReset()
  get.mockImplementation(async (url: string) => {
    const dep = new URLSearchParams(url.split('?')[1]).get('depositoId') ?? PROPIO
    return { items: [producto({ id: `p-${dep}` })], hasNextPage: false }
  })
})
afterEach(() => limpiarDepositoDeSesion())

describe('S3: el catálogo de la venta sin señal es el del depósito de la sesión', () => {
  it('el del depósito de la sesión se guarda en el teléfono con su depósito en la clave', async () => {
    elegirDepositoDeSesion('u', NORTE)
    await montarCatalogo()
    expect(guardadas()).toContain(clave(claveCatalogo(NORTE)))
    expect(get.mock.calls.every(([u]) => u.includes(`depositoId=${NORTE}`))).toBe(true)
  })

  it('tras reiniciar la app sin señal, la venta tiene el catálogo del depósito de la sesión', async () => {
    elegirDepositoDeSesion('u', NORTE)
    const { unmount } = await montarCatalogo()
    const guardado = dehydrate(qc, opcionesDePersistencia)
    unmount()

    qc = crearQueryClient({ retry: false })
    hydrate(qc, JSON.parse(JSON.stringify(guardado)))
    get.mockRejectedValue(new Error('Network request failed'))
    const { result } = renderHook(() => useCatalogoVenta(''), { wrapper })
    await act(async () => {})
    expect(result.current.productos.map((p) => p.id)).toEqual([`p-${NORTE}`])
  })

  it('un depósito elegido para una venta (distinto del de la sesión) queda solo en memoria', async () => {
    elegirDepositoDeSesion('u', NORTE)
    useDepositoElegidoStore.setState({ elegido: SUR })
    await montarCatalogo()
    expect(qc.getQueryData(claveCatalogo(SUR))).toBeDefined()
    expect(guardadas()).not.toContain(clave(claveCatalogo(SUR)))
  })

  it('elegir para la venta el mismo depósito de la sesión sigue guardándolo', async () => {
    elegirDepositoDeSesion('u', NORTE)
    useDepositoElegidoStore.setState({ elegido: NORTE })
    await montarCatalogo()
    expect(guardadas()).toContain(clave(claveCatalogo(NORTE)))
  })

  it('el del depósito propio sigue como siempre: su clave sin depósito, sin depositoId, guardado', async () => {
    await montarCatalogo()
    expect(guardadas()).toContain(clave(CLAVE_CATALOGO))
    expect(get.mock.calls.every(([u]) => !u.includes('depositoId'))).toBe(true)
  })

  it('al cambiar el depósito de la sesión se descarta el catálogo guardado del anterior (el del propio queda)', async () => {
    qc.setQueryData(CLAVE_CATALOGO, { items: [], truncado: false })
    elegirDepositoDeSesion('u', NORTE)
    const primero = await montarCatalogo()
    primero.unmount()

    act(() => elegirDepositoDeSesion('u', SUR))
    await montarCatalogo()
    expect(guardadas()).toContain(clave(claveCatalogo(SUR)))
    expect(guardadas()).toContain(clave(CLAVE_CATALOGO))
    expect(qc.getQueryData(claveCatalogo(NORTE))).toBeUndefined()
  })

  it('elegir el depósito propio para una venta (o retomar una que lo trae) no descarta el catálogo de la sesión', async () => {
    elegirDepositoDeSesion('u', NORTE)
    const r = await montarCatalogo()
    expect(guardadas()).toContain(clave(claveCatalogo(NORTE)))

    act(() => useDepositoElegidoStore.setState({ elegido: PROPIO }))
    await waitFor(() => expect(qc.getQueryData(CLAVE_CATALOGO)).toBeDefined())
    expect(r.result.current.cargado).toBe(true)
    expect(qc.getQueryData(claveCatalogo(NORTE))).toBeDefined()
    expect(guardadas()).toContain(clave(claveCatalogo(NORTE)))
    expect(guardadas()).toContain(clave(CLAVE_CATALOGO))
  })
})

describe('S3: "Precios y stock de las HH:MM" es la hora del catálogo del depósito en uso', () => {
  it('lee el catálogo del depósito de la sesión, no el del propio', () => {
    elegirDepositoDeSesion('u', NORTE)
    qc.setQueryData(CLAVE_CATALOGO, { items: [], truncado: false }, { updatedAt: Date.UTC(2026, 9, 22, 11, 0) })
    qc.setQueryData(claveCatalogo(NORTE), { items: [], truncado: false }, { updatedAt: Date.UTC(2026, 9, 22, 23, 5) })
    const { result } = renderHook(() => useHoraDelCatalogo(), { wrapper })
    expect(result.current).toBe('20:05')
  })

  it('con el depósito propio en la sesión lee el catálogo de siempre', () => {
    qc.setQueryData(CLAVE_CATALOGO, { items: [], truncado: false }, { updatedAt: Date.UTC(2026, 9, 22, 11, 0) })
    const { result } = renderHook(() => useHoraDelCatalogo(), { wrapper })
    expect(result.current).toBe('08:00')
  })
})
