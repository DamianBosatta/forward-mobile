import { itemsCargados, totalDelServidor, textoContador } from '../lib/contador'

const pagina = (n: number, totalCount: number) => ({
  items: Array.from({ length: n }, (_, i) => ({ id: String(i) })),
  totalCount,
})

describe('contador de listas paginadas', () => {
  it('con 2 páginas de 20 y totalCount 137 dice "Mostrando 40 de 137"', () => {
    const pages = [pagina(20, 137), pagina(20, 137)]
    expect(textoContador(itemsCargados(pages).length, totalDelServidor(pages))).toBe('Mostrando 40 de 137')
  })

  it('lee también el sobre { data: { items, totalCount } }', () => {
    const pages = [{ data: { items: [{ id: 'a' }], totalCount: 9 } }]
    expect(itemsCargados(pages)).toHaveLength(1)
    expect(totalDelServidor(pages)).toBe(9)
  })

  it('sin total del servidor no inventa uno: no hay contador', () => {
    expect(totalDelServidor(undefined)).toBeUndefined()
    expect(totalDelServidor([{ items: [] }])).toBeUndefined()
    expect(textoContador(20, undefined)).toBeNull()
  })

  it('un total de 0 se muestra', () => {
    expect(textoContador(0, 0)).toBe('Mostrando 0 de 0')
  })
})
