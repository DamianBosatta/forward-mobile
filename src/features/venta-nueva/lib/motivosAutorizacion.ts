/**
 * Motivos de `MotivoPendienteAutorizacion` (flags del servidor; mismos bits que la web en
 * motivo-pendiente-autorizacion-ui.ts) en palabras para "quedó por autorizar porque…".
 * Un bit que el teléfono todavía no conoce no se muestra (nunca rompe la pantalla).
 */
const MOTIVOS: [number, string][] = [
  [1, 'falta stock'],
  [2, 'un precio queda debajo del mínimo'],
  [4, 'un descuento supera tu tope'],
  [8, 'cediste parte de tu comisión'],
  [16, 'el cliente tiene deuda de más de 30 días'],
  [32, 'supera el tope de venta del cliente'],
]

export const ESTADO_PENDIENTE_AUTORIZACION = 9

export function motivosAutorizacion(flags: number | null | undefined): string[] {
  return MOTIVOS.filter(([bit]) => ((flags ?? 0) & bit) === bit).map(([, texto]) => texto)
}
