// Audit A-05: the Drawer had no nested Stack, so a back action from an inner screen went to the first route.
// This renders the REAL layouts found under app/(tabs) (the Drawer and every section _layout) and stubs only
// the leaf screens, so adding or removing a section layout changes what the test sees.
import 'react-native-gesture-handler/jestSetup'
import fs from 'fs'
import path from 'path'
import React from 'react'
import { Text } from 'react-native'
import { DrawerActions } from '@react-navigation/native'
import { useNavigation, useRouter } from 'expo-router'
import { act, renderRouter, screen } from 'expo-router/testing-library'

// The global mock lacks SafeAreaView, which the router's default navigator wrapper needs.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)
// The real drawer content reads the status the same way (useDrawerStatus).
jest.mock('@/src/components/layout/CustomDrawerContent', () => {
  const { Text } = require('react-native')
  const { useDrawerStatus } = require('@react-navigation/drawer')
  return () => <Text>{`cajon:${useDrawerStatus()}`}</Text>
})
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => ({ width: 390, height: 844, isSmall: false, isMedium: true, isLarge: false, isTablet: false, scale: (n: number) => n }),
}))

jest.setTimeout(30_000)

const RAIZ = path.join(__dirname, '..', '(tabs)')

/** Real `_layout` files, stub leaf screens; the key is the route file path relative to app/. */
function arbol(dir = RAIZ, rel = '(tabs)'): Record<string, any> {
  const mapa: Record<string, any> = {}
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      Object.assign(mapa, arbol(path.join(dir, e.name), `${rel}/${e.name}`))
    } else if (e.name.endsWith('.tsx')) {
      const clave = `${rel}/${e.name.replace(/\.tsx$/, '')}`
      mapa[clave] = e.name === '_layout.tsx'
        ? jest.requireActual(path.join(dir, e.name))
        : () => <Text>{`pantalla:${clave}`}</Text>
    }
  }
  return mapa
}

const pantalla = (clave: string) => screen.queryByText(`pantalla:(tabs)/${clave}`)

const SECCIONES_CON_INTERNAS = [
  ['ventas', 'nueva'],
  ['inventario', 'stock'],
  ['compras', 'nueva'],
  ['proveedores', 'nuevo'],
  ['socios', 'nuevo'],
  ['cuentas', 'cobro'],
  ['tesoreria', 'transferencia'],
  ['avisos', 'preferencias'],
  ['perfil', 'clave'],
  ['perfil', 'usuarios'],
] as const

describe('Drawer sections keep their own back stack (A-05)', () => {
  it.each(SECCIONES_CON_INTERNAS)('%s > %s: back lands on the section index, not on Inicio', (seccion, interna) => {
    let router!: ReturnType<typeof useRouter>
    const mapa = arbol()
    const Original = mapa[`(tabs)/${seccion}/index`]
    mapa[`(tabs)/${seccion}/index`] = () => {
      router = useRouter()
      return <Original />
    }
    const { getPathname } = renderRouter(mapa, { initialUrl: `/${seccion}` })
    expect(pantalla(`${seccion}/index`)).toBeTruthy()

    act(() => router.push(`/(tabs)/${seccion}/${interna}` as never))
    expect(pantalla(`${seccion}/${interna}`)).toBeTruthy()

    act(() => router.back())
    expect(pantalla(`${seccion}/index`)).toBeTruthy()
    expect(pantalla('index')).toBeNull()
    expect(getPathname()).toBe(`/${seccion}`)
  })

  it('a deep link to an inner screen keeps the section index behind it', () => {
    let router!: ReturnType<typeof useRouter>
    const mapa = arbol()
    const Original = mapa['(tabs)/ventas/nueva']
    mapa['(tabs)/ventas/nueva'] = () => {
      router = useRouter()
      return <Original />
    }
    const { getPathname } = renderRouter(mapa, { initialUrl: '/ventas/nueva' })
    expect(pantalla('ventas/nueva')).toBeTruthy()
    act(() => router.back())
    expect(getPathname()).toBe('/ventas')
  })

  it('an inner screen opened from another section goes back to where the user came from', () => {
    let router!: ReturnType<typeof useRouter>
    const mapa = arbol()
    mapa['(tabs)/index'] = () => {
      router = useRouter()
      return <Text>pantalla:(tabs)/index</Text>
    }
    renderRouter(mapa, { initialUrl: '/' })
    act(() => router.push('/(tabs)/ventas/nueva' as never))
    expect(pantalla('ventas/nueva')).toBeTruthy()
    act(() => router.back())
    expect(pantalla('index')).toBeTruthy()
  })

  it('every section href the drawer uses still opens that section index', () => {
    let router!: ReturnType<typeof useRouter>
    const mapa = arbol()
    mapa['(tabs)/index'] = () => {
      router = useRouter()
      return <Text>pantalla:(tabs)/index</Text>
    }
    renderRouter(mapa, { initialUrl: '/' })
    for (const seccion of ['ventas', 'socios', 'inventario', 'compras', 'proveedores', 'autorizaciones', 'cuentas', 'tesoreria', 'calendario', 'avisos', 'reportes', 'perfil']) {
      act(() => router.push(`/(tabs)/${seccion}` as never))
      expect(pantalla(`${seccion}/index`)).toBeTruthy()
    }
    act(() => router.push('/(tabs)/inventario/stock' as never))
    expect(pantalla('inventario/stock')).toBeTruthy()
    act(() => router.push('/(tabs)/logistica/pedidos' as never))
    expect(pantalla('logistica/pedidos')).toBeTruthy()
    act(() => router.push('/(tabs)/logistica/consola' as never))
    expect(pantalla('logistica/consola')).toBeTruthy()
    act(() => router.push('/(tabs)/perfil' as never))
    expect(pantalla('perfil/index')).toBeTruthy()
  })

  // Call sites that replace across sections (ClienteForm, RequirePermission, GlobalErrorBoundary).
  it.each([
    ['socios', 'nuevo', '/(tabs)/ventas/nueva', 'ventas/nueva'],
    ['socios', 'nuevo', '/(tabs)/socios/[id]', 'socios/[id]'],
    ['compras', 'nueva', '/(tabs)/compras/[id]', 'compras/[id]'],
    ['ventas', 'nueva', '/(tabs)', 'index'],
    ['ventas', 'nueva', '/', 'index'],
  ])('router.replace from %s/%s to %s opens it', (seccion, interna, destino, pantallaEsperada) => {
    let router!: ReturnType<typeof useRouter>
    const mapa = arbol()
    const Original = mapa[`(tabs)/${seccion}/${interna}`]
    mapa[`(tabs)/${seccion}/${interna}`] = () => {
      router = useRouter()
      return <Original />
    }
    renderRouter(mapa, { initialUrl: `/${seccion}/${interna}` })
    act(() => router.replace(destino.replace('[id]', '7') as never))
    expect(pantalla(pantallaEsperada)).toBeTruthy()
  })

  it('the menu button of an inner screen still opens the Drawer', () => {
    const mapa = arbol()
    let abrir!: () => void
    mapa['(tabs)/ventas/index'] = () => {
      const navigation = useNavigation()
      abrir = () => navigation.dispatch(DrawerActions.openDrawer())
      return <Text>pantalla:(tabs)/ventas/index</Text>
    }
    renderRouter(mapa, { initialUrl: '/ventas' })
    expect(screen.getByText('cajon:closed')).toBeTruthy()
    act(() => abrir())
    expect(screen.getByText('cajon:open')).toBeTruthy()
  })
})
