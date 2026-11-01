import { renderHook } from '@testing-library/react-native'
import { usePuedeCobrar } from '../lib/permiso'
import { conPermisos } from '@/features/clientes/__testing__/ayuda'

jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn() }, API_URL: '' }))

describe('usePuedeCobrar', () => {
  it('es true con MOD_PAGOS crear y leer', () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    expect(renderHook(() => usePuedeCobrar()).result.current).toBe(true)
  })
  it('es false con MOD_PAGOS solo de lectura', () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
    expect(renderHook(() => usePuedeCobrar()).result.current).toBe(false)
  })
  it('es false sin permisos', () => {
    conPermisos([])
    expect(renderHook(() => usePuedeCobrar()).result.current).toBe(false)
  })
})
