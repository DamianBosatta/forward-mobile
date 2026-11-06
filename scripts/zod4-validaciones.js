// Adapta a zod 4 los archivos que sync-validaciones.js y check-validaciones.js copian de
// forward-system (la web sigue en zod 3). Los esquemas generados (generated/esquemas.ts) ya valen
// para las dos versiones y pasan tal cual; solo cambian las dos APIs de zod 3 que zod 4 sacó:
// `errorMap` (ahora `message`/`error`) y `SafeParseReturnType` (ahora `ZodSafeParseResult`).
// Si la fuente ya está en zod 4 las reglas no encuentran nada y no cambian el texto; si queda
// una API de zod 3 sin cubrir, falla en vez de copiar un archivo que no compila.
const CAMBIOS = [
  {
    archivo: 'reglas/index.ts',
    de: /errorMap: \(\) => \(\{ message: ([^}]+?) \}\)/g,
    a: 'message: $1',
  },
  {
    archivo: 'reglas/index.ts',
    de: /z\.SafeParseReturnType<unknown, unknown>/g,
    a: 'z.ZodSafeParseResult<unknown>',
  },
  {
    archivo: 'desde-contrato.ts',
    de: /  const def = \{ \.\.\.esquema\._def, errorMap: \(\) => \(\{ message: mensaje \}\) \}\n  return new \(esquema\.constructor as new \(def: unknown\) => T\)\(def\)/g,
    a: '  return esquema.clone({ ...esquema._zod.def, error: () => mensaje }) as T',
  },
  {
    archivo: 'desde-contrato.ts',
    de: /interior\(objeto\.shape\[campo\]\)/g,
    a: 'interior(objeto.shape[campo] as unknown as z.ZodTypeAny)',
  },
  {
    archivo: 'desde-contrato.ts',
    de: /actual = actual\.unwrap\(\)$/gm,
    a: 'actual = actual.unwrap() as z.ZodTypeAny',
  },
]

const SOBRANTES = [/errorMap/, /SafeParseReturnType/, /esquema\.constructor/]

function adaptar(rel, texto) {
  let salida = texto.replace(/\r\n/g, '\n')
  for (const c of CAMBIOS) if (c.archivo === rel) salida = salida.replace(c.de, c.a)
  if (rel !== 'generated/esquemas.ts')
    for (const s of SOBRANTES)
      if (s.test(salida)) throw new Error(`${rel}: queda una API de zod 3 (${s}) que scripts/zod4-validaciones.js no adapta.`)
  return salida
}

module.exports = { adaptar }
