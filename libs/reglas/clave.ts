/**
 * Política de contraseñas: espejo de `PasswordPolicy` del backend
 * (Forward-Api/Application/Common/Security/PasswordPolicy.cs), que es la fuente de verdad.
 * Mismos criterios que el `PasswordValidator` de Identity (ASCII: una "ñ" o un espacio cuentan
 * como símbolo, no como letra) y mismos textos. Paridad probada con
 * `Forward-Api/contrato/reglas/clave/politica.json` (`clave.test.ts` y `PasswordPolicyParidadTests`).
 */
export const CLAVE_LARGO_MINIMO = 10

/** Cantidad mínima de caracteres distintos (la política del servidor pide 1). */
const CLAVE_DISTINTOS_MINIMO = 1

export type CodigoRequisitoClave = 'largo' | 'simbolo' | 'numero' | 'minuscula' | 'mayuscula'

export interface RequisitoClave {
  /** Estable: sirve de key y para tests. */
  codigo: CodigoRequisitoClave
  /** El texto del servidor. */
  mensaje: string
  cumple: boolean
}

const MENSAJE_DISTINTOS = `La contraseña debe tener al menos ${CLAVE_DISTINTOS_MINIMO} caracteres distintos.`

/**
 * Los cinco requisitos de la política con su estado para `clave`, en el orden del servidor
 * (largo, símbolo, número, minúscula, mayúscula): para una lista en vivo mientras se escribe.
 */
export function evaluarClave(clave: string): RequisitoClave[] {
  return [
    {
      codigo: 'largo',
      mensaje: `La contraseña debe tener al menos ${CLAVE_LARGO_MINIMO} caracteres.`,
      cumple: clave.length >= CLAVE_LARGO_MINIMO,
    },
    {
      codigo: 'simbolo',
      mensaje: 'La contraseña debe tener al menos un símbolo (por ejemplo ! @ # $ . -).',
      cumple: /[^A-Za-z0-9]/.test(clave),
    },
    {
      codigo: 'numero',
      mensaje: 'La contraseña debe tener al menos un número.',
      cumple: /[0-9]/.test(clave),
    },
    {
      codigo: 'minuscula',
      mensaje: 'La contraseña debe tener al menos una minúscula.',
      cumple: /[a-z]/.test(clave),
    },
    {
      codigo: 'mayuscula',
      mensaje: 'La contraseña debe tener al menos una mayúscula.',
      cumple: /[A-Z]/.test(clave),
    },
  ]
}

/**
 * Un mensaje por cada regla que `clave` incumple, como `PasswordPolicy.Violations`; lista vacía si
 * cumple todas. No evalúa "obligatoria": eso lo informa cada formulario con su propio texto.
 */
export function mensajesDeClave(clave: string): string[] {
  const mensajes = evaluarClave(clave)
    .filter((r) => !r.cumple)
    .map((r) => r.mensaje)
  if (new Set(clave).size < CLAVE_DISTINTOS_MINIMO) mensajes.push(MENSAJE_DISTINTOS)
  return mensajes
}
