import { readdirSync, readFileSync, statSync } from 'fs'
import { join, sep } from 'path'

/**
 * Contrato de las listas largas (S9 / REN-02): toda FlatList o SectionList lleva `LISTA_LARGA_PROPS`.
 * Las listas pesadas de una columna usan FlashList (listasFlashContrato) y no llevan estas props.
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
    expect(conLista.length).toBeGreaterThan(5)
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

  // Sentry FORWARD-MOBILE-Z: on Android, React Native lets a list with sticky headers clip while it has no
  // header and turns clipping off once one appears; that toggle crashes the Fabric mount. Every sticky list
  // turns clipping off for good, overriding the `removeClippedSubviews: true` of LISTA_LARGA_PROPS.
  const encabezadoFijo = /\b(stickySectionHeadersEnabled|stickyHeaderIndices)\b/g
  const conEncabezadoFijo = todos.filter((p) => (readFileSync(p, 'utf8').match(encabezadoFijo) ?? []).length > 0)

  it('encuentra las listas con encabezados fijos', () => {
    expect(conEncabezadoFijo.length).toBeGreaterThan(0)
  })

  it.each(
    conEncabezadoFijo.map((p) => [p.slice(RAIZ.length + 1).split(sep).join('/'), p]),
  )('%s no recorta vistas en sus listas con encabezados fijos', (_nombre, p) => {
    const fuente = readFileSync(p, 'utf8')
    const fijas = (fuente.match(encabezadoFijo) ?? []).length
    const sinRecorte = (fuente.match(/removeClippedSubviews=\{false\}/g) ?? []).length
    expect(sinRecorte).toBeGreaterThanOrEqual(fijas)
  })
})
