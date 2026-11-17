import { LISTA_LARGA_PROPS } from '../listaLargaProps'

describe('LISTA_LARGA_PROPS', () => {
  it('keeps a bounded render window for long lists', () => {
    expect(LISTA_LARGA_PROPS.initialNumToRender).toBeLessThanOrEqual(12)
    expect(LISTA_LARGA_PROPS.windowSize).toBeLessThan(10)
    expect(LISTA_LARGA_PROPS.removeClippedSubviews).toBe(true)
  })
})
