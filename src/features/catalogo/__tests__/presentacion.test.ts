import {
  detalleDeTarjeta,
  diaDeUltimaCompra,
  formatVariacion,
  redondearVariacion,
  textoUltimaCompra,
} from '../lib/presentacion'

describe('detalleDeTarjeta', () => {
  it('una línea con la cantidad dice "N fragancias" y, si se vende por caja, "caja de N"', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: 12, ventaMinimaUnidades: 12 })).toBe('12 fragancias · caja de 12')
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: 8, ventaMinimaUnidades: 1 })).toBe('8 fragancias')
  })

  it('una sola fragancia va en singular', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: 1 })).toBe('1 fragancia')
  })

  it('una línea de un servidor anterior (sin cantidad) sigue diciendo "Con fragancias"', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: true })).toBe('Con fragancias')
    expect(detalleDeTarjeta({ esPadreDeVariantes: true, cantidadFragancias: null, ventaMinimaUnidades: null })).toBe('Con fragancias')
  })

  it('un producto común solo dice "caja de N" cuando la venta mínima es más de una unidad', () => {
    expect(detalleDeTarjeta({ esPadreDeVariantes: false, ventaMinimaUnidades: 6 })).toBe('caja de 6')
    expect(detalleDeTarjeta({ esPadreDeVariantes: false, ventaMinimaUnidades: 1 })).toBeNull()
    expect(detalleDeTarjeta({ esPadreDeVariantes: false })).toBeNull()
  })
})

describe('redondearVariacion', () => {
  it('redondea a un decimal de forma simétrica y nunca devuelve -0', () => {
    expect(redondearVariacion(0.05)).toBe(0.1)
    expect(redondearVariacion(-0.05)).toBe(-0.1)
    expect(redondearVariacion(0.04)).toBe(0)
    expect(Object.is(redondearVariacion(-0.04), 0)).toBe(true)
    expect(Object.is(redondearVariacion(-0), 0)).toBe(true)
    expect(redondearVariacion(-3.04)).toBe(-3)
    expect(redondearVariacion(5.25)).toBe(5.3)
    expect(redondearVariacion(-5.25)).toBe(-5.3)
  })
})

describe('formatVariacion', () => {
  it('lleva signo y un decimal con coma; si redondea a cero, sin signo', () => {
    expect(formatVariacion(5.2)).toBe('+5,2 %')
    expect(formatVariacion(-3.04)).toBe('-3,0 %')
    expect(formatVariacion(0)).toBe('0,0 %')
    expect(formatVariacion(0.04)).toBe('0,0 %')
    expect(formatVariacion(-0.04)).toBe('0,0 %')
  })

  it('±0,05 redondean para el mismo lado, con su signo', () => {
    expect(formatVariacion(0.05)).toBe('+0,1 %')
    expect(formatVariacion(-0.05)).toBe('-0,1 %')
  })
})

describe('última compra', () => {
  it('el día es el argentino (UTC-3) del instante', () => {
    expect(diaDeUltimaCompra('2026-10-11T01:30:00Z')).toBe('10/10/2026')
    expect(diaDeUltimaCompra('2026-10-11T03:00:00Z')).toBe('11/10/2026')
    expect(diaDeUltimaCompra('2026-01-01T02:59:59Z')).toBe('31/12/2025')
  })

  it('una fecha ilegible no inventa un día', () => {
    expect(diaDeUltimaCompra('no es una fecha')).toBeNull()
    expect(textoUltimaCompra({ fecha: 'no es una fecha', proveedorNombre: 'Norte', costoUnitario: 10 })).toBe('Última compra: Norte · $ 10,00')
  })

  it('arma "Última compra: día · proveedor · costo" y omite el proveedor que falta', () => {
    const u = { fecha: '2026-10-11T01:30:00Z', proveedorNombre: 'Norte S.A.', costoUnitario: 1846.71 }
    expect(textoUltimaCompra(u)).toBe('Última compra: 10/10/2026 · Norte S.A. · $ 1.846,71')
    expect(textoUltimaCompra({ ...u, proveedorNombre: '  ' })).toBe('Última compra: 10/10/2026 · $ 1.846,71')
  })
})
