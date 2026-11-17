import { useLocalSearchParams } from 'expo-router'
import { z } from 'zod'

/**
 * Parámetros de ruta validados (ARQ-04): un enlace `forward://…` puede traer cualquier cosa. Un id va pegado en la
 * URL del API (`/Ventas/{id}`), así que solo pasa con letras, números, `-` y `_` (un GUID, un número): nada de `/`,
 * `?`, `..` ni espacios. Un texto tiene un largo máximo y una opción tiene que ser una de las esperadas. Lo que no
 * pasa queda en `undefined`, como si el enlace no lo hubiera traído.
 */
export const idDeRuta = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
export const textoDeRuta = (max: number) => z.string().min(1).max(max)
export const opcionDeRuta = <const T extends readonly [string, ...string[]]>(opciones: T) => z.enum(opciones)

type Esquema = Record<string, z.ZodType<string>>
export type ParametrosLeidos<E extends Esquema> = { [K in keyof E]?: z.infer<E[K]> }

/** Lee `crudos` con `esquema`: cada valor que no lo cumple (o que llega repetido) queda en `undefined`. */
export function leerParametros<E extends Esquema>(
  crudos: Record<string, string | string[] | undefined>,
  esquema: E,
): ParametrosLeidos<E> {
  const leidos: ParametrosLeidos<E> = {}
  for (const clave of Object.keys(esquema) as (keyof E & string)[]) {
    const valor = crudos[clave]
    if (typeof valor !== 'string') continue
    const r = esquema[clave].safeParse(valor)
    if (r.success) leidos[clave] = r.data as z.infer<E[typeof clave]>
  }
  return leidos
}

/** `useLocalSearchParams` pasado por `leerParametros`. */
export function useParametrosDeRuta<E extends Esquema>(esquema: E): ParametrosLeidos<E> {
  return leerParametros(useLocalSearchParams(), esquema)
}
