import { accionesDeVenta, MOTIVO_ANULAR_EN_RUTA, MOTIVO_ANULACION_OTRO, motivoDeAnulacion, MOTIVOS_DE_ANULACION } from '../accionesVenta'

type Permisos = Partial<Record<string, boolean>>
const con = (p: Permisos) => (modulo: string, accion: string) => !!p[`${modulo}:${accion}`]
const TODO = con({ 'MOD_VENTAS:update': true, 'MOD_VENTAS:delete': true, 'MOD_PAGOS:read': true, 'MOD_PAGOS:create': true })
const pedido = (estado: string | number) => ({ estado, tipoOperacion: 2 })
const presupuesto = (estado: string | number) => ({ estado, tipoOperacion: 1 })

describe('acciones de una venta (reglas de la web, PermMatriz "2 · Ventas")', () => {
  it.each(['Pendiente', 'Confirmada'])('se edita en %s con MOD_VENTAS modificar', (e) => {
    expect(accionesDeVenta(pedido(e), TODO).editar).toBe(true)
    expect(accionesDeVenta(pedido(e), con({})).editar).toBe(false)
  })

  it.each(['PendienteAutorizacion', 'EnPreparacion', 'Empacada', 'EnRuta', 'Entregada', 'Anulada', 'RechazadaAutorizacion', 'Vencido'])(
    'no se edita en %s aunque tenga el permiso',
    (e) => expect(accionesDeVenta(pedido(e), TODO).editar).toBe(false),
  )

  it('acepta el estado como número (el servidor manda uno u otro)', () => {
    expect(accionesDeVenta(pedido(2), TODO).editar).toBe(true)
    expect(accionesDeVenta(pedido(11), TODO).anular.visible).toBe(false)
  })

  it.each(['Pendiente', 'Confirmada', 'PendienteAutorizacion', 'EnPreparacion', 'Empacada', 'Entregada'])(
    'se anula en %s con MOD_VENTAS borrar',
    (e) => {
      expect(accionesDeVenta(pedido(e), TODO).anular).toEqual({ visible: true, habilitado: true })
      expect(accionesDeVenta(pedido(e), con({ 'MOD_VENTAS:update': true })).anular.visible).toBe(false)
    },
  )

  it.each(['Anulada', 'RechazadaAutorizacion'])('en %s no hay anular, ni deshabilitado', (e) => {
    expect(accionesDeVenta(pedido(e), TODO).anular.visible).toBe(false)
  })

  it('En ruta: anular queda deshabilitado con el motivo, solo a quien podría anular', () => {
    expect(accionesDeVenta(pedido('EnRuta'), TODO).anular).toEqual({ visible: true, habilitado: false, motivo: MOTIVO_ANULAR_EN_RUTA })
    expect(MOTIVO_ANULAR_EN_RUTA).toBe('No se puede anular: el pedido está en ruta.')
    expect(accionesDeVenta(pedido('EnRuta'), con({ 'MOD_VENTAS:update': true })).anular.visible).toBe(false)
  })

  it('pasar a pedido: solo un presupuesto Pendiente con MOD_VENTAS modificar', () => {
    expect(accionesDeVenta(presupuesto('Pendiente'), TODO).pasarAPedido).toBe(true)
    expect(accionesDeVenta(presupuesto('Pendiente'), con({})).pasarAPedido).toBe(false)
    expect(accionesDeVenta(pedido('Pendiente'), TODO).pasarAPedido).toBe(false)
    expect(accionesDeVenta(presupuesto('Vencido'), TODO).pasarAPedido).toBe(false)
  })

  it('reabrir: solo un presupuesto Vencido con MOD_VENTAS modificar', () => {
    expect(accionesDeVenta(presupuesto('Vencido'), TODO).reabrir).toBe(true)
    expect(accionesDeVenta(presupuesto('Pendiente'), TODO).reabrir).toBe(false)
    expect(accionesDeVenta(presupuesto('Vencido'), con({})).reabrir).toBe(false)
  })

  it('cobrar: no en un presupuesto ni en una anulada, y pide MOD_PAGOS leer y crear', () => {
    expect(accionesDeVenta(pedido('Confirmada'), TODO).cobrar).toBe(true)
    expect(accionesDeVenta(presupuesto('Pendiente'), TODO).cobrar).toBe(false)
    expect(accionesDeVenta(pedido('Anulada'), TODO).cobrar).toBe(false)
    expect(accionesDeVenta(pedido('Confirmada'), con({ 'MOD_PAGOS:create': true })).cobrar).toBe(false)
    expect(accionesDeVenta(pedido('Confirmada'), con({ 'MOD_PAGOS:read': true })).cobrar).toBe(false)
  })

  it('un pedido que ya se prepara dice por qué no se edita', () => {
    expect(accionesDeVenta(pedido('EnPreparacion'), TODO).motivoNoEditable).toBe('Ya lo están preparando: no se puede editar. Para cambiarlo, hablá con el depósito.')
    expect(accionesDeVenta(pedido('Confirmada'), TODO).motivoNoEditable).toBeUndefined()
  })
})

describe('motivo de la anulación (obligatorio)', () => {
  it('los motivos del lienzo y "Otro"', () => {
    expect(MOTIVOS_DE_ANULACION).toEqual(['El cliente se arrepintió', 'Error de carga', 'Duplicado'])
    expect(MOTIVO_ANULACION_OTRO).toBe('Otro')
  })
  it('un motivo elegido vale tal cual', () => {
    expect(motivoDeAnulacion('Duplicado', '')).toBe('Duplicado')
  })
  it('"Otro" exige texto', () => {
    expect(motivoDeAnulacion('Otro', '   ')).toBeNull()
    expect(motivoDeAnulacion('Otro', ' Se cayó el trato ')).toBe('Se cayó el trato')
  })
  it('sin elegir no hay motivo', () => {
    expect(motivoDeAnulacion(null, 'algo')).toBeNull()
  })
})
