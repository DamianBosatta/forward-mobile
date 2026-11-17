/**
 * ARQ-04 (decisión #32 del dueño): la app usa la MISMA tabla de rutas que la web. El bloque entre
 * `<copia-de-la-web>` y `</copia-de-la-web>` de `reglasDeRuta.ts` tiene que ser, texto por texto, el de
 * forward-frontend/packages/api-client/src/permisos.ts en forward-system (FORWARD_SYSTEM_REPO, default ../fs-combo;
 * ref FORWARD_SYSTEM_REF, default origin/main), como `check:reglas`. Sin el repo a mano esa comparación se salta.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { permisosDesde } from '@/features/auth/lib/permisos'
import { REGLAS_DE_RUTA, cumple, puedeAbrir, reglaDeRuta } from '../reglasDeRuta'

const RAIZ = path.resolve(__dirname, '../../../..')
const repo = path.resolve(RAIZ, process.env.FORWARD_SYSTEM_REPO || path.join('..', 'fs-combo'))
const ref = process.env.FORWARD_SYSTEM_REF || 'origin/main'
const FUENTE = 'forward-frontend/packages/api-client/src/permisos.ts'

/** El bloque de la tabla: desde el comentario de las pestañas de Tesorería hasta el cierre de `REGLAS_DE_RUTA`. */
function bloqueDeLaWeb(fuente: string): string {
  const ini = fuente.indexOf('/**\n * Pestañas de Tesorería')
  const fin = fuente.indexOf('\n]\n', ini)
  if (ini < 0 || fin < 0) throw new Error('No encuentro REGLAS_DE_RUTA en permisos.ts de la web')
  return fuente.slice(ini, fin + 3)
}

function copiaLocal(): string {
  const local = fs.readFileSync(path.join(__dirname, '../reglasDeRuta.ts'), 'utf8').replace(/\r\n/g, '\n')
  const marca = '// <copia-de-la-web>\n'
  return local.slice(local.indexOf(marca) + marca.length, local.indexOf('// </copia-de-la-web>'))
}

const git = (args: string[]) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const hayRepo = fs.existsSync(repo) && git(['rev-parse', '--git-dir']).status === 0
const conRepo = hayRepo ? it : it.skip

describe('la tabla de rutas es la de la web (ARQ-04)', () => {
  it('la copia local está entera: empieza en las pestañas de Tesorería y cierra REGLAS_DE_RUTA', () => {
    expect(bloqueDeLaWeb(copiaLocal())).toBe(copiaLocal())
  })

  conRepo(`coincide con ${FUENTE} de forward-system (${ref})`, () => {
    const show = git(['show', `${ref}:${FUENTE}`])
    expect(show.status).toBe(0)
    expect(copiaLocal()).toBe(bloqueDeLaWeb(show.stdout.replace(/\r\n/g, '\n')))
  })
})

const filas = (...grants: string[]) =>
  permisosDesde(grants.map((g) => {
    const [module, acciones = 'R'] = g.split(':')
    return { module, canRead: acciones.includes('R'), canCreate: acciones.includes('C'), canUpdate: acciones.includes('U'), canDelete: acciones.includes('D') }
  }) as never)

describe('se decide igual que en la web', () => {
  it('gana la primera regla que coincide y una ruta sin regla queda abierta', () => {
    expect(reglaDeRuta('/ventas/v9/editar')?.requiere).toEqual({ modulo: 'MOD_VENTAS', accion: 'update' })
    expect(reglaDeRuta('/ventas/nueva')?.requiere).toEqual({ modulo: 'MOD_VENTAS', accion: 'create' })
    expect(reglaDeRuta('/calendario')).toBeUndefined()
    expect(puedeAbrir(filas(), '/calendario')).toBe(true)
  })

  it('`ademas` exige también la capacidad: Pagos sin CAP_VER_TESORERIA no abre', () => {
    expect(puedeAbrir(filas('MOD_PAGOS'), '/finanzas/pagos')).toBe(false)
    expect(puedeAbrir(filas('MOD_PAGOS', 'CAP_VER_TESORERIA'), '/finanzas/pagos')).toBe(true)
  })

  it('un módulo en lista alcanza con cualquiera (OR) y respeta la acción', () => {
    expect(puedeAbrir(filas('MOD_PROVEEDORES'), '/socios/s1')).toBe(true)
    expect(puedeAbrir(filas('MOD_CLIENTES'), '/socios/nueva')).toBe(false)
    expect(puedeAbrir(filas('MOD_CLIENTES:RC'), '/socios/nueva')).toBe(true)
  })

  it('el query param cambia la regla: /compras/nueva?edit= pide Update', () => {
    expect(puedeAbrir(filas('MOD_COMPRAS:RC'), '/compras/nueva')).toBe(true)
    expect(puedeAbrir(filas('MOD_COMPRAS:RC'), '/compras/nueva?edit=1')).toBe(false)
    expect(cumple(filas('MOD_COMPRAS:RU'), REGLAS_DE_RUTA.find((r) => r.searchParam === 'edit')!.requiere)).toBe(true)
  })
})
