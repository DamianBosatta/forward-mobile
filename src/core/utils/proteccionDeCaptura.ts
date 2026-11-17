import { Platform } from 'react-native'
import { enableAppSwitcherProtectionAsync, preventScreenCaptureAsync } from 'expo-screen-capture'

/**
 * M9, SEG-12, owner's decision #24 ("Toda la app"): no screen of the app can be captured or shows in the app
 * switcher thumbnail. Called once at the root (`app/_layout.tsx`), for the whole life of the app.
 * - Android: `preventScreenCaptureAsync` sets FLAG_SECURE, which also blanks the recent apps preview.
 * - iOS: it blocks screenshots and recordings; the app switcher snapshot needs its own call (blur).
 * Needs the `expo-screen-capture` native module: a build made before it was added cannot run this JS (the
 * fingerprint runtime keeps an OTA from reaching it).
 */
export async function protegerCapturaDeLaApp(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return
  await preventScreenCaptureAsync()
  if (Platform.OS === 'ios') await enableAppSwitcherProtectionAsync()
}
