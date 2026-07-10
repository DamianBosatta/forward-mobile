module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|@sentry/react-native|native-base|react-native-svg|zustand|immer|moti)'
  ],
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
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '.', outputName: 'junit.xml' }],
  ],
}
