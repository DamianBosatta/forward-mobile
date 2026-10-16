import { llegaTexto } from '../lib/fecha'

describe('llegaTexto', () => {
  it('muestra el día de la semana corto y el día del mes', () => {
    // 2026-10-08 es jueves.
    expect(llegaTexto('2026-10-08')).toBe('Llega jue 8')
    expect(llegaTexto('2026-10-11')).toBe('Llega dom 11')
  })

  it('sin fecha (servidor viejo, otro estado o proveedor sin franja) no muestra nada', () => {
    expect(llegaTexto(null)).toBeNull()
    expect(llegaTexto(undefined)).toBeNull()
    expect(llegaTexto('no es fecha')).toBeNull()
  })
})
