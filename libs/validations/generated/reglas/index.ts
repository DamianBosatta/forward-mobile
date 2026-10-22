/**
 * Reglas entre campos (`Must`/`When`) que el contrato OpenAPI no puede publicar (L-23).
 *
 * Cada una reusa el esquema generado desde el contrato y suma solo lo que el esquema no dice.
 * La fuente de cada regla es un fixture de `Forward-Api/contrato/reglas/*.json`; el test de
 * paridad (`paridad.test.ts`) mantiene web y backend dando el mismo veredicto.
 */
import { z } from 'zod'

import { cuitEsValido } from '../cuit'
import {
  AbrirCajaCommandSchema,
  AutorizarVentaCommandSchema,
  CerrarCajaCommandSchema,
  CompraDetalleDtoSchema,
  ComprobanteCompraInputSchema,
  CreateProductoCommandSchema,
  CreateSocioCommandSchema,
  CreateVentaCommandSchema,
  RegistrarPagoCommandSchema,
} from '../generated/esquemas'

const tieneComoMuchoDosDecimales = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9

/** autorizar-venta/razon-no-blanca y autorizar-venta/descuento-adicional-dos-decimales */
export const AutorizarVentaConReglasSchema = AutorizarVentaCommandSchema.superRefine((v, ctx) => {
  if (typeof v.razon === 'string' && v.razon.trim() === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['razon'],
      message: 'La razón no puede ser solo espacios',
    })
  }
  const d = v.descuentoAdicionalPorcentaje
  if (typeof d === 'number') {
    if (d <= 0 || d > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['descuentoAdicionalPorcentaje'],
        message: 'El descuento adicional debe ser mayor a 0 y a lo sumo 100',
      })
    } else if (!tieneComoMuchoDosDecimales(d)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['descuentoAdicionalPorcentaje'],
        message: 'El descuento adicional admite hasta 2 decimales',
      })
    }
  }
})

/** compra/detalle-cantidad-entera-por-bulto: en bulto o bulto madre no se compra una fracción. */
export const esCantidadEnteraSiEsBulto = (unidadCompra: unknown, cantidad: number) =>
  !(unidadCompra === 'Bulto' || unidadCompra === 'BultoMadre') || Number.isInteger(cantidad)

/** compra/detalle-cantidad-entera-por-bulto: la cantidad confirmada es mayor a 0. */
export const CantidadDeCompraSchema = z.number().gt(0, 'La cantidad debe ser mayor a 0')

/** compra/detalle-costo-positivo: el contrato publica min 0 (el borrador admite 0); el alta pide mayor a 0. */
export const CostoUnitarioDeCompraSchema = z.number().gt(0, 'El costo unitario debe ser mayor a 0')

/** Monedas que opera el sistema: la misma lista que `Domain/Common/Monedas.cs` (decisión del dueño L43). */
export const MONEDAS_PERMITIDAS = ['ARS', 'USD'] as const

/** caja/abrir-moneda-ars-usd y caja/cerrar-moneda-ars-usd: ARS o USD, en mayúsculas. */
export const MonedaPermitidaSchema = z.enum(MONEDAS_PERMITIDAS, {
  errorMap: () => ({ message: 'La moneda tiene que ser ARS o USD.' }),
})

/** compra/detalle-moneda-ars: la compra se carga en pesos (A-515). */
export const MonedaDeCompraSchema = z
  .string()
  .refine((m): boolean => m === 'ARS', 'La compra se carga en pesos (ARS).')

/** pago/monto-dos-decimales: la base guarda numeric(18,2); lo mismo que `Money.CabeEnLaEscala`. */
export const conEscalaDeDinero = (esquema: z.ZodNumber, campo = 'El monto') =>
  esquema.refine(tieneComoMuchoDosDecimales, { message: `${campo} admite hasta 2 decimales` })

const exigirMoneda = (valor: unknown, ctx: z.RefinementCtx) => {
  const moneda = MonedaPermitidaSchema.safeParse(valor)
  if (!moneda.success)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['moneda'],
      message: moneda.error.issues[0].message,
    })
}

const escalaDe = (campo: string, valor: unknown, ctx: z.RefinementCtx, nombre: string) => {
  if (typeof valor === 'number' && !tieneComoMuchoDosDecimales(valor))
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [campo],
      message: `${nombre} admite hasta 2 decimales`,
    })
}

/** caja/abrir-moneda-ars-usd */
export const AbrirCajaConReglasSchema = AbrirCajaCommandSchema.superRefine((v, ctx) => {
  exigirMoneda(v.moneda, ctx)
  escalaDe('saldoInicialDeclarado', v.saldoInicialDeclarado, ctx, 'El saldo inicial')
})

