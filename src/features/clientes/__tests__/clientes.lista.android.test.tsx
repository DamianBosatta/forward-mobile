// Real ScrollView (the preset mocks it) so the test sees the clipping that React Native hands to the Android views.
jest.unmock('react-native/Libraries/Components/ScrollView/ScrollView')
// On Android the real ScrollView nests the native scroll view inside the RefreshControl; the preset's mock drops
// its children, so this one renders them.
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => ({
  __esModule: true,
  default: ({ children }: { children?: unknown }) => children ?? null,
}))
import React from 'react'
import { Platform } from 'react-native'
import { screen, waitFor } from '@testing-library/react-native'
import ClientesScreen from '../../../../app/(tabs)/socios/index'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('expo-router/react-navigation', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isLarge: false }) }))

const get = api.get as jest.Mock
const plataformaOriginal = Platform.OS

/** `removeClippedSubviews` of every native scroll view and content view on screen. */
function recorteDeLasVistasNativas(): unknown[] {
  return screen.UNSAFE_root
    .findAll(n => typeof n.type === 'string' && n.props.removeClippedSubviews !== undefined)
    .map(n => n.props.removeClippedSubviews)
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true }])
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true })
})

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { get: () => plataformaOriginal, configurable: true })
})

// Sentry FORWARD-MOBILE-Z: with sticky letter headers, React Native lets the Android content view clip while
// the list is empty and turns clipping off once sections exist. That toggle on the native ViewGroup loses
// detached children and the next Fabric insert crashes the app ("addViewAt: failed to insert view").
it('en Android la lista de clientes no recorta vistas ni cargando ni con datos, así el recorte no cambia al llegar la cartera', async () => {
  let responder: (valor: unknown) => void = () => {}
  get.mockReturnValue(new Promise(resolve => { responder = resolve }))
  renderConQuery(<ClientesScreen />)

  await waitFor(() => expect(recorteDeLasVistasNativas().length).toBeGreaterThan(0))
  const cargando = recorteDeLasVistasNativas()
  expect(screen.queryByText('Av. del Valle 89')).toBeNull()
  expect(new Set(cargando)).toEqual(new Set([false]))

  responder(pagina([clienteDeLista()], 1))
  expect(await screen.findByText('Av. del Valle 89')).toBeTruthy()

  const conDatos = recorteDeLasVistasNativas()
  expect(new Set(conDatos)).toEqual(new Set([false]))
})
