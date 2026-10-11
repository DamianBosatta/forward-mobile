import { MutationObserver, QueryObserver } from '@tanstack/react-query'
import { crearQueryClient, debePersistir, inicioKeys } from '../queryClient'

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
