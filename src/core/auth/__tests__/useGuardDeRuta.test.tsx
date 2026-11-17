/** ARQ-04: un enlace (`forward://compras`) a una pantalla sin permiso vuelve a Inicio, como el middleware de la web. */
import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useAuthStore } from '@/libs/store/auth.store'
import { useGuardDeRuta } from '../useGuardDeRuta'

const mockReplace = jest.fn()
let mockPathname = '/'
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => mockParams,
}))

const fila = (module: string, crear = false) => ({ module, canRead: true, canCreate: crear, canUpdate: false, canDelete: false })

function sesion(permissions: ReturnType<typeof fila>[] | null) {
  act(() => {
    useAuthStore.getState().setTokens({ accessToken: 'a', refreshToken: 'r' } as never)
    if (permissions) useAuthStore.getState().setUser({ id: 'u1', permissions } as never)
  })
}

beforeEach(() => {
  mockReplace.mockReset()
  mockParams = {}
  act(() => useAuthStore.getState().logout())
})

describe('useGuardDeRuta', () => {
  it('sin el permiso de la pantalla vuelve a Inicio', () => {
    sesion([fila('MOD_VIAJES')])
    mockPathname = '/compras'
    renderHook(() => useGuardDeRuta())
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  })

  it('con el permiso se queda', () => {
    sesion([fila('MOD_COMPRAS')])
    mockPathname = '/compras/c1'
    renderHook(() => useGuardDeRuta())
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('los parámetros cuentan: editar una venta con solo crear vuelve a Inicio', () => {
    sesion([fila('MOD_VENTAS', true)])
    mockPathname = '/ventas/nueva'
    mockParams = { editar: 'v9' }
    renderHook(() => useGuardDeRuta())
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  })

  it('sin el perfil todavía no decide (no rebota un enlace en el arranque)', () => {
    sesion(null)
    mockPathname = '/compras'
    renderHook(() => useGuardDeRuta())
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