/** caja/cerrar-moneda-ars-usd */
export const CerrarCajaConReglasSchema = CerrarCajaCommandSchema.superRefine((v, ctx) => {
  exigirMoneda(v.moneda, ctx)
  escalaDe('saldoFinalDeclarado', v.saldoFinalDeclarado, ctx, 'El saldo final')
})

/** pago/monto-dos-decimales */
export const RegistrarPagoConReglasSchema = RegistrarPagoCommandSchema.superRefine((v, ctx) =>
  escalaDe('monto', v.monto, ctx, 'El monto'),
)

/** producto/stock-inicial-no-negativo: el contrato publica el mínimo 0 y el esquema generado ya lo dice. */
export const CreateProductoConReglasSchema = CreateProductoCommandSchema

/** compra/detalle-cantidad-entera-por-bulto, compra/detalle-costo-positivo y compra/detalle-moneda-ars */
export const CompraDetalleConReglasSchema = CompraDetalleDtoSchema.superRefine((v, ctx) => {
  const agregar = (campo: string, resultado: z.SafeParseReturnType<unknown, unknown>) => {
    if (!resultado.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [campo],
        message: resultado.error.issues[0].message,
      })
    }
  }
  if (typeof v.cantidad === 'number') {
    const positiva = CantidadDeCompraSchema.safeParse(v.cantidad)
    agregar('cantidad', positiva)
    if (positiva.success && !esCantidadEnteraSiEsBulto(v.unidadCompra, v.cantidad)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cantidad'],
        message: 'En bulto la cantidad tiene que ser un número entero',
      })
    }
  }
  if (typeof v.costoUnitario === 'number')
    agregar('costoUnitario', CostoUnitarioDeCompraSchema.safeParse(v.costoUnitario))
  agregar('monedaCosto', MonedaDeCompraSchema.safeParse(v.monedaCosto))
})

/** comprobante-compra/cuit-del-emisor-valido: lo mismo que `Cuit.EsValido` del backend. */
export const ComprobanteCompraInputConReglasSchema = ComprobanteCompraInputSchema.superRefine(
  (v, ctx) => {
    if (typeof v.cuitEmisor !== 'string' || !cuitEsValido(v.cuitEmisor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cuitEmisor'],
        message: 'El CUIT del emisor no es válido',
      })
    }
  },
)

const MENSAJE_COMISION_CEDIDA =
  'El porcentaje de comisión cedido debe estar entre 0 y 100 sin incluir los extremos'

/** venta/comision-cedida-rango-condicional: el rango, para usar también en el campo del formulario. */
export const PorcentajeComisionCedidoSchema = z
  .number()
  .gt(0, MENSAJE_COMISION_CEDIDA)
  .lt(100, MENSAJE_COMISION_CEDIDA)

/** venta/comision-cedida-rango-condicional: solo cuando viene. */
export const CreateVentaConReglasSchema = CreateVentaCommandSchema.superRefine((v, ctx) => {
  const p = v.porcentajeComisionCedido
  if (typeof p === 'number' && !PorcentajeComisionCedidoSchema.safeParse(p).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['porcentajeComisionCedido'],
      message: MENSAJE_COMISION_CEDIDA,
    })
  }
})

/** socio/email-formato: formato de email válido o vacío. El servidor usa la misma expresión (EmailValidationExtensions). */
export const EmailDeSocioSchema = z.string().email('Email inválido').or(z.literal(''))

/** socio/email-formato */
export const CreateSocioConReglasSchema = CreateSocioCommandSchema.superRefine((v, ctx) => {
  if (typeof v.email === 'string' && !EmailDeSocioSchema.safeParse(v.email).success)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Email inválido' })
})

/** Esquema web de cada validador del backend que tiene un fixture de paridad. */
export const ESQUEMAS_POR_VALIDADOR: Record<string, z.ZodTypeAny> = {
  AbrirCajaCommandValidator: AbrirCajaConReglasSchema,
  AutorizarVentaCommandValidator: AutorizarVentaConReglasSchema,
  CerrarCajaCommandValidator: CerrarCajaConReglasSchema,
  CompraDetalleDtoValidator: CompraDetalleConReglasSchema,
  ComprobanteCompraInputValidator: ComprobanteCompraInputConReglasSchema,
  CreateProductoValidator: CreateProductoConReglasSchema,
  CreateSocioCommandValidator: CreateSocioConReglasSchema,
  CreateVentaCommandValidator: CreateVentaConReglasSchema,
  RegistrarPagoCommandValidator: RegistrarPagoConReglasSchema,
}
