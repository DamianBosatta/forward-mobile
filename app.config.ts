import { type ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Forward ERP',
  slug: 'forward-erp',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'forward',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
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
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
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
      projectId: '058596a1-a678-4d5a-917e-79f3a93abc67',
    },
  },
}

export default config
