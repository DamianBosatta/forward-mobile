import { readdirSync, readFileSync, statSync } from 'fs'
import { join, sep } from 'path'

/**
 * Contrato de las listas largas (S9 / REN-02): toda FlatList o SectionList lleva `LISTA_LARGA_PROPS`.
 * Las dos excepciones no son listas largas: son un solo bloque envuelto en una FlatList para que scrollee.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..')
const EXCEPCIONES = ['ListaUsuarios.tsx', 'ElegirProveedor.tsx']

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === '__tests__' || n === 'node_modules' ? [] : archivos(p)
    return p.endsWith('.tsx') ? [p] : []
  })
}

describe('listas largas', () => {
  const todos = [...archivos(join(RAIZ, 'src')), ...archivos(join(RAIZ, 'app'))]
  const conLista = todos.filter((p) => /<(FlatList|SectionList)\b/.test(readFileSync(p, 'utf8')))

  it('encuentra las listas del proyecto', () => {
    expect(conLista.length).toBeGreaterThan(10)
  })

  it.each(
    conLista.map((p) => [p.slice(RAIZ.length + 1).split(sep).join('/'), p]),
  )('%s usa LISTA_LARGA_PROPS', (_nombre, p) => {
    if (EXCEPCIONES.some((e) => p.endsWith(e))) return
    const fuente = readFileSync(p, 'utf8')
    const abiertas = (fuente.match(/<(FlatList|SectionList)\b/g) ?? []).length
    const conProps = (fuente.match(/<(FlatList|SectionList)(<[^>]+>)?\s*\{\.\.\.LISTA_LARGA_PROPS\}/g) ?? []).length
    expect(conProps).toBe(abiertas)
  })
})
