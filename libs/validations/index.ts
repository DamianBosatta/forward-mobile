import { z } from 'zod'

import { numeroDelContrato } from './generated/desde-contrato'
import {
  AbrirCajaCommandSchema,
  CerrarCajaCommandSchema,
  CreateCompraCommandSchema,
  CreateVentaCommandItemDtoSchema,
  CreateVentaCommandSchema,
  RegistrarPagoCommandSchema,
} from './generated/generated/esquemas'
import {
  CantidadDeCompraSchema,
  conEscalaDeDinero,
  CostoUnitarioDeCompraSchema,
  MonedaDeCompraSchema,
} from './generated/reglas'

// Los límites salen del contrato (libs/validations/generated, copiado con `npm run sync:validaciones`,
// C-010): acá solo queda lo que el contrato no publica, marcado con `// ux`. No se escribe un
// límite propio de una regla de negocio: se toma del esquema generado.

// ─────────────────────────────────────────────────────────────────────────────
// Venta Schemas – compartidos entre web y mobile
// ─────────────────────────────────────────────────────────────────────────────

export const ventaDetalleSchema = z.object({
  productoId: z.string().uuid('ID de producto inválido'), // ux: el contrato no publica el formato
  // ux: la grilla vende de a unidades enteras; el backend admite decimales.
  cantidad: numeroDelContrato(
    CreateVentaCommandItemDtoSchema,
    'cantidad',
    'La cantidad debe ser mayor a 0',
  ).int('La cantidad debe ser mayor a 0'),
  // ux: el precio no viaja en el alta (el backend lo toma del producto y rechaza el precio en 0).
  precioUnitario: z
    .number({ required_error: 'El precio es obligatorio' })
    .positive('El precio debe ser mayor a 0'), // ux
  descuentoPorcentaje: numeroDelContrato(
    CreateVentaCommandItemDtoSchema,
    'descuentoPorcentaje',
    'El descuento debe estar entre 0 y 100',
  ).default(0),
})

export const createVentaSchema = z.object({
  clienteId: z.string().uuid('Debe seleccionar un cliente válido'), // ux
  depositoId: z.string().uuid('Debe seleccionar un depósito válido'), // ux
  tipoOperacion: z.number().int().default(2), // ux: el formulario guarda el ordinal
  descuentoGeneral: numeroDelContrato(
    CreateVentaCommandSchema,
    'descuentoGeneral',
    'El descuento general debe estar entre 0 y 100',
  ).default(0),
  metodoEntrega: z.number().int().default(1), // ux: el formulario guarda el ordinal
  fechaEntrega: z.date().nullable().optional(), // ux
  detalles: z
    .array(ventaDetalleSchema)
    .min(1, 'La venta debe tener al menos un producto'), // ux
}).refine(data => {
  if (data.metodoEntrega !== 2 && !data.fechaEntrega) {
    return false;
  }
  return true;
}, {
  message: 'La fecha de entrega es obligatoria para envíos',
  path: ['fechaEntrega'],
}).refine(data => {
  if (data.fechaEntrega && data.fechaEntrega.getDay() === 0) {
    return false;
  }
  return true;
}, {
  message: 'No se permiten entregas los domingos',
  path: ['fechaEntrega'],
})

export type CreateVentaFormData = z.infer<typeof createVentaSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Pago / Cobranza Schema
// ─────────────────────────────────────────────────────────────────────────────

export const registrarPagoSchema = z.object({
  entidadId: z.string().uuid('Debe seleccionar un cliente/proveedor'), // ux
  monto: conEscalaDeDinero(
    numeroDelContrato(RegistrarPagoCommandSchema, 'monto', 'El monto debe ser mayor a 0'),
  ),
  medioPago: z.enum(['Efectivo', 'Transferencia', 'Tarjeta']), // ux
  tipo: z.enum(['Cobranza', 'PagoProveedor']), // ux
})

export type RegistrarPagoFormData = z.infer<typeof registrarPagoSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Caja Schema
// ─────────────────────────────────────────────────────────────────────────────

export const abrirCajaSchema = z.object({
  saldoInicial: conEscalaDeDinero(
    numeroDelContrato(
      AbrirCajaCommandSchema,
      'saldoInicialDeclarado',
      'El saldo inicial no puede ser negativo',
    ),
    'El saldo inicial',
  ),
})

export const cerrarCajaSchema = z.object({
  saldoFinalDeclarado: conEscalaDeDinero(
    numeroDelContrato(
      CerrarCajaCommandSchema,
      'saldoFinalDeclarado',
      'El saldo final no puede ser negativo',
    ),
    'El saldo final',
  ),
})

// ─────────────────────────────────────────────────────────────────────────────
// Login Schema
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'), // ux
  // El login no tiene regla de largo en el backend (igual que la web): solo que no venga vacía.
  password: z.string().min(1, 'La contraseña es obligatoria'), // ux
})

export type LoginFormData = z.infer<typeof loginSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Compra Schema
// ─────────────────────────────────────────────────────────────────────────────

export const compraDetalleSchema = z.object({
  productoId: z.string().uuid('ID de producto inválido'), // ux
  cantidad: CantidadDeCompraSchema,
  costoUnitario: CostoUnitarioDeCompraSchema,
  monedaCosto: MonedaDeCompraSchema.default('ARS'),
})

export const createCompraSchema = z.object({
  proveedorId: z.string().uuid('Debe seleccionar un proveedor válido'), // ux
  depositoId: z.string().uuid('Debe seleccionar un depósito válido'), // ux
  gastosOperativos: numeroDelContrato(
    CreateCompraCommandSchema,
    'gastosOperativos',
    'Los gastos no pueden ser negativos',
  ).default(0),
  descuentoPorcentaje: numeroDelContrato(
    CreateCompraCommandSchema,
    'descuentoPorcentaje',
    'El descuento debe estar entre 0 y 100',
  ).default(0),
  detalles: z.array(compraDetalleSchema).min(1, 'Agregá al menos un producto'), // ux
  estado: z.number().int().gte(1).lte(3), // ux: el formulario guarda el ordinal (Presupuesto/Confirmado/Entregado)
})

export type CreateCompraFormData = z.infer<typeof createCompraSchema>
