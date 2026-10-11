/**
 * Cada aviso que puede mandar el servidor tiene nombre e icono, y cada destino lleva a una
 * pantalla que existe en `app/` o no navega. Los valores salen del `schema.ts` GENERADO (no de
 * una copia a mano): un destino o tipo nuevo del contrato sin mapear hace fallar este test.
 */
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { RUTA_POR_DESTINO, avisoDeTipo, rutaDeAccion, type AccionDestino } from '../avisos'

const RAIZ = resolve(__dirname, '../../../..')
const SCHEMA = readFileSync(join(RAIZ, 'libs/api-client/generated/schema.ts'), 'utf8')

function valoresDelEnum(nombre: string): string[] {
  const linea = new RegExp(`\\n\\s{8}${nombre}: ((?:"[^"]+"(?: \\| )?)+);`).exec(SCHEMA)
  if (!linea) throw new Error(`${nombre} no está en schema.ts: ¿se regeneró el cliente?`)
  return Array.from(linea[1].matchAll(/"([^"]+)"/g), (m) => m[1])
}

/** `/ventas/abc` existe si hay `app/(tabs)/ventas/abc.tsx`, `[id].tsx` o `abc/index.tsx`. */
function pantallaExiste(ruta: string): boolean {
  let dir = join(RAIZ, 'app', '(tabs)')
  const segmentos = ruta.split('?')[0].split('/').filter(Boolean)
  for (const [i, seg] of segmentos.entries()) {
    const ultimo = i === segmentos.length - 1
    const dinamico = readdirSync(dir).find((n) => /^\[.+\](\.tsx)?$/.test(n))
    if (ultimo) {
      if (existsSync(join(dir, `${seg}.tsx`)) || existsSync(join(dir, seg, 'index.tsx'))) return true
      return !!dinamico && dinamico.endsWith('.tsx')
    }
    if (existsSync(join(dir, seg))) dir = join(dir, seg)
    else if (dinamico && !dinamico.endsWith('.tsx')) dir = join(dir, dinamico)
    else return false
  }
  return false
}

describe('avisos del servidor', () => {
  it.each(valoresDelEnum('TipoNotificacion'))('el tipo %s tiene nombre e icono', (tipo) => {
    const aviso = avisoDeTipo(tipo)
    expect(aviso?.etiqueta).toBeTruthy()
    expect(aviso?.Icono).toBeTruthy()
  })

  it.each(valoresDelEnum('AccionDestino'))('el destino %s lleva a una pantalla que existe o no navega', (destino) => {
    // Decidido a propósito: sin entrada, un destino nuevo no navegaría y nadie se enteraría.
    expect(Object.keys(RUTA_POR_DESTINO)).toContain(destino)
    const ruta = rutaDeAccion({ destino: destino as AccionDestino, entidadId: 'abc-123', etiqueta: 'Ver' })
    if (ruta !== null) expect(pantallaExiste(ruta)).toBe(true)
  })

  it('los avisos de talonario de remitos (23 y 24) se nombran por lo que pasa', () => {
    expect(avisoDeTipo('TalonarioRemitoPorVencer')?.etiqueta).toBe('CAI de remitos por vencer')
    expect(avisoDeTipo('TalonarioRemitoPorAgotarse')?.etiqueta).toBe('Talonario de remitos por agotarse')
  })

  it('Configuración de facturación (destino 12) no navega: talonarios y CAI son de la web', () => {
    expect(valoresDelEnum('AccionDestino')).toContain('ConfiguracionFacturacion')
    expect(rutaDeAccion({ destino: 'ConfiguracionFacturacion', entidadId: null, etiqueta: 'Cargar talonario' })).toBeNull()
  })

  it('una ficha lleva a su id y sin id no navega', () => {
    expect(rutaDeAccion({ destino: 'Venta', entidadId: 'v-1', etiqueta: 'Ver venta' })).toBe('/ventas/v-1')
    expect(rutaDeAccion({ destino: 'Venta', entidadId: null, etiqueta: 'Ver venta' })).toBeNull()
  })

  it('un destino o tipo que esta versión no conoce no rompe', () => {
    expect(rutaDeAccion({ destino: 'Futuro' as AccionDestino, etiqueta: 'Ver' })).toBeNull()
    expect(rutaDeAccion({ destino: 'constructor' as AccionDestino, etiqueta: 'Ver' })).toBeNull()
    expect(avisoDeTipo('toString')).toBeNull()
    expect(rutaDeAccion(null)).toBeNull()
  })
})
