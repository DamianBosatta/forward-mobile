/** Teclado numérico de "Cantidad y descuento" (lámina CalleCantidad): hasta cuatro dígitos. */
export type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'del' | 'clr'

export const MAX_DIGITOS = 4

export function teclear(actual: string, tecla: Tecla | string): string {
  if (tecla === 'del') return actual.slice(0, -1)
  if (tecla === 'clr') return ''
  if (actual.length >= MAX_DIGITOS) return actual
  return actual === '0' ? tecla : actual + tecla
}

export const cantidadDeTeclas = (texto: string): number => (texto ? parseInt(texto, 10) : 0)

/** La cantidad va de a la venta mínima del producto (caja de 6: 6, 12, 18…); el servidor lo valida igual. */
export function errorDeCantidad(cantidad: number, multiplo: number): string | null {
  if (cantidad <= 0) return 'Poné al menos una unidad.'
  if (multiplo > 1 && cantidad % multiplo !== 0) return `Se vende de a ${multiplo}: probá con ${multiplo} o ${multiplo * 2}.`
  return null
}
