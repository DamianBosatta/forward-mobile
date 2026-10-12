import { formatImporte } from '@/core/ui/fw/formatImporte'

/**
 * Cómo se nombra a un cliente en mobile (regla del dueño): el cliente se identifica por la
 * DIRECCIÓN de entrega, que va como título; el nombre (contacto y local) va en una línea aparte,
 * nunca pegado al string de la dirección. Por eso no se usa `displayName` del servidor, que los une.
 */
export interface ClienteNombrable {
  direccion?: string | null
  nombreFantasia?: string | null
  nombreContacto?: string | null
  razonSocial?: string | null
}

export const SIN_DIRECCION = 'Sin dirección cargada'

export function direccionDeEntrega(c: ClienteNombrable): string {
  return c.direccion?.trim() || SIN_DIRECCION
}

/** "Contacto · Local": el local es el nombre de fantasía o, si no hay, la razón social. */
export function nombreDelCliente(c: ClienteNombrable): string {
  const local = c.nombreFantasia?.trim() || c.razonSocial?.trim() || ''
  const contacto = c.nombreContacto?.trim() || ''
  return [contacto, local].filter((p, i, todos) => p && todos.indexOf(p) === i).join(' · ')
}

/** Dos letras para el avatar, de la dirección: "Av. del Valle 89" → "AV", "Brandsen 3314" → "B3". */
export function inicialesDeDireccion(direccion: string): string {
  const palabras = direccion.split(/\s+/).filter(Boolean)
  return palabras.slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export type TipoCondicionPago = 'Contado' | 'DiasDesdeEntrega' | 'DiasDesdeFactura' | 'DiaFijoDelMes'
export interface CondicionPago {
  tipo?: TipoCondicionPago
  dias?: number | null
  diaDelMes?: number | null
  descripcion?: string | null
}

/** Texto de la condición de pago. Sin condición cargada el servidor trata al cliente como contado. */
export function textoCondicionPago(cp?: CondicionPago | null): string {
  if (cp?.descripcion?.trim()) return cp.descripcion.trim()
  switch (cp?.tipo) {
    case 'DiasDesdeEntrega': return `Cuenta corriente, ${cp.dias ?? '—'} días desde la entrega`
    case 'DiasDesdeFactura': return `Cuenta corriente, ${cp.dias ?? '—'} días desde la factura`
    case 'DiaFijoDelMes': return `Cuenta corriente, el día ${cp.diaDelMes ?? '—'} de cada mes`
    default: return 'Contado'
  }
}

/** "Mostrando N de M", con " · Saldo $ X" solo si el servidor dio el saldo de toda la cartera. */
export function textoMostrando(cantidad: number, total: number, saldoTotal?: number): string {
  const saldo = saldoTotal !== undefined ? ` · Saldo ${formatImporte(saldoTotal, { centavos: false })}` : ''
  return `Mostrando ${cantidad} de ${total}${saldo}`
}
