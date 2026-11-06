import easConfig from '../../../../eas.json'

/**
 * Since SDK 56 Expo replaces the global `fetch` with `expo/fetch` unless this flag is set. The app
 * relies on React Native's fetch: `esFallaDeRed` needs its `TypeError`, `esTiempoAgotado` its
 * `AbortError`, photo uploads send `{ uri, name, type }` parts `expo/fetch` doesn't support, and
 * `fetchWithTimeout` covers the body because the promise resolves once the body has arrived.
 * Jest mocks `fetch`, so no other test notices. CI's `eas update` reads this env from eas.json too.
 */
describe('fetch de React Native en cada perfil de build', () => {
  it.each(Object.entries(easConfig.build))('%s lo mantiene', (_perfil, perfil) => {
    expect((perfil.env as Record<string, string>).EXPO_PUBLIC_USE_RN_FETCH).toBe('1')
  })
})
