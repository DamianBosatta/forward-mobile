// L-33: las etiquetas y colores de hoja de ruta de mobile no cambian al resolver por la tabla compartida.
jest.mock('@/libs/theme', () => ({
  BRAND: { orange: 'O', blue: 'B', violet: 'V', green: 'G', red: 'R' },
  tokens: {},
  useColors: () => ({}),
}))
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useNavigation: jest.fn(), useFocusEffect: jest.fn() }))
jest.mock('@/libs/api-client/logistica', () => ({}))
jest.mock('@/libs/store/auth.store', () => ({ useAuthStore: jest.fn() }))
jest.mock('@/core/ui', () => ({}))
jest.mock('moti', () => ({ MotiView: 'MotiView' }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({}) }))
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: {} }))

import { getEstadoBadge } from '../components/ChoferDashboard'
import { estadoColor, estatoLabel } from '../components/RouteSelector'

const C = { primary: 'P', success: 'S', danger: 'D', textMuted: 'M' } as never

describe('hoja de ruta: ChoferDashboard.getEstadoBadge', () => {
  it.each([
    [1, 'PROGRAMADA', 'O'], [5, 'DOCUMENTADA', 'B'], [2, 'EN CURSO', 'P'],
    [3, 'FINALIZADA', 'S'], [4, 'CANCELADA', 'D'],
  ])('%s -> %s', (estado, label, color) => {
    expect(getEstadoBadge(estado, C)).toEqual({ label, color })
  })
  it('un estado desconocido o ausente no se muestra como uno conocido', () => {
    expect(getEstadoBadge(99, C)).toEqual({ label: 'DESCONOCIDA', color: 'M' })
    expect(getEstadoBadge(undefined, C)).toEqual({ label: 'DESCONOCIDA', color: 'M' })
  })
})

describe('hoja de ruta: RouteSelector', () => {
  it.each([[1, 'PROGRAMADA'], [5, 'DOCUMENTADA'], [2, 'EN RUTA'], [3, 'FINALIZADA'], [4, 'CANCELADA'], [99, 'DESCONOCIDO'], [undefined, 'DESCONOCIDO']])(
    'etiqueta %s -> %s',
    (estado, label) => expect(estatoLabel(estado)).toBe(label),
  )
  it.each([[1, 'O'], [5, 'B'], [2, 'P'], [3, 'G'], [4, 'R'], [99, 'O']])('color %s -> %s', (estado, color) =>
    expect(estadoColor(estado, 'P')).toBe(color),
  )
})
