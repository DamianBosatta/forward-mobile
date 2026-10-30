/**
 * NativeWind 4 (react-native-css-interop) descarta el `style` en forma de función de un Pressable: el elemento queda
 * sin fondo, padding, alto ni dirección de fila. El estilo va fijo y el toque se marca con `android_ripple`.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const RAIZ = resolve(__dirname, '../../../..')
const ESTILO_FUNCION = /style=\{\s*\(\s*(\{\s*pressed\s*\}|state|\w+)\s*\)\s*=>/

function archivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    if (nombre === 'node_modules' || nombre === '__tests__') return []
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivosTsx(ruta)
    return ruta.endsWith('.tsx') ? [ruta] : []
  })
}

describe('Pressable con estilo fijo', () => {
  it('ningún componente de src ni app pasa el style como función', () => {
    const conFuncion = ['src', 'app']
      .flatMap((d) => archivosTsx(join(RAIZ, d)))
      .filter((ruta) => ESTILO_FUNCION.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(RAIZ, ruta).replace(/\\/g, '/'))
    expect(conFuncion).toEqual([])
  })
})
