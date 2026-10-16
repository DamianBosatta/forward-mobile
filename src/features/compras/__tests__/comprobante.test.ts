import { armarComprobante, formDesdeComprobante, formNuevo, resumenComprobante, seCorrigeEnLaWeb } from '../lib/comprobante'

const PROVEEDOR = { cuit: '30-71234567-8', razonSocial: 'Insumos del Sur SA' }

describe('comprobante del proveedor', () => {
  it('una factura B va sin alícuotas, con el CUIT sin guiones, la fecha ISO y los números enteros', () => {
    const f = { ...formNuevo(PROVEEDOR, '08/10/2026'), letra: 'B' as const, puntoVenta: '3', numero: '1234', total: '12.100,50' }
    expect(armarComprobante(f)).toEqual({
      comprobante: {
        tipo: 'Factura', letra: 'B', puntoVenta: 3, numero: 1234, fecha: '2026-10-08',
        cuitEmisor: '30712345678', razonSocialEmisor: 'Insumos del Sur SA',
        noGravado: 0, exento: 0, total: 12100.5, alicuotas: [], tributos: [],
      },
    })
  })

  it('una factura A lleva el neto y el IVA de su alícuota; sin IVA escrito, lo calcula del neto', () => {
    const f = { ...formNuevo(PROVEEDOR, '08/10/2026'), letra: 'A' as const, puntoVenta: '1', numero: '77', total: '1210', neto: '1000' }
    const r = armarComprobante(f)
    expect('comprobante' in r && r.comprobante.alicuotas).toEqual([{ alicuota: 'Veintiuno', netoGravado: 1000, iva: 210 }])
    const conIva = armarComprobante({ ...f, alicuota: 'DiezComaCinco', iva: '105,01' })
    expect('comprobante' in conIva && conIva.comprobante.alicuotas).toEqual([{ alicuota: 'DiezComaCinco', netoGravado: 1000, iva: 105.01 }])
  })

  it('dice qué falta antes de mandar nada', () => {
    const base = { ...formNuevo(PROVEEDOR, '08/10/2026'), letra: 'B' as const, puntoVenta: '1', numero: '1', total: '100' }
    expect(armarComprobante({ ...base, cuit: '20-123' })).toEqual({ error: 'El CUIT del proveedor tiene 11 números.' })
    expect(armarComprobante({ ...base, numero: '' })).toEqual({ error: 'Falta el número del comprobante.' })
    expect(armarComprobante({ ...base, puntoVenta: '0' })).toEqual({ error: 'Falta el punto de venta.' })
    expect(armarComprobante({ ...base, fecha: '31/02/2026' })).toEqual({ error: 'Escribí la fecha como dd/mm/aaaa.' })
    expect(armarComprobante({ ...base, total: '' })).toEqual({ error: 'Falta el total del comprobante.' })
    expect(armarComprobante({ ...base, letra: 'A' })).toEqual({ error: 'En una factura A falta el neto gravado.' })
  })

  it('corregir uno cargado conserva lo que el teléfono no edita (percepciones, no gravado, exento, tipo)', () => {
    const cargado = {
      id: 'k1', tipo: 'Factura', letra: 'A', puntoVenta: 2, numero: 55, fecha: '2026-10-01', periodoFiscal: 202610,
      cuitEmisor: '30712345678', razonSocialEmisor: 'Insumos del Sur SA', noGravado: 10, exento: 5, total: 1255,
      alicuotas: [{ alicuota: 'Veintiuno', netoGravado: 1000, iva: 210 }],
      tributos: [{ tipo: 'PercepcionIibb', jurisdiccion: 'Buenos Aires', importe: 30 }],
    } as never
    const f = formDesdeComprobante(cargado)
    expect(f).toMatchObject({ letra: 'A', puntoVenta: '2', numero: '55', fecha: '01/10/2026', total: '1255', neto: '1000', iva: '210' })
    const r = armarComprobante({ ...f, numero: '56' })
    expect('comprobante' in r && r.comprobante).toMatchObject({
      numero: 56, noGravado: 10, exento: 5, tributos: [{ tipo: 'PercepcionIibb', jurisdiccion: 'Buenos Aires', importe: 30 }],
    })
  })

  it('uno con varias alícuotas se corrige en la web (el teléfono edita una sola)', () => {
    const base = { alicuotas: [{ alicuota: 'Veintiuno', netoGravado: 1, iva: 0.21 }] }
    expect(seCorrigeEnLaWeb(base as never)).toBe(false)
    expect(seCorrigeEnLaWeb({ alicuotas: [...base.alicuotas, { alicuota: 'DiezComaCinco', netoGravado: 1, iva: 0.1 }] } as never)).toBe(true)
  })

  it('resume el comprobante cargado como en el papel', () => {
    expect(resumenComprobante({ tipo: 'Factura', letra: 'A', puntoVenta: 2, numero: 55 } as never)).toBe('Factura A 00002-00000055')
  })
})
