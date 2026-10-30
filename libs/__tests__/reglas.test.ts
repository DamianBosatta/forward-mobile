import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  CASOS,
  ESTADO_COMPRA,
  ESTADO_HOJA_RUTA,
  ESTADO_VENTA,
  MONEDAS_PERMITIDAS,
  cuitEsValido,
  ejecutarCasos,
  esCantidadEnteraSiEsBulto,
  formatearMonto,
  pisoCesionComision,
  redondear2,
  redondearDosDecimales,
  resolverEstadoHojaRuta,
  resolverEstadoVenta,
  tieneComoMuchoDosDecimales,
} from '../reglas'

// Mismo mapa que el test de la web (forward-frontend/packages/reglas/src/reglas.test.ts): los casos
// son datos compartidos y corren en las dos plataformas.
const REGLAS = {
  cuitEsValido,
  tieneComoMuchoDosDecimales,
  redondearDosDecimales,
  redondear2,
  formatearMonto,
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

// Paridad con el backend (C-015, L-32): el mismo fixture que corren Dinero.Redondear/Formatear (C#) y
// redondear2/formatearMonto (web). `sync:reglas` lo copia a libs/reglas/fixtures y entra al hash.
interface FixtureDinero {
  casos: { nombre: string; entrada: string; redondear: string; formatear: string }[]
  conMoneda: { nombre: string; entrada: string; moneda: string; formatear: string }[]
}
const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'reglas', 'fixtures', 'redondeo-y-formato.json'), 'utf8'),
) as FixtureDinero

describe('paridad de Dinero con el backend (fixture compartido)', () => {
  it('el fixture trae 1,005 y 2,675', () => {
    const entradas = fixture.casos.map((c) => c.entrada)
    expect(entradas).toEqual(expect.arrayContaining(['1.005', '2.675']))
  })
  for (const c of fixture.casos) {
    it(`redondear2: ${c.nombre}`, () => expect(redondear2(Number(c.entrada))).toBe(Number(c.redondear)))
    it(`formatearMonto: ${c.nombre}`, () => expect(formatearMonto(Number(c.entrada))).toBe(c.formatear))
  }
  for (const c of fixture.conMoneda) {
    it(`formatearMonto con moneda: ${c.nombre}`, () =>
      expect(formatearMonto(Number(c.entrada), c.moneda)).toBe(c.formatear))
  }
})

describe('estados compartidos (L-33)', () => {
  it('la venta se resuelve por nombre, número o número en texto', () => {
    expect(resolverEstadoVenta('Empacada')?.nombre).toBe('Empacada')
    expect(resolverEstadoVenta(4)?.nombre).toBe('Empacada')
    expect(resolverEstadoVenta('4')?.nombre).toBe('Empacada')
  })
  it('un estado que no está en la tabla no se resuelve', () => {
    expect(resolverEstadoVenta('Inventado')).toBeUndefined()
    expect(resolverEstadoVenta(99)).toBeUndefined()
    expect(resolverEstadoVenta(null)).toBeUndefined()
    expect(resolverEstadoHojaRuta('')).toBeUndefined()
  })
  it('hoja de ruta por nombre y por número', () => {
    expect(resolverEstadoHojaRuta('EnCurso')?.nombre).toBe('EnCurso')
    expect(resolverEstadoHojaRuta(5)?.nombre).toBe('Documentada')
  })
  it('las tablas traen los estados que mobile usa', () => {
    expect(Object.keys(ESTADO_VENTA)).toContain('PendienteAutorizacion')
    expect(Object.keys(ESTADO_COMPRA)).toEqual(['NotaPedido', 'Confirmado', 'Entregado', 'Cancelada', 'Anulada'])
    expect(Object.keys(ESTADO_HOJA_RUTA)).toEqual(['Programada', 'EnCurso', 'Finalizada', 'Cancelada', 'Documentada', 'Rendida'])
  })
})
