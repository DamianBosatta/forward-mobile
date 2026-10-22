import type { CondicionPago } from '@/features/clientes/lib/cliente'

/**
 * Cómo se le paga al proveedor, en pocas palabras ("30 días de factura"). Null si el servidor no
 * trae condición: a un proveedor sin condición no se le asume contado, se avisa que faltan datos.
 */
export function condicionBreve(cp?: CondicionPago | null): string | null {
  switch (cp?.tipo) {
    case 'Contado': return 'Contado'
    case 'DiasDesdeFactura': return `${cp.dias ?? '—'} días de factura`
    case 'DiasDesdeEntrega': return `${cp.dias ?? '—'} días de entrega`
    case 'DiaFijoDelMes': return `el día ${cp.diaDelMes ?? '—'} de cada mes`
    default: return null
  }
}

/** Misma convención que la web: saldo positivo es lo que se le debe, negativo es a favor. */
export function saldoDelProveedor(saldo: number): { etiqueta: 'Le debemos' | 'A favor' | 'Al día'; monto: number } {
  if (saldo > 0) return { etiqueta: 'Le debemos', monto: saldo }
  if (saldo < 0) return { etiqueta: 'A favor', monto: -saldo }
  return { etiqueta: 'Al día', monto: 0 }
}

export const AVISO_FALTAN_DATOS = 'Faltan datos para comprarle: la condición de pago tiene que estar cargada.'
export const AVISO_CAMPOS_SENSIBLES_PROVEEDOR = 'La razón social y el CUIT los cambia un administrador: pedilo con «Pedir cambio» en la ficha del proveedor.'
export const AVISO_EDICION_PROVEEDOR = 'No se dan de baja desde la app.'
export const RAZON_SOCIAL_CORTA = 'La razón social necesita al menos 3 caracteres.'
export const PLAZO_FALTANTE = 'Indicá los días de la condición de pago.'
export const DIA_DEL_MES_FALTANTE = 'Indicá el día del mes de la condición de pago.'
