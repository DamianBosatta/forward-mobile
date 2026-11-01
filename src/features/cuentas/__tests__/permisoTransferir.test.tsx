import { renderHook } from '@testing-library/react-native'
import { usePuedeTransferir } from '../lib/permiso'
import { conPermisos } from '@/features/clientes/__testing__/ayuda'

jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn() }, API_URL: '' }))

describe('usePuedeTransferir', () => {
  it('es true con MOD_PAGOS crear y leer y MOD_CC leer', () => {
    conPermisos([
      { module: 'MOD_PAGOS', canRead: true, canCreate: true },
      { module: 'MOD_CC', canRead: true },
    ])
    expect(renderHook(() => usePuedeTransferir()).result.current).toBe(true)
  })
  it('es false sin MOD_CC leer', () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    expect(renderHook(() => usePuedeTransferir()).result.current).toBe(false)
  })
  it('es false sin MOD_PAGOS crear', () => {
    conPermisos([
      { module: 'MOD_PAGOS', canRead: true },
      { module: 'MOD_CC', canRead: true },
    ])
    expect(renderHook(() => usePuedeTransferir()).result.current).toBe(false)
  })
  it('es false sin MOD_PAGOS leer', () => {
    conPermisos([
      { module: 'MOD_PAGOS', canCreate: true },
      { module: 'MOD_CC', canRead: true },
    ])
    expect(renderHook(() => usePuedeTransferir()).result.current).toBe(false)
  })
})
