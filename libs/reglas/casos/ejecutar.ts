/**
 * Casos compartidos como DATOS (C-022): la web y mobile corren los mismos casos contra la misma
 * regla. Sin framework de tests: `ejecutarCasos` devuelve las fallas y cada runner (vitest en la
 * web, jest en mobile) asegura que la lista esté vacía.
 */
export interface Caso {
  /** Qué dice la regla en este caso, en una frase. */
  nombre: string
  entrada: readonly unknown[]
  esperado: unknown
}

export interface FallaDeCaso {
  regla: string
  nombre: string
  esperado: unknown
  obtenido: unknown
}

export function ejecutarCasos(
  casos: Readonly<Record<string, readonly Caso[]>>,
  reglas: Readonly<Record<string, (...entrada: never[]) => unknown>>,
): FallaDeCaso[] {
  const fallas: FallaDeCaso[] = []
  for (const [regla, lista] of Object.entries(casos)) {
    const fn = reglas[regla] as ((...e: unknown[]) => unknown) | undefined
    if (!fn) {
      fallas.push({ regla, nombre: '(sin función registrada)', esperado: 'función', obtenido: fn })
      continue
    }
    for (const caso of lista) {
      const obtenido = fn(...caso.entrada)
      if (!Object.is(obtenido, caso.esperado)) {
        fallas.push({ regla, nombre: caso.nombre, esperado: caso.esperado, obtenido })
      }
    }
  }
  return fallas
}
