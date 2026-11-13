import { cuitEsValido } from '@/libs/reglas'
import { EmailDeSocioSchema } from '@/libs/validations/generated/reglas'
import { CAMPOS_OBLIGATORIOS_CLIENTE, type CampoObligatorioCliente } from './condicionesPago'

export const ERROR_CUIT_REQUERIDO = 'El CUIT es requerido'
export const ERROR_CUIT_INVALIDO = 'Revisá el CUIT: no es válido.'
export const ERROR_EMAIL = 'Email inválido'
export const ERROR_SALDO_INICIAL = 'Revisá el saldo inicial: va en pesos, sin signo.'

export type CampoConError = CampoObligatorioCliente | 'cuit' | 'email' | 'saldoInicial'
export type ErroresDelCliente = Partial<Record<CampoConError, string>>

interface Entrada {
  telefono: string; direccion: string; nombreFantasia: string; nombreContacto: string; cuit: string; email: string
  /** Lo tipeado en saldo inicial no es un monto (vacío sí: es 0). */
  saldoInicialInvalido: boolean
}

/**
 * Lo que la web exige al guardar (buildSocioSchema): en un cliente NUEVO no provisorio, teléfono, dirección, nombre de
 * fantasía, contacto y CUIT; el dígito verificador del CUIT y el formato del email SIEMPRE que haya algo escrito.
 * `cuitEditable` en falso (bloqueado por ser edición de no administrador) lo saca de la cuenta.
 */
export function validarCliente(d: Entrada, { esAltaNueva, altaProvisoria, cuitEditable }: { esAltaNueva: boolean; altaProvisoria: boolean; cuitEditable: boolean }): ErroresDelCliente {
  const e: ErroresDelCliente = {}
  if (esAltaNueva && !altaProvisoria) {
    for (const [campo, mensaje] of CAMPOS_OBLIGATORIOS_CLIENTE) if (!d[campo].trim()) e[campo] = mensaje
  }
  if (cuitEditable) {
    if (d.cuit.trim()) { if (!cuitEsValido(d.cuit)) e.cuit = ERROR_CUIT_INVALIDO }
    else if (esAltaNueva && !altaProvisoria) e.cuit = ERROR_CUIT_REQUERIDO
  }
  if (d.email.trim() && !EmailDeSocioSchema.safeParse(d.email.trim()).success) e.email = ERROR_EMAIL
  if (d.saldoInicialInvalido) e.saldoInicial = ERROR_SALDO_INICIAL
  return e
}
