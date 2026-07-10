import '@testing-library/jest-native/extend-expect'
import * as Haptics from 'expo-haptics'

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

