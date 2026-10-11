import React from 'react'
import { dehydrate, MutationObserver, onlineManager, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'
import { useCambiarContrasena } from '@/features/cuenta/api/cuenta'
import { crearQueryClient, debePersistir, inicioKeys, opcionesDePersistencia } from '../queryClient'

jest.mock('@/core/api/client', () => ({ api: { post: () => Promise.resolve(true) } }))

const consulta = (qc: ReturnType<typeof crearQueryClient>, queryKey: unknown[]) => qc.getQueryCache().find({ queryKey })!

describe('debePersistir: lo que se guarda en el teléfono', () => {
  it('una respuesta con datos se guarda; `null` (p. ej. servidor sin el endpoint) no', () => {
    const qc = crearQueryClient()
    qc.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: null })
    expect(debePersistir(consulta(qc, ['inicio', 'resumen']))).toBe(true)

    qc.setQueryData(['inicio', 'resumen'], null)
    expect(debePersistir(consulta(qc, ['inicio', 'resumen']))).toBe(false)
  })

  it('no se guardan las listas, el catálogo ni lo marcado con persist: false', () => {
    const qc = crearQueryClient()
    qc.setQueryData(['ventas', 'list', { pageNumber: 1 }], { items: [] })
    qc.setQueryData(['productos', 'catalogoStock'], [])
    expect(debePersistir(consulta(qc, ['ventas', 'list', { pageNumber: 1 }]))).toBe(false)
    expect(debePersistir(consulta(qc, ['productos', 'catalogoStock']))).toBe(false)
  })
})

describe('Inicio se refresca tras las mutaciones', () => {
  const colgada = <T,>(p: Promise<T>) => Promise.race([p, new Promise<'colgada'>((r) => setTimeout(() => r('colgada'), 300))])

  it('la mutación no espera a que vuelva el resumen (Inicio siempre está montado)', async () => {
    const qc = crearQueryClient()
    // El resumen en pantalla, con un servidor que no contesta.
    const soltar = new QueryObserver(qc, { queryKey: inicioKeys.resumen(), queryFn: () => new Promise(() => {}) }).subscribe(() => {})
    qc.setQueryData(inicioKeys.resumen(), { ventas: null, compras: null, autorizacionesPendientes: null })

    expect(await colgada(new MutationObserver(qc, { mutationFn: async () => 'ok' }).mutate())).toBe('ok')
    expect(qc.getQueryState(inicioKeys.resumen())?.isInvalidated).toBe(true)
    soltar()
  })

  it('también tras un error (p. ej. un 409: la venta cambió); no con meta.noRefrescaInicio (una búsqueda)', async () => {
    const qc = crearQueryClient()
    qc.setQueryData(inicioKeys.resumen(), { ventas: null, compras: null, autorizacionesPendientes: null })
    await new MutationObserver(qc, { mutationFn: async () => 'ok', meta: { noRefrescaInicio: true } }).mutate()
    expect(qc.getQueryState(inicioKeys.resumen())?.isInvalidated).toBe(false)

    await new MutationObserver(qc, { mutationFn: () => Promise.reject(new Error('409')) }).mutate().catch(() => undefined)
    expect(qc.getQueryState(inicioKeys.resumen())?.isInvalidated).toBe(true)
  })
})

describe('mutaciones que se guardan en el teléfono', () => {
  afterEach(() => onlineManager.setOnline(true))

  it('solo las que quedaron en pausa (sin red), y nunca el cambio de contraseña', async () => {
    const qc = crearQueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useCambiarContrasena(), { wrapper })
    const cambio = { email: 'a@b.c', currentPassword: 'Vieja.12345', newPassword: 'Nueva.12345', confirmNewPassword: 'Nueva.12345' }

    // Terminada: no se guarda.
    await act(async () => { await result.current.mutateAsync(cambio) })
    await new MutationObserver(qc, { mutationFn: async () => 'ok' }).mutate()
    expect(dehydrate(qc, opcionesDePersistencia).mutations).toHaveLength(0)

    // Sin red queda en pausa: una cualquiera se guarda para mandarla después; la de contraseña, no.
    onlineManager.setOnline(false)
    act(() => { result.current.mutate(cambio) })
    void new MutationObserver(qc, { mutationFn: async () => 'ok', mutationKey: ['otra'] }).mutate()
    await act(async () => {})
    const guardadas = dehydrate(qc, opcionesDePersistencia).mutations
    expect(guardadas.map((m) => m.mutationKey)).toEqual([['otra']])
    expect(JSON.stringify(guardadas)).not.toContain('Nueva.12345')
  })
})
