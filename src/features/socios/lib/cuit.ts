import { cuitEsValido } from '@/libs/reglas'

/** Mismos textos que `buildSocioSchema` de la web (`packages/validations`). */
export const CUIT_INVALIDO = 'CUIT inválido: revisá los dígitos (el verificador no cierra)'
export const CUIT_REQUERIDO = 'El CUIT es requerido'

/**
 * Regla del CUIT de un socio, la de la web (L-35): si está, el dígito verificador tiene que cerrar
 * siempre; vacío solo se acepta fuera de un alta nueva o en un alta provisoria. Null si está bien.
 * El servidor valida igual (`Cuit.EsValido`); esto lo dice antes de mandar (X5).
 */
export function errorDeCuit(cuit: string, opts: { esAltaNueva: boolean; altaProvisoria: boolean }): string | null {
  if (cuit.trim()) return cuitEsValido(cuit) ? null : CUIT_INVALIDO
  return opts.esAltaNueva && !opts.altaProvisoria ? CUIT_REQUERIDO : null
}
