import fs from 'fs'
import path from 'path'

/**
 * Guarda (S5): solo la regla central (`libs/api-client/invalidaciones.ts`) llama a
 * invalidateQueries / refetchQueries / resetQueries. Sin lista de excepciones: una pantalla o un
 * mutation que lo necesite usa una función de la regla.
 */
const RAIZ = path.resolve(__dirname, '../../..')
const CARPETAS = ['libs', 'src', 'app', 'hooks']
const CENTRAL = path.join('libs', 'api-client', 'invalidaciones.ts')
const LLAMADA = /\.(invalidateQueries|refetchQueries|resetQueries)\s*\(/

function archivos(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '__tests__' ? [] : archivos(p)
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [p] : []
  })
}

describe('guarda de invalidaciones', () => {
  it('ningún archivo fuera de la regla central invalida o refresca la caché a mano', () => {
    const infractores = CARPETAS.flatMap((c) => archivos(path.join(RAIZ, c)))
      .map((p) => path.relative(RAIZ, p))
      .filter((rel) => rel !== CENTRAL)
      .filter((rel) => LLAMADA.test(fs.readFileSync(path.join(RAIZ, rel), 'utf8')))
    expect(infractores).toEqual([])
  })

  it('la regla central sí las usa (la guarda no mira un archivo equivocado)', () => {
    expect(LLAMADA.test(fs.readFileSync(path.join(RAIZ, CENTRAL), 'utf8'))).toBe(true)
  })
})
