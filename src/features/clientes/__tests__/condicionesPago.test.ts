import {
  agregarFila, cambiarFila, filasCambiaron, filasDesdeDto, filasHaciaDto, marcarPredeterminada, quitarFila, resolverCondicionPagoVenta,
  opcionesCondicionPagoVenta, validarFilas,
} from '../lib/condicionesPago'

const LISTA = [
  { tipo: 'DiasDesdeEntrega' as const, dias: 15, predeterminada: false },
  { tipo: 'Contado' as const, predeterminada: true },
]

describe('lista de condiciones del cliente: exactamente una predeterminada', () => {
  it('marcar una desmarca las demás', () => {
    const filas = marcarPredeterminada(filasDesdeDto(LISTA), 0)
    expect(filas.map((f) => f.predeterminada)).toEqual([true, false])
  })
  it('quitar la predeterminada pasa la marca a la primera que queda', () => {
    const filas = quitarFila(filasDesdeDto(LISTA), 1)
    expect(filas).toHaveLength(1)
    expect(filas[0]!.predeterminada).toBe(true)
  })
  it('la primera fila agregada es la predeterminada y las siguientes no', () => {
    const una = agregarFila([])
    expect(una[0]!.predeterminada).toBe(true)
    expect(agregarFila(una)[1]!.predeterminada).toBe(false)
  })
  it('si la API no trajo ninguna marcada, la pantalla marca la primera', () => {
    expect(filasDesdeDto([{ tipo: 'Contado' }, { tipo: 'DiaFijoDelMes', diaDelMes: 10 }]).filter((f) => f.predeterminada)).toHaveLength(1)
  })
  it('viaja solo el plazo que corresponde al tipo y la marca', () => {
    expect(filasHaciaDto([
      { tipo: 'DiasDesdeFactura', plazo: '30', predeterminada: false },
      { tipo: 'DiaFijoDelMes', plazo: '10', predeterminada: false },
      { tipo: 'Contado', plazo: '99', predeterminada: true },
    ])).toEqual([
      { tipo: 'DiasDesdeFactura', dias: 30, predeterminada: false },
      { tipo: 'DiaFijoDelMes', diaDelMes: 10, predeterminada: false },
      { tipo: 'Contado', predeterminada: true },
    ])
  })
  it('detecta si la lista cambió', () => {
    const inicial = filasDesdeDto(LISTA)
    expect(filasCambiaron(inicial, filasDesdeDto(LISTA))).toBe(false)
    expect(filasCambiaron(inicial, cambiarFila(inicial, 0, { plazo: '20' }))).toBe(true)
  })
})

describe('validación de filas (mismos rangos que la web)', () => {
  it('pide tipo, días entre 1 y 365 y día del mes entre 1 y 31', () => {
    const e = validarFilas([
      { tipo: '', plazo: '', predeterminada: true },
      { tipo: 'DiasDesdeEntrega', plazo: '366', predeterminada: false },
      { tipo: 'DiaFijoDelMes', plazo: '32', predeterminada: false },
      { tipo: 'DiasDesdeFactura', plazo: '365', predeterminada: false },
    ])
    expect(e[0]!.tipo).toBe('Elegí la condición de pago')
    expect(e[1]!.plazo).toBe('Ingresá los días de plazo (entre 1 y 365)')
    expect(e[2]!.plazo).toBe('Ingresá el día del mes (entre 1 y 31)')
    expect(e[3]).toEqual({})
  })
  it('el adaptador deja el error en tipo o plazo, sin las claves de la regla compartida', () => {
    expect(validarFilas([
      { tipo: 'DiasDesdeEntrega', plazo: '0', predeterminada: true },
      { tipo: 'DiaFijoDelMes', plazo: '', predeterminada: false },
      { tipo: '', plazo: '', predeterminada: false },
      { tipo: 'Contado', plazo: '', predeterminada: false },
    ])).toEqual([
      { plazo: 'Ingresá los días de plazo (entre 1 y 365)' },
      { plazo: 'Ingresá el día del mes (entre 1 y 31)' },
      { tipo: 'Elegí la condición de pago' },
      {},
    ])
  })
  it('marca la repetida', () => {
    const e = validarFilas([
      { tipo: 'DiasDesdeEntrega', plazo: '15', predeterminada: true },
      { tipo: 'DiasDesdeEntrega', plazo: '15', predeterminada: false },
    ])
    expect(e[1]!.tipo).toBe('Hay una condición de pago repetida')
  })
})

describe('condición de pago de la venta', () => {
  it('preselecciona la predeterminada del cliente', () => {
    expect(resolverCondicionPagoVenta({ lista: LISTA }).vigente).toEqual({ tipo: 'Contado' })
    const otra = [{ tipo: 'DiasDesdeEntrega' as const, dias: 15, predeterminada: true }, { tipo: 'Contado' as const }]
    expect(resolverCondicionPagoVenta({ lista: otra }).paraEnviar).toEqual({ tipo: 'DiasDesdeEntrega', dias: 15 })
  })
  it('Contado siempre se ofrece, aunque el cliente no lo tenga habilitado', () => {
    const opciones = opcionesCondicionPagoVenta([{ tipo: 'DiasDesdeEntrega', dias: 15, predeterminada: true }])
    expect(opciones.map((o) => o.condicion.tipo)).toEqual(['DiasDesdeEntrega', 'Contado'])
  })
  it('sin la ficha cargada no se sabe cuál mandar', () => {
    expect(resolverCondicionPagoVenta({ lista: undefined }).paraEnviar).toBeUndefined()
  })
  it('en edición solo viaja si el usuario la cambió', () => {
    const guardada = { tipo: 'DiasDesdeEntrega' as const, dias: 15 }
    expect(resolverCondicionPagoVenta({ lista: LISTA, guardada }).paraEnviar).toBeUndefined()
    expect(resolverCondicionPagoVenta({ lista: LISTA, guardada, elegida: { tipo: 'Contado' } }).paraEnviar).toEqual({ tipo: 'Contado' })
  })
})
