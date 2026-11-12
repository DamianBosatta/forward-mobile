import { formatImporte } from '@/core/ui/fw/formatImporte'

/**
 * A quién va el movimiento del flujo en pasos: el cobro a un cliente (de siempre) o el pago a un proveedor
 * (Tesorería > Pagos, "Debo" de Cuentas). El POST es el mismo (`/Finanzas/pagos/multilinea`): el servidor
 * deduce si entra o sale plata por el tipo del socio.
 */
export type Contraparte = 'cliente' | 'proveedor'

export interface TextosDelFlujo {
  titulo: string
  pasos: readonly [string, string, string, string]
  continuarAlPaso2: string
  /** Lo que se cobra o se paga, en los pies y el resumen ("Cobrás", "Pagás"). */
  verbo: string
  saldo: string
  /** Encabezado del paso 3; el cobro no lleva. */
  comoPaga: string | null
  quien: string
  registrar: (total: number) => string
  quedaRegistrado: string
  errorAlRegistrar: string
  errorAlAbrir: string
  avisoImputacion: string
  sinComprobantes: string
  chequeVaSolo: string
}

/** Imputación automática del cobro (el texto de siempre del formulario y del cobro en pasos). */
export const AVISO_IMPUTACION =
  'Imputación automática: el servidor lo aplica a la deuda más vieja y te dice en qué cuenta (TST o Normal) quedó.'
export const AVISO_IMPUTACION_PAGO = 'Imputación automática: el servidor lo aplica a la deuda más vieja con el proveedor.'
export const CHEQUE_VA_SOLO_EN_EL_PAGO = 'El cheque propio va en un pago de un solo medio.'

const CLIENTE: TextosDelFlujo = {
  titulo: 'Cobrar',
  pasos: ['Cliente', 'Qué se cobra', 'Medios', 'Confirmar'],
  continuarAlPaso2: 'Continuar a qué se cobra',
  verbo: 'Cobrás',
  saldo: 'Saldo del cliente',
  comoPaga: null,
  quien: 'Cliente',
  registrar: total => (total > 0 ? `Registrar cobro de ${formatImporte(total)}` : 'Registrar cobro'),
  quedaRegistrado: 'Queda registrado en la cuenta corriente del cliente',
  errorAlRegistrar: 'No se pudo registrar el cobro.',
  errorAlAbrir: 'No se pudo abrir el cliente.',
  avisoImputacion: AVISO_IMPUTACION,
  sinComprobantes: 'El cliente no tiene comprobantes pendientes.',
  chequeVaSolo: 'El cheque se carga en un cobro de un solo medio.',
}

const PROVEEDOR: TextosDelFlujo = {
  titulo: 'Pago a proveedor',
  // Cortos como los del cobro: la barra de pasos no parte renglón y tiene que entrar en 360 de ancho.
  pasos: ['Proveedor', 'Qué pagás', 'Medios', 'Confirmar'],
  continuarAlPaso2: 'Continuar a qué se paga',
  verbo: 'Pagás',
  saldo: 'Le debés',
  comoPaga: '¿Cómo le pagás?',
  quien: 'Proveedor',
  registrar: total => (total > 0 ? `Registrar pago de ${formatImporte(total)}` : 'Registrar pago'),
  quedaRegistrado: 'Queda registrado en la cuenta corriente del proveedor',
  errorAlRegistrar: 'No se pudo registrar el pago.',
  errorAlAbrir: 'No se pudo abrir el proveedor.',
  avisoImputacion: AVISO_IMPUTACION_PAGO,
  sinComprobantes: 'No le debés comprobantes a este proveedor.',
  chequeVaSolo: CHEQUE_VA_SOLO_EN_EL_PAGO,
}

/** Los textos del flujo en pasos: los del cobro son los de siempre; los del pago, los de Tesorería > Pagos. */
export const textosDe = (contraparte: Contraparte): TextosDelFlujo => (contraparte === 'proveedor' ? PROVEEDOR : CLIENTE)
