import { z } from 'zod'

/**
 * Toma un campo del esquema generado desde el contrato OpenAPI (C-010: el backend es la fuente de
 * la validación) para usarlo en un formulario. El generado marca todo `.optional()`/`.nullable()`
 * porque el contrato no publica `required`; el formulario lo quiere obligatorio, así que se
 * descubre el esquema de adentro. El mensaje en español se pone encima: los límites siguen siendo
 * los del contrato y solo cambia el texto que ve la persona.
 */
function interior(esquema: z.ZodTypeAny): z.ZodTypeAny {
  let actual = esquema
  while (actual instanceof z.ZodOptional || actual instanceof z.ZodNullable) {
    actual = actual.unwrap()
  }
  return actual
}

function conMensaje<T extends z.ZodTypeAny>(esquema: T, mensaje?: string): T {
  if (!mensaje) return esquema
  const def = { ...esquema._def, errorMap: () => ({ message: mensaje }) }
  return new (esquema.constructor as new (def: unknown) => T)(def)
}

type Forma = z.ZodRawShape

export function numeroDelContrato<T extends Forma>(
  objeto: z.ZodObject<T>,
  campo: keyof T & string,
  mensaje?: string,
): z.ZodNumber {
  const esquema = interior(objeto.shape[campo])
  if (!(esquema instanceof z.ZodNumber))
    throw new Error(`El campo ${campo} del contrato no es un número`)
  return conMensaje(esquema, mensaje)
}

export function textoDelContrato<T extends Forma>(
  objeto: z.ZodObject<T>,
  campo: keyof T & string,
  mensaje?: string,
): z.ZodString {
  const esquema = interior(objeto.shape[campo])
  if (!(esquema instanceof z.ZodString))
    throw new Error(`El campo ${campo} del contrato no es un texto`)
  return conMensaje(esquema, mensaje)
}
