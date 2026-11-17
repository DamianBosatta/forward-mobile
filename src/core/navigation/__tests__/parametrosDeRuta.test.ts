/** ARQ-04: lo que trae un enlace se valida antes de llegar a la pantalla o a la URL del API. */
import { idDeRuta, leerParametros, opcionDeRuta, textoDeRuta } from '../parametrosDeRuta'

const esquema = { id: idDeRuta, busqueda: textoDeRuta(10), medio: opcionDeRuta(['cheque'] as const) }

describe('leerParametros', () => {
  it('deja pasar un id, un texto corto y una opción esperada', () => {
    expect(leerParametros({ id: '3f2a9c1e-77b0-4c1e-9d2a-0b6f1a2c3d4e', busqueda: 'pala', medio: 'cheque' }, esquema))
      .toEqual({ id: '3f2a9c1e-77b0-4c1e-9d2a-0b6f1a2c3d4e', busqueda: 'pala', medio: 'cheque' })
  })

  it('un id con barras, puntos, query o espacios no llega a la URL del API', () => {
    for (const id of ['../usuarios', 'v9/anular', 'v9?x=1', 'v 9', '', 'a'.repeat(65)]) {
      expect(leerParametros({ id }, esquema).id).toBeUndefined()
    }
  })

  it('un texto largo, una opción desconocida o un valor repetido quedan afuera', () => {
    expect(leerParametros({ busqueda: 'x'.repeat(11), medio: 'efectivo', id: ['v1', 'v2'] }, esquema)).toEqual({})
  })

  it('lo que el esquema no pide no pasa', () => {
    expect(leerParametros({ id: 'v1', otro: 'x' }, { id: idDeRuta })).toEqual({ id: 'v1' })
  })
})
