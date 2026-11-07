// Same fetch as every build profile in eas.json (see src/core/api/__tests__/fetchDeReactNative.test.ts).
process.env.EXPO_PUBLIC_USE_RN_FETCH = '1'

module.exports = {
  preset: 'jest-expo',
  // Reanimated 4.7 needs its own resolver under Jest: importing it otherwise throws (JSReanimated has no setCSSEventHandler).
  resolver: 'react-native-reanimated/jest/resolver',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|@unimodules/.*|unimodules|sentry-expo|@sentry/.*|@shopify/flash-list|native-base|react-native-svg|zustand|immer|moti)'
  ],
  // Gesture Handler 3 calls its native module on import: its official Jest mocks replace that module.
  setupFiles: ['react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/libs/(.*)$': '<rootDir>/libs/$1',
    '^@/src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.{spec,test}.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'libs/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/__tests__/**',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  // Suite pesada de RN (render + 130 ms reales por cada userEvent.press): 5 s no alcanza con la máquina cargada.
  testTimeout: 10000,
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '.', outputName: 'junit.xml' }],
  ],
}
