// Fija, por la interfaz pública de los esquemas (safeParse), el texto de cada error que ve la persona
// y el comportamiento de opcional/nullable/claves de más (X8: defiende la regla, no la librería).
import '@/libs/validations/mensajes-zod3'
import { numeroDelContrato, textoDelContrato } from '@/libs/validations/generated/desde-contrato'
import {
  AbrirCajaCommandSchema,
  ActualizarAvisosTalonarioCommandSchema,
  AnalizarImportacionCommandSchema,
  CorregirCesionComisionCommandSchema,
  CreateVentaCommandSchema,
} from '@/libs/validations/generated/generated/esquemas'
import {
  CantidadDeCompraSchema,
  ComprobanteCompraInputConReglasSchema,
  CompraDetalleConReglasSchema,
  CreateSocioConReglasSchema,
  EmailDeSocioSchema,
  MonedaPermitidaSchema,
  PorcentajeComisionCedidoSchema,
} from '@/libs/validations/generated/reglas'

type Esquema = { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } } }
const mensajes = (e: Esquema, v: unknown) => {
  const r = e.safeParse(v)
  return r.success ? null : r.error!.issues.map((i) => `${i.path.join('.')}|${i.message}`)
}

describe('texto de los errores del contrato', () => {
  it('texto vacío o largo', () => {
    expect(mensajes(AbrirCajaCommandSchema, { moneda: '' })).toEqual(['moneda|String must contain at least 1 character(s)'])
    expect(mensajes(AbrirCajaCommandSchema, { moneda: 'ARSX' })).toEqual(['moneda|String must contain at most 3 character(s)'])
  })
  it('número bajo el mínimo, sobre el máximo, no entero', () => {
    expect(mensajes(AbrirCajaCommandSchema, { saldoInicialDeclarado: -1 })).toEqual(['saldoInicialDeclarado|Number must be greater than or equal to 0'])
    expect(mensajes(CreateVentaCommandSchema, { descuentoGeneral: 101 })).toEqual(['descuentoGeneral|Number must be less than or equal to 100'])
    expect(mensajes(ActualizarAvisosTalonarioCommandSchema, { diasAvisoCai: 1.5 })).toEqual(['diasAvisoCai|Expected integer, received float'])
  })
  it('límites exclusivos', () => {
    expect(mensajes(CorregirCesionComisionCommandSchema, { nuevoPorcentaje: 0 })).toEqual(['nuevoPorcentaje|Number must be greater than 0'])
    expect(mensajes(CorregirCesionComisionCommandSchema, { nuevoPorcentaje: 100 })).toEqual(['nuevoPorcentaje|Number must be less than 100'])
  })
  it('lista vacía', () => {
    expect(mensajes(CreateVentaCommandSchema, { items: [] })).toEqual(['items|Array must contain at least 1 element(s)'])
  })
  it('tipo equivocado, null en lo que no es nullable y enum inválido', () => {
    expect(mensajes(AbrirCajaCommandSchema, { saldoInicialDeclarado: 'x' })).toEqual(['saldoInicialDeclarado|Expected number, received string'])
    expect(mensajes(AbrirCajaCommandSchema, { depositoId: null })).toEqual(['depositoId|Expected string, received null'])
    expect(mensajes(CreateVentaCommandSchema, { metodoEntrega: 'Otro' })).toEqual([
      "metodoEntrega|Invalid enum value. Expected 'LogisticaPropia' | 'RetiroEnLocal' | 'Expreso', received 'Otro'",
    ])
  })
  it('record con valor de otro tipo', () => {
    expect(mensajes(AnalizarImportacionCommandSchema, { mapeo: { a: 1 } })).toEqual(['mapeo.a|Expected string, received number'])
    expect(mensajes(AnalizarImportacionCommandSchema, { mapeo: { a: 'b' } })).toBeNull()
  })
  it('varios errores salen en el orden de los campos', () => {
    expect(mensajes(AbrirCajaCommandSchema, { moneda: '', saldoInicialDeclarado: -1 })?.map((m) => m.split('|')[0])).toEqual(['moneda', 'saldoInicialDeclarado'])
  })
})

describe('opcional, nullable y claves de más', () => {
  it('todo es opcional y el nullable acepta null', () => {
    expect(mensajes(AbrirCajaCommandSchema, {})).toBeNull()
    expect(mensajes(AbrirCajaCommandSchema, { moneda: null })).toBeNull()
    expect(mensajes(AbrirCajaCommandSchema, { moneda: undefined, saldoInicialDeclarado: undefined })).toBeNull()
  })
  it('las claves de más se descartan sin error', () => {
    const r = AbrirCajaCommandSchema.safeParse({ moneda: 'ARS', otra: 1 })
    expect(r.success && r.data).toEqual({ moneda: 'ARS' })
  })
  it('un objeto que no es objeto falla con el mismo texto', () => {
    expect(mensajes(AbrirCajaCommandSchema, 'x')).toEqual(['|Expected object, received string'])
    expect(mensajes(AbrirCajaCommandSchema, null)).toEqual(['|Expected object, received null'])
  })
})

