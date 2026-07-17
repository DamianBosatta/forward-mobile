import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { asyncStoragePersister } from '@/core/query/persistConfig'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { 
  Outfit_400Regular, 
  Outfit_500Medium, 
  Outfit_600SemiBold, 
  Outfit_700Bold, 
  Outfit_800ExtraBold, 
  Outfit_900Black 
} from '@expo-google-fonts/outfit'
import * as SplashScreen from 'expo-splash-screen'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { WifiOff } from 'lucide-react-native'
import { MotiView, AnimatePresence } from 'moti'
import '../global.css'
import { loadSavedApiUrl } from '@/core/api/client'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000,
      retry: 1,
    },
  },
})

function OfflineBanner() {
  const { isConnected } = useNetworkStatus()

  return (
    <AnimatePresence>
      {!isConnected && (
        <MotiView
          from={{ translateY: -100, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: -100, opacity: 0 }}
          style={styles.offlineBanner}
        >
          <WifiOff size={16} color="#fff" />
          <Text style={styles.offlineText}>Sin conexión - Modo lectura (Cache)</Text>
        </MotiView>
      )}
    </AnimatePresence>
  )
}

function AuthGuardHandler() {
  useAuthGuard()
  return null
}

function RootLayoutNav() {
  const isHydrated = useAuthStore(state => state.isHydrated)
  const [isApiUrlLoaded, setIsApiUrlLoaded] = useState(false)

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  })

  useEffect(() => {
    loadSavedApiUrl().finally(() => {
      setIsApiUrlLoaded(true)
    })
  }, [])

  useEffect(() => {
    if ((fontsLoaded || fontError) && isHydrated && isApiUrlLoaded) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError, isHydrated, isApiUrlLoaded])

  if (!isHydrated || (!fontsLoaded && !fontError) || !isApiUrlLoaded) {
    return null; // Prevent ActivityIndicator from unmounting Splash Screen prematurely
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AuthGuardHandler />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#000000' } }}>
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
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
          dehydrateOptions: {
            shouldDehydrateMutation: () => true,
            shouldDehydrateQuery: (query) => {
              if (query.state.status !== 'success') return false
              if (query.meta && query.meta.persist === false) return false
              const queryKey = query.queryKey as string[]
              const isHeavy = queryKey.includes('catalogoStock') || queryKey.includes('list')
              return !isHeavy
            }
          }
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

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 9999,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  }
})
