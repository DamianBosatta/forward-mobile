/** Enlaces de contacto de un cliente. */

export function urlLlamar(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, '')}`
}

/**
 * WhatsApp con el prefijo de país 54, igual que el detalle de venta (`ventas/[id]`): sin teléfono, null.
 * (Quien toque ese detalle puede pasarse a este helper: hoy tiene la cuenta inline.)
 */
export function urlWhatsApp(telefono?: string | null): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (!digitos) return null
  return `https://wa.me/${digitos.startsWith('54') ? digitos : `54${digitos}`}`
}