describe('reglas escritas a mano', () => {
  it('moneda', () => {
    expect(mensajes(MonedaPermitidaSchema, 'EUR')).toEqual(['|La moneda tiene que ser ARS o USD.'])
    expect(mensajes(MonedaPermitidaSchema, undefined)).toEqual(['|La moneda tiene que ser ARS o USD.'])
    expect(mensajes(MonedaPermitidaSchema, 'ARS')).toBeNull()
  })
  it('email del socio: formato o vacío', () => {
    expect(mensajes(CreateSocioConReglasSchema, { email: 'sin-arroba' })).toEqual(['email|Email inválido'])
    expect(mensajes(CreateSocioConReglasSchema, { email: '' })).toBeNull()
    expect(mensajes(EmailDeSocioSchema, 'sin-arroba')).not.toBeNull()
    expect(mensajes(EmailDeSocioSchema, '')).toBeNull()
    expect(mensajes(EmailDeSocioSchema, 'a@b.com')).toBeNull()
    expect(mensajes(EmailDeSocioSchema, 'a@b')).not.toBeNull()
    expect(mensajes(EmailDeSocioSchema, 'a b@c.com')).not.toBeNull()
  })
  it('porcentaje cedido y cantidad de compra', () => {
    const m = 'El porcentaje de comisión cedido debe estar entre 0 y 100 sin incluir los extremos'
    expect(mensajes(PorcentajeComisionCedidoSchema, 0)).toEqual([`|${m}`])
    expect(mensajes(PorcentajeComisionCedidoSchema, 100)).toEqual([`|${m}`])
    expect(mensajes(PorcentajeComisionCedidoSchema, 50)).toBeNull()
    expect(mensajes(CantidadDeCompraSchema, 0)).toEqual(['|La cantidad debe ser mayor a 0'])
  })
  it('detalle de compra: cantidad entera en bulto y moneda ARS', () => {
    expect(mensajes(CompraDetalleConReglasSchema, { unidadCompra: 'Bulto', cantidad: 1.5, costoUnitario: 1, monedaCosto: 'ARS' })).toEqual([
      'cantidad|En bulto la cantidad tiene que ser un número entero',
    ])
    expect(mensajes(CompraDetalleConReglasSchema, { cantidad: 1, costoUnitario: 0, monedaCosto: 'USD' })).toEqual([
      'costoUnitario|El costo unitario debe ser mayor a 0',
      'monedaCosto|La compra se carga en pesos (ARS).',
    ])
  })
  it('cuit del emisor del comprobante', () => {
    expect(mensajes(ComprobanteCompraInputConReglasSchema, { cuitEmisor: '20-12345678-0' })).toEqual(['cuitEmisor|El CUIT del emisor no es válido'])
    expect(mensajes(ComprobanteCompraInputConReglasSchema, {})).toEqual(['cuitEmisor|El CUIT del emisor no es válido'])
  })
})

describe('formato de email (mismo veredicto que zod 3)', () => {
  const validos = ['a@b.com', 'a+b@x.co', "o'neil@x.com", 'a_b-c@x-y.com.ar', 'A@B.COM', 'a.b.c@d.ee', 'a@x.technology']
  const invalidos = ['a@b', 'a@b.c', 'a b@c.com', '.a@c.com', 'a.@c.com', 'a..b@c.com', "a'@x.com", 'ñ@x.com', 'a@-b.com', 'a@b..com', '@x.com', 'a@.com', 'a@b.com ', ' a@b.com']
  it.each(validos)('acepta %s', (e) => expect(mensajes(EmailDeSocioSchema, e)).toBeNull())
  it.each(invalidos)('rechaza %j', (e) => expect(mensajes(EmailDeSocioSchema, e)).not.toBeNull())
})

describe('campo del contrato con mensaje propio (desde-contrato)', () => {
  it('número: los límites son los del contrato y el texto es el nuevo', () => {
    const campo = numeroDelContrato(AbrirCajaCommandSchema, 'saldoInicialDeclarado', 'Poné un saldo válido')
    expect(mensajes(campo, -1)).toEqual(['|Poné un saldo válido'])
    expect(mensajes(campo, 'x')).toEqual(['|Poné un saldo válido'])
    expect(mensajes(campo, 0)).toBeNull()
  })
  it('número sin mensaje propio conserva el del contrato y es obligatorio', () => {
    const campo = numeroDelContrato(AbrirCajaCommandSchema, 'saldoInicialDeclarado')
    expect(mensajes(campo, -1)).toEqual(['|Number must be greater than or equal to 0'])
    expect(mensajes(campo, undefined)).toEqual(['|Required'])
  })
  it('texto: máximo del contrato y mensaje propio', () => {
    const campo = textoDelContrato(AbrirCajaCommandSchema, 'moneda', 'Moneda inválida')
    expect(mensajes(campo, 'ARSX')).toEqual(['|Moneda inválida'])
    expect(mensajes(campo, '')).toEqual(['|Moneda inválida'])
    expect(mensajes(campo, 'ARS')).toBeNull()
    expect(mensajes(campo, null)).toEqual(['|Moneda inválida'])
  })
  it('un campo de otro tipo no se puede pedir', () => {
    expect(() => textoDelContrato(AbrirCajaCommandSchema, 'saldoInicialDeclarado')).toThrow('El campo saldoInicialDeclarado del contrato no es un texto')
    expect(() => numeroDelContrato(AbrirCajaCommandSchema, 'moneda')).toThrow('El campo moneda del contrato no es un número')
  })
})
