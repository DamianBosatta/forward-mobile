import { crearQueryClient, debePersistir } from '../queryClient'

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
