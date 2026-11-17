/**
 * M9, SEG-09: the app only scans and takes photos, it never records audio. No module may declare the microphone:
 * expo-camera adds RECORD_AUDIO / NSMicrophoneUsageDescription unless told not to, and expo-image-picker adds
 * RECORD_AUDIO unless it is blocked.
 */
type Plugin = string | [string, Record<string, unknown>]

const config = require('../../../../app.config').default as {
  android: { blockedPermissions?: string[]; permissions?: string[] }
  plugins: Plugin[]
}

const opcionesDe = (nombre: string) => {
  const plugin = config.plugins.find((p) => Array.isArray(p) && p[0] === nombre) as [string, Record<string, unknown>]
  return plugin?.[1]
}

it('android blocks RECORD_AUDIO, whatever module asks for it', () => {
  expect(config.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO')
  expect(config.android.permissions ?? []).not.toContain('android.permission.RECORD_AUDIO')
})

it('expo-camera declares no microphone on Android nor iOS', () => {
  expect(opcionesDe('expo-camera')).toMatchObject({ recordAudioAndroid: false, microphonePermission: false })
})
