import { PASOS_COBRO } from '../components/PasosCobro'
import { textosDe } from '../lib/contraparte'

const largo = (nombres: readonly string[]) => nombres.join('').length

describe('pasos del pago a proveedor', () => {
  // La barra de pasos no parte renglón: los cuatro nombres tienen que entrar en 360 de ancho, como los del cobro.
  it('los nombres no son más largos que los del cobro, que entran en 360 de ancho', () => {
    const pasos = textosDe('proveedor').pasos
    expect(pasos).toEqual(['Proveedor', 'Qué pagás', 'Medios', 'Confirmar'])
    expect(largo(pasos)).toBeLessThanOrEqual(largo(PASOS_COBRO))
  })

  it('el cobro sigue con sus nombres', () => {
    expect(textosDe('cliente').pasos).toEqual(PASOS_COBRO)
  })
})
