import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { asyncStoragePersister } from '@/core/query/persistConfig'
import { crearQueryClient, opcionesDePersistencia } from '@/core/query/queryClient'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { vaciarCacheAlCerrarSesion } from '@/features/auth/lib/vaciarCacheAlCerrarSesion'
import { View } from 'react-native'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter'
import { colorScheme } from 'nativewind'
import { useColors, useIsDark, useThemeStore } from '@/libs/theme'
import * as SplashScreen from 'expo-splash-screen'
import { OfflineBanner } from '@/core/ui/OfflineBanner'
import '../global.css'
import { loadSavedApiUrl } from '@/core/api/client'
import { AvisosAlVolver, PushDeAvisos } from '@/features/notificaciones'
import { EnvioVentasSinSenal } from '@/features/venta-sin-senal'
import { EnvioConsolaSinSenal } from '@/features/logistica/cola'

SplashScreen.preventAutoHideAsync()

const queryClient = crearQueryClient()
vaciarCacheAlCerrarSesion(queryClient, asyncStoragePersister)

function AuthGuardHandler() {
  useAuthGuard()
  return null
}

function RootLayoutNav() {
  const isHydrated = useAuthStore(state => state.isHydrated)
  const [isApiUrlLoaded, setIsApiUrlLoaded] = useState(false)
  // El tema elegido en "Mi cuenta" vive en SecureStore: se lee antes de pintar
  // para no mostrar un frame con "Como el teléfono" si el usuario eligió otro.
  const isThemeHydrated = useThemeStore(state => state.isHydrated)
  useEffect(() => {
    useThemeStore.getState().hydrate()
  }, [])

  // Inter sola (plan §7). Los nombres Outfit_* son legados: las pantallas viejas
  // los referencian, así que se registran apuntando a los archivos de Inter.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    Outfit_400Regular: Inter_400Regular,
    Outfit_500Medium: Inter_500Medium,
    Outfit_600SemiBold: Inter_600SemiBold,
    Outfit_700Bold: Inter_700Bold,
    Outfit_800ExtraBold: Inter_800ExtraBold,
    Outfit_900Black: Inter_900Black,
  })
  const colors = useColors()
  const isDark = useIsDark()
  const modoTema = useThemeStore((state) => state.mode)

  // NativeWind aplica las variables de .dark (global.css) según su propio esquema. Con un modo fijo se
  // sincroniza con el del store. Con "Como el teléfono" se le pasa 'system': fijarle 'dark' o 'light'
  // congela el esquema de la app y un cambio del teléfono con la app abierta no la repinta hasta reiniciar.
  useEffect(() => {
    colorScheme.set(modoTema === 'system' ? 'system' : isDark ? 'dark' : 'light')
  }, [modoTema, isDark])

  useEffect(() => {
    loadSavedApiUrl().finally(() => {
      setIsApiUrlLoaded(true)
    })
  }, [])

  useEffect(() => {
    if ((fontsLoaded || fontError) && isHydrated && isThemeHydrated && isApiUrlLoaded) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError, isHydrated, isThemeHydrated, isApiUrlLoaded])

  if (!isHydrated || !isThemeHydrated || (!fontsLoaded && !fontError) || !isApiUrlLoaded) {
    return null; // Prevent ActivityIndicator from unmounting Splash Screen prematurely
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGuardHandler />
      <AvisosAlVolver />
      <PushDeAvisos />
      <EnvioVentasSinSenal />
      <EnvioConsolaSinSenal />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
      <OfflineBanner />
    </View>
  )
}

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { GlobalErrorBoundary, ToastProvider } from '@/core/ui'

export function ErrorBoundary(props: any) {
  return <GlobalErrorBoundary {...props} />
}

import * as Sentry from '@sentry/react-native'

Sentry.init({
  // Set per build profile in eas.json. Absent in local dev, which disables Sentry.
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Separates dev/preview/production traffic inside the same Sentry project.
  environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  // Performance tracing: sample 10% of transactions to get perf data without
  // overwhelming the Sentry quota. Defaults to 0 (no perf) when omitted.
  tracesSampleRate: 0.1,
})

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider 
        client={queryClient} 
        persistOptions={{ 
          persister: asyncStoragePersister,
          dehydrateOptions: opcionesDePersistencia,
        }}
      >
        <SafeAreaProvider>
          <ToastProvider>
            <BottomSheetModalProvider>
              <RootLayoutNav />
            </BottomSheetModalProvider>
          </ToastProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  )
}

export default Sentry.wrap(RootLayout)
