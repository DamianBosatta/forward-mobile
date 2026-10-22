import {
  CASOS,
  MONEDAS_PERMITIDAS,
  cuitEsValido,
  ejecutarCasos,
  esCantidadEnteraSiEsBulto,
  pisoCesionComision,
  redondearDosDecimales,
  tieneComoMuchoDosDecimales,
} from '../reglas'

// Mismo mapa que el test de la web (forward-frontend/packages/reglas/src/reglas.test.ts): los casos
// son datos compartidos y corren en las dos plataformas.
const REGLAS = {
  cuitEsValido,
  tieneComoMuchoDosDecimales,
  redondearDosDecimales,
  pisoCesionComision,
  esCantidadEnteraSiEsBulto,
  monedasPermitidas: (m: string) => (MONEDAS_PERMITIDAS as readonly string[]).includes(m),
}

describe('casos compartidos con la web (libs/reglas)', () => {
  it('toda regla con casos tiene su función registrada', () => {
    expect(Object.keys(CASOS).sort()).toEqual(Object.keys(REGLAS).sort())
  })

  it('todos los casos dan el veredicto esperado', () => {
    expect(ejecutarCasos(CASOS, REGLAS)).toEqual([])
  })

  it('el ejecutor detecta un caso roto (test del test)', () => {
    const fallas = ejecutarCasos(
      { cuitEsValido: [{ nombre: 'roto', entrada: ['20123456786'], esperado: false }] },
      REGLAS,
    )
    expect(fallas).toHaveLength(1)
  })
})
