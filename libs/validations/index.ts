import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Venta Schemas – compartidos entre web y mobile
// ─────────────────────────────────────────────────────────────────────────────

export const ventaDetalleSchema = z.object({
  productoId: z.string().uuid('ID de producto inválido'),
  cantidad: z
    .number({ required_error: 'La cantidad es obligatoria' })
    .int()
    .positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z
    .number({ required_error: 'El precio es obligatorio' })
    .positive('El precio debe ser mayor a 0'),
})

export const createVentaSchema = z.object({
  clienteId: z.string().uuid('Debe seleccionar un cliente válido'),
  depositoId: z.string().uuid('Debe seleccionar un depósito válido'),
  tipoOperacion: z.number().int().default(2),
  descuentoGeneral: z.number().min(0).max(100).default(0),
  metodoEntrega: z.number().int().default(1),
  fechaEntrega: z.date().nullable().optional(),
  detalles: z
    .array(ventaDetalleSchema)
    .min(1, 'La venta debe tener al menos un producto'),
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
  entidadId: z.string().uuid('Debe seleccionar un cliente/proveedor'),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  medioPago: z.enum(['Efectivo', 'Transferencia', 'Tarjeta']),
  tipo: z.enum(['Cobranza', 'PagoProveedor']),
})

export type RegistrarPagoFormData = z.infer<typeof registrarPagoSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Caja Schema
// ─────────────────────────────────────────────────────────────────────────────

export const abrirCajaSchema = z.object({
  saldoInicial: z.number().min(0, 'El saldo inicial no puede ser negativo'),
})

export const cerrarCajaSchema = z.object({
  saldoFinalDeclarado: z.number().min(0, 'El saldo final no puede ser negativo'),
})

// ─────────────────────────────────────────────────────────────────────────────
// Login Schema
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type LoginFormData = z.infer<typeof loginSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Socio Comercial Schema
// ─────────────────────────────────────────────────────────────────────────────

export const socioSchema = z.object({
  razonSocial: z.string().min(3, 'Mínimo 3 caracteres'),
  cuit: z.string().length(11, 'El CUIT debe tener exactamente 11 dígitos'),
  tipoRaw: z.union([z.literal(0), z.literal(1)]), // 0=Cliente, 1=Proveedor
  condicionIva: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido').or(z.literal('')).optional(),
  telefono: z.string().optional().default(''),
  direccion: z.string().optional().default(''),
})

export type SocioFormData = z.infer<typeof socioSchema>
// ─────────────────────────────────────────────────────────────────────────────
// Compra Schema
// ─────────────────────────────────────────────────────────────────────────────

export const compraDetalleSchema = z.object({
  productoId: z.string().uuid('ID de producto inválido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  costoUnitario: z.number().min(0, 'El costo no puede ser negativo'),
})

export const createCompraSchema = z.object({
  proveedorId: z.string().uuid('Debe seleccionar un proveedor válido'),
  depositoId: z.string().uuid('Debe seleccionar un depósito válido'),
  gastosOperativos: z.number().min(0, 'Los gastos no pueden ser negativos').default(0),
  descuentoPorcentaje: z.number().min(0).max(100).default(0),
  detalles: z.array(compraDetalleSchema).min(1, 'Agregá al menos un producto'),
  estado: z.number().int().min(1).max(3),
})

export type CreateCompraFormData = z.infer<typeof createCompraSchema>
