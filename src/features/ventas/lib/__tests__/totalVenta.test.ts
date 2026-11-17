/**
 * El total que la app manda como `totalEsperado` es el que arma el servidor, centavo por centavo
 * (decisión del dueño #33, RED-06). Los casos son los de la web
 * (`forward-frontend/apps/web/src/__tests__/ventas/total-venta-exacto.test.ts`, PR #1168): si uno
 * cambia allá, tiene que cambiar acá. Valores con `toBe`: un centavo de diferencia tiene que fallar.
 */
import { sumarMontos } from '@/libs/reglas'
import { calcularSubtotalConDescuento } from '../descuentos'
import { calcularTotalesVenta } from '../totalVenta'

describe('descuento general en centavos enteros', () => {
  it('113,50 con 7 % da 105,56 (la cuenta en binario daba 105,55)', () => {
    const { total, montoDescuento } = calcularTotalesVenta({ subtotalBruto: 113.5, descuentoGeneralPct: 7, cargoFlete: 0 })
    expect(total).toBe(105.56)
    expect(montoDescuento).toBe(7.95)
  })

  it('un porcentaje con decimales también es exacto (0,25 % de 4.000,40)', () => {
    const { total, montoDescuento } = calcularTotalesVenta({ subtotalBruto: 4000.4, descuentoGeneralPct: 0.25, cargoFlete: 0 })
    expect(montoDescuento).toBe(10) // 10,001
    expect(total).toBe(3990.4) // 3990,399
  })
})

describe('empate de medio centavo en el descuento general', () => {
  it('104,50 con 13 % da 90,92: el medio centavo sube, como en el servidor', () => {
    const { total, montoDescuento } = calcularTotalesVenta({ subtotalBruto: 104.5, descuentoGeneralPct: 13, cargoFlete: 0 })
    expect(total).toBe(90.92) // 90,915 exacto
    expect(montoDescuento).toBe(13.59) // 13,585 exacto
  })

  it('el total se redondea una sola vez, con el descuento sin redondear', () => {
    // 10,50 − 1 % = 10,395; con flete 0,10 son 10,495 → 10,50. Redondear antes el descuento (0,105 → 0,11) daría 10,49.
    const { total } = calcularTotalesVenta({ subtotalBruto: 10.5, descuentoGeneralPct: 1, cargoFlete: 0.1 })
    expect(total).toBe(10.5)
  })
})

describe('los casos de la auditoría (RED-06): celular y servidor dan lo mismo', () => {
  it('A) 1 × 10,10 con 5 % de línea: 9,60 y no 9,59', () => {
    expect(calcularSubtotalConDescuento(10.1, 1, 5)).toBe(9.6)
  })

  it('B) 1 × 100,10 con 5 % general: 95,10 y no 95,09', () => {
    const { total } = calcularTotalesVenta({ subtotalBruto: 100.1, descuentoGeneralPct: 5, cargoFlete: 0 })
    expect(total).toBe(95.1)
  })

  it('C) 12 × 10,10 al 5 % + 1 × 100,10, 5 % general, flete 1500: 1704,54 y no 1704,42', () => {
    const subtotal = sumarMontos([calcularSubtotalConDescuento(10.1, 12, 5), calcularSubtotalConDescuento(100.1, 1, 0)])
    const { total } = calcularTotalesVenta({ subtotalBruto: subtotal, descuentoGeneralPct: 5, cargoFlete: 1500 })
    expect(total).toBe(1704.54)
  })

  it('control: 3 × 1000 al 10 % da 2700', () => {
    expect(calcularSubtotalConDescuento(1000, 3, 10)).toBe(2700)
  })
})

describe('precio de lista y renglones', () => {
  it('lista 10,10 con 5 % de línea: el unitario 9,595 sube a 9,60', () => {
    expect(calcularSubtotalConDescuento(10.1, 1, 5)).toBe(9.6)
    expect(calcularSubtotalConDescuento(10.1, 3, 5)).toBe(28.8)
  })

  it('un precio de lista con más de 2 decimales se redondea como el servidor', () => {
    expect(calcularSubtotalConDescuento(6.675, 1, 0)).toBe(6.68)
    expect(calcularSubtotalConDescuento(6.675, 1, 10)).toBe(6.01) // 6,0075 exacto
  })

  it('la suma de los renglones no arrastra ruido binario', () => {
    expect(sumarMontos([0.1, 0.2])).toBe(0.3)
    expect(sumarMontos([28.8, 80.8])).toBe(109.6)
  })
})

describe('flete', () => {
  it('suma el flete antes de redondear: 100 con flete 12,345 da 112,35', () => {
    const { total } = calcularTotalesVenta({ subtotalBruto: 100, descuentoGeneralPct: 0, cargoFlete: 12.345 })
    expect(total).toBe(112.35)
  })

  it('venta completa con descuentos, general y flete: 110,85', () => {
    const subtotal = sumarMontos([calcularSubtotalConDescuento(10.1, 3, 5), calcularSubtotalConDescuento(40.4, 2, 0)])
    const { total } = calcularTotalesVenta({ subtotalBruto: subtotal, descuentoGeneralPct: 13, cargoFlete: 15.5 })
    expect(subtotal).toBe(109.6)
    expect(total).toBe(110.85) // 109,60 − 14,248 + 15,50 = 110,852
  })

  it('un dato que no es número da NaN en vez de un total inventado', () => {
    const { total } = calcularTotalesVenta({ subtotalBruto: 100, descuentoGeneralPct: Number.NaN, cargoFlete: 0 })
    expect(Number.isNaN(total)).toBe(true)
  })
})

describe('barrido contra la cuenta entera del servidor', () => {
  /** `Math.Round(x, 2, AwayFromZero)` sobre `numerador / 10^escala`, todo en BigInt. */
  const aCentavos = (numerador: bigint, escala: number): number => {
    const divisor = 10n ** BigInt(escala - 2)
    let c = numerador / divisor
    if ((numerador % divisor) * 2n >= divisor) c += 1n
    return Number(c) / 100
  }

  it('renglón y total dan lo mismo que la cuenta en enteros (empates incluidos)', () => {
    for (let centavos = 1000; centavos <= 12000; centavos += 37) {
      for (const pct of [1, 5, 7, 13, 15]) {
        const esperado = aCentavos(BigInt(centavos) * BigInt(100 - pct), 4)
        expect(calcularSubtotalConDescuento(centavos / 100, 1, pct)).toBe(esperado)
        const { total } = calcularTotalesVenta({ subtotalBruto: centavos / 100, descuentoGeneralPct: pct, cargoFlete: 0 })
        expect(total).toBe(esperado)
      }
    }
  })
})
