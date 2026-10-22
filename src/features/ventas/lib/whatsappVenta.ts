/**
 * WhatsApp de una venta, copia de la web: `shared/lib/telefono-whatsapp.ts` (normalizarTelefonoWhatsappAr,
 * construirUrlWhatsapp) y `features/ventas/core/domain/mensaje-whatsapp-venta.ts`. El teléfono del socio es texto
 * libre; sin un número argentino válido de 10 dígitos no hay enlace y la acción queda deshabilitada.
 */
export function normalizarTelefonoWhatsappAr(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  let digits = telefono.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('54')) {
    digits = digits.slice(2)
    if (digits.startsWith('9')) digits = digits.slice(1)
  }
  if (digits.startsWith('0')) digits = digits.slice(1)
  // El "15" de móvil doméstico, solo cuando el número mide exactamente los 10 nacionales + los 2 del marcador.
  if (digits.length === 12) {
    for (const areaLen of [2, 3, 4]) {
      if (digits.slice(areaLen, areaLen + 2) === '15') {
        digits = digits.slice(0, areaLen) + digits.slice(areaLen + 2)
        break
      }
    }
  }
  if (digits.length !== 10) return null
  return `549${digits}`
}

/** Texto precargado: tipo, número y total, sin enlaces (el detalle vive detrás del login). */
export function mensajeWhatsAppVenta(p: { tipoOperacion: number | null | undefined; id: string; codigoPedido?: string | null; total: string }): string {
  const tipo = p.tipoOperacion === 1 ? 'presupuesto' : 'venta'
  const codigo = p.codigoPedido || p.id.slice(0, 8).toUpperCase()
  return `Hola! Te comparto el resumen de tu ${tipo} #${codigo}. Total: ${p.total}.`
}

/** `wa.me` con el número normalizado y el texto; null si el teléfono no sirve. */
export function urlWhatsAppVenta(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = normalizarTelefonoWhatsappAr(telefono)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null
}
