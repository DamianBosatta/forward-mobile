import { renderHook, act } from '@testing-library/react-native'
import { useColors, useIsDark, useThemeStore, themeColors } from '../theme'

// El tema "Como el teléfono" tiene que seguir al sistema y re-renderizar al cambiar.
// El preset de RN mockea useColorScheme con un valor fijo: se reemplaza por uno
// que se suscribe y se puede cambiar, como el real.
let mockEsquema: 'light' | 'dark' = 'light'
const mockOyentes = new Set<() => void>()

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => {
  const { useReducer, useEffect } = require('react')
  return {
    __esModule: true,
    default: () => {
      const [, forzar] = useReducer((n: number) => n + 1, 0)
      useEffect(() => {
        mockOyentes.add(forzar)
        return () => {
          mockOyentes.delete(forzar)
        }
      }, [])
      return mockEsquema
    },
  }
})

function cambiarSistema(esquema: 'light' | 'dark') {
  mockEsquema = esquema
  act(() => {
    mockOyentes.forEach((f) => f())
  })
}

beforeEach(() => {
  mockEsquema = 'light'
  useThemeStore.setState({ mode: 'system' })
})

describe('modo "system"', () => {
  it('con el teléfono en claro devuelve la paleta clara', () => {
    const { result } = renderHook(() => ({ c: useColors(), oscuro: useIsDark() }))
    expect(result.current.c).toBe(themeColors.light)
    expect(result.current.oscuro).toBe(false)
  })

  it('re-renderiza con la paleta oscura cuando el teléfono pasa a oscuro', () => {
    const { result } = renderHook(() => ({ c: useColors(), oscuro: useIsDark() }))
    cambiarSistema('dark')
    expect(result.current.c).toBe(themeColors.dark)
    expect(result.current.oscuro).toBe(true)
  })

  it('un modo explícito ignora al sistema', () => {
    useThemeStore.setState({ mode: 'dark' })
    const { result } = renderHook(() => useColors())
    expect(result.current).toBe(themeColors.dark)
  })
})
