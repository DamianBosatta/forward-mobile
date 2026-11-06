/**
 * Textos de error de zod 3 sobre zod 4.
 *
 * Los esquemas del contrato (`generated/`) no ponen mensaje propio: el que ve la persona es el de
 * zod ("Number must be greater than or equal to 0"). Zod 4 cambió esos textos ("Too small: expected
 * number to be >=0"), así que se registra una locale que devuelve los de zod 3 para que lo que se
 * muestra no cambie con la versión. Un mensaje puesto en el esquema (`.min(1, 'texto')`,
 * `.refine(f, 'texto')`, `message`) tiene prioridad y no pasa por acá.
 *
 * Es global (`z.config`): los consumidores de los esquemas lo importan por su efecto.
 */
import { z } from 'zod'

type Incidencia = z.core.$ZodRawIssue

function tipoDe(valor: unknown): string {
  if (valor === undefined) return 'undefined'
  if (valor === null) return 'null'
  if (typeof valor === 'number') return Number.isNaN(valor) ? 'nan' : 'number'
  if (Array.isArray(valor)) return 'array'
  if (valor instanceof Date) return 'date'
  if (valor instanceof Map) return 'map'
  if (valor instanceof Set) return 'set'
  if (valor instanceof Promise) return 'promise'
  return typeof valor
}

const unirValores = (valores: readonly unknown[]) =>
  valores.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(' | ')

function limite(i: Incidencia & { origin?: string; inclusive?: boolean }, valor: unknown, esMinimo: boolean): string {
  const inclusivo = i.inclusive !== false
  const n = String(valor)
  switch (i.origin) {
    case 'string':
      return `String must contain ${inclusivo ? (esMinimo ? 'at least' : 'at most') : esMinimo ? 'over' : 'under'} ${n} character(s)`
    case 'array':
    case 'set':
      return `${i.origin === 'set' ? 'Set' : 'Array'} must contain ${inclusivo ? (esMinimo ? 'at least' : 'at most') : esMinimo ? 'more than' : 'fewer than'} ${n} element(s)`
    case 'number':
    case 'int':
      return `Number must be ${esMinimo ? (inclusivo ? 'greater than or equal to ' : 'greater than ') : inclusivo ? 'less than or equal to ' : 'less than '}${n}`
    default:
      return 'Invalid input'
  }
}

export function mensajeZod3(i: Incidencia): string {
  switch (i.code) {
    case 'invalid_type': {
      if (i.input === undefined) return 'Required'
      if (i.expected === 'int')
        return typeof i.input === 'number' ? 'Expected integer, received float' : `Expected number, received ${tipoDe(i.input)}`
      return `Expected ${String(i.expected)}, received ${tipoDe(i.input)}`
    }
    case 'too_small':
      return limite(i, i.minimum, true)
    case 'too_big':
      return limite(i, i.maximum, false)
    case 'invalid_value': {
      const valores = i.values as readonly unknown[]
      if (valores.length === 1) return `Invalid literal value, expected ${JSON.stringify(valores[0])}`
      if (i.input === undefined) return 'Required'
      if (typeof i.input !== 'string') return `Expected ${unirValores(valores)}, received ${tipoDe(i.input)}`
      return `Invalid enum value. Expected ${unirValores(valores)}, received '${i.input}'`
    }
    case 'unrecognized_keys':
      return `Unrecognized key(s) in object: ${i.keys.map((k) => `'${k}'`).join(', ')}`
    case 'invalid_format':
      return i.format === 'regex' ? 'Invalid' : `Invalid ${i.format}`
    case 'not_multiple_of':
      return `Number must be a multiple of ${String(i.divisor)}`
    default:
      return 'Invalid input'
  }
}

z.config({ localeError: mensajeZod3 })
