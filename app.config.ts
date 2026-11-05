import { type ExpoConfig } from 'expo/config'

/** EAS project id: used by `extra.eas` and by the EAS Update URL (single source). */
const EAS_PROJECT_ID = '058596a1-a678-4d5a-917e-79f3a93abc67'

const config: ExpoConfig = {
  name: 'Forward ERP',
  slug: 'forward-erp',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'forward',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  // OTA updates (EAS Update). A native change means a new build before any update: see docs/RELEASE.md.
  runtimeVersion: { policy: 'fingerprint' },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0D14',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.forward.erp',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0D14',
    },
    package: 'com.forward.erp',
    // Audit tranche 1, S3: no Android backup of the app data (MMKV, AsyncStorage) to Google or adb.
    allowBackup: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#1a6bff',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Forward ERP necesita acceso a la cámara para escanear productos.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Forward ERP necesita tu ubicación para registrar las entregas.',
        locationWhenInUsePermission:
          'Forward ERP usa tu ubicación para registrar las entregas y, mientras dura el viaje, para que la oficina vea por dónde va el camión.',
        // GPS del viaje: servicio con notificación. No hace falta ACCESS_BACKGROUND_LOCATION.
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        project: 'forward-mobile',
        organization: 'damian-bosatta'
      }
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    apiUrl: process.env.API_URL ?? 'http://10.0.2.2:5000',
    signalrUrl: process.env.SIGNALR_URL ?? 'http://10.0.2.2:5000/hubs/erp',
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
}

export default config
