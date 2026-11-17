/**
 * ARQ-04: cada pantalla de la app pide lo mismo que su ruta de la web. Toda pantalla de `app/` tiene una decisión
 * (una ruta de la web o abierta, con el motivo): una pantalla nueva sin decidir hace fallar este test.
 */
import fs from 'node:fs'
import path from 'node:path'
import { permisosDesde } from '@/features/auth/lib/permisos'
import { destinoDeRuta, puedeAbrirPantalla } from '../rutasDeLaApp'

const APP = path.resolve(__dirname, '../../../../app')

/** `app/(tabs)/ventas/[id].tsx` → `/ventas/x1`, como lo da `usePathname`. */
function pantallas(dir = APP): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const lleno = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : pantallas(lleno)
    if (!e.name.endsWith('.tsx') || e.name.startsWith('_') || e.name.startsWith('+')) return []
    const rel = path.relative(APP, lleno).split(path.sep).join('/').replace(/\.tsx$/, '')
    const ruta = rel.split('/').filter((s) => !/^\(.*\)$/.test(s)).map((s) => s.replace(/^\[.+\]$/, 'x1'))
    if (ruta[ruta.length - 1] === 'index') ruta.pop()
    return [`/${ruta.join('/')}`]
  })
}

const filas = (...grants: string[]) =>
  permisosDesde(grants.map((g) => {
    const [module, acciones = 'R'] = g.split(':')
    return { module, canRead: acciones.includes('R'), canCreate: acciones.includes('C'), canUpdate: acciones.includes('U'), canDelete: acciones.includes('D') }
  }) as never)

describe('pantallas de la app → rutas de la web (ARQ-04)', () => {
  it('toda pantalla de app/ tiene una decisión', () => {
    const lista = pantallas()
    expect(lista.length).toBeGreaterThan(30)
    expect(lista.filter((p) => destinoDeRuta(p) === undefined)).toEqual([])
  })

  it('cada pantalla con módulo pide el de su ruta de la web', () => {
    expect(destinoDeRuta('/ventas/v9')).toEqual({ web: '/ventas' })
    expect(destinoDeRuta('/ventas/nueva', { editar: 'v9' })).toEqual({ web: '/ventas/v9/editar' })
    expect(destinoDeRuta('/compras/nueva', { edit: 'c1' })).toEqual({ web: '/compras/nueva?edit=1' })
    expect(destinoDeRuta('/proveedores')).toEqual({ web: '/socios/proveedores' })
    expect(destinoDeRuta('/proveedores/p1')).toEqual({ web: '/socios/p1' })
    expect(destinoDeRuta('/tesoreria/pagos')).toEqual({ web: '/finanzas/pagos' })
    expect(destinoDeRuta('/inventario')).toEqual({ web: '/catalogo' })
    expect(destinoDeRuta('/perfil/usuarios')).toEqual({ web: '/usuarios' })
  })

  it('un enlace a una pantalla sin el permiso no la abre', () => {
    const chofer = filas('MOD_VIAJES', 'MOD_VENTAS')
    expect(puedeAbrirPantalla(chofer, '/logistica/consola')).toBe(true)
    expect(puedeAbrirPantalla(chofer, '/ventas/v9')).toBe(true)
    expect(puedeAbrirPantalla(chofer, '/compras')).toBe(false)
    expect(puedeAbrirPantalla(chofer, '/ventas/nueva')).toBe(false)
    expect(puedeAbrirPantalla(chofer, '/tesoreria/pagos/p1')).toBe(false)
  })

  it('crear no alcanza para editar una venta', () => {
    const vendedor = filas('MOD_VENTAS:RC')
    expect(puedeAbrirPantalla(vendedor, '/ventas/nueva')).toBe(true)
    expect(puedeAbrirPantalla(vendedor, '/ventas/nueva', { editar: 'v9' })).toBe(false)
  })

  it('las pantallas propias de cada uno abren sin permisos', () => {
    for (const p of ['/', '/avisos', '/calendario', '/perfil', '/perfil/clave', '/buscar', '/autorizaciones/a1']) {
      expect(puedeAbrirPantalla(filas(), p)).toBe(true)
    }
  })
})
