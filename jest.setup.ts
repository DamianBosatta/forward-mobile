import '@testing-library/jest-native/extend-expect'
import * as Haptics from 'expo-haptics'
import { configure } from '@testing-library/react-native'
import { timeoutManager } from '@tanstack/react-query'

// findBy*/waitFor esperan 1 s por defecto: con la máquina cargada una pantalla tarda más en pintar.
configure({ asyncUtilTimeout: 4000 })

// react-query keeps a gc timer (5 min by default) per unmounted query. A real timer keeps the Node process alive,
// so a test file with a QueryClient never let jest exit (cobro.test.tsx looked hung for 5 minutes after passing).
// Unref'd timers still fire, they just do not hold the process open.
const sinBloquearSalida = <T extends ReturnType<typeof setTimeout>>(timer: T): T => {
  ;(timer as { unref?: () => void }).unref?.()
  return timer
}
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => sinBloquearSalida(setTimeout(callback, delay)),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (callback, delay) => sinBloquearSalida(setInterval(callback, delay)),
  clearInterval: (id) => clearInterval(id),
})

// Worklets reads its native module on import: tests use the package's own mock.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({
    isConnected: true,
    isInternetReachable: true,
  }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

(Haptics as any).ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
(Haptics as any).NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };



// Silence standard warnings
jest.spyOn(console, 'warn').mockImplementation(() => {})

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  return {
    createMMKV: jest.fn().mockImplementation(() => {
      const storage = new Map()
      return {
        set: (key: string, value: any) => storage.set(key, value),
        getString: (key: string) => storage.get(key),
        getNumber: (key: string) => storage.get(key),
        getBoolean: (key: string) => storage.get(key),
        remove: (key: string) => storage.delete(key),
        clearAll: () => storage.clear(),
        getAllKeys: () => Array.from(storage.keys()),
      }
    }),
  }
})


// Los filtros de las listas viven en memoria toda la sesión (useFiltroPersistente): cada test arranca limpio.
beforeEach(() => {
  require('@/core/hooks/useFiltroPersistente').olvidarFiltros()
})
