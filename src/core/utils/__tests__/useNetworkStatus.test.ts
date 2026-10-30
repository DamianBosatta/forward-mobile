import { act, renderHook } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { useNetworkStatus } from '../useNetworkStatus'

type Estado = { isConnected: boolean | null; isInternetReachable: boolean | null }
let emitir: (e: Estado) => void = () => {}
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: (cb: (e: Estado) => void) => { emitir = cb; return () => {} } },
}))

describe('useNetworkStatus', () => {
  it('por defecto, alcanzabilidad desconocida (null) cuenta como sin red y apaga el OnlineManager', () => {
    const { result } = renderHook(() => useNetworkStatus())
    act(() => emitir({ isConnected: true, isInternetReachable: null }))
    expect(result.current.isConnected).toBe(false)
    expect(onlineManager.isOnline()).toBe(false)
    act(() => emitir({ isConnected: true, isInternetReachable: true }))
    expect(result.current.isConnected).toBe(true)
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('con desconocidoCuentaComoSinRed=false, null no es sin red; solo un false afirmado lo es', () => {
    const { result } = renderHook(() => useNetworkStatus({ desconocidoCuentaComoSinRed: false }))
    act(() => emitir({ isConnected: true, isInternetReachable: null }))
    expect(result.current.isConnected).toBe(true)
    act(() => emitir({ isConnected: true, isInternetReachable: false }))
    expect(result.current.isConnected).toBe(false)
    act(() => emitir({ isConnected: false, isInternetReachable: null }))
    expect(result.current.isConnected).toBe(false)
  })
})
