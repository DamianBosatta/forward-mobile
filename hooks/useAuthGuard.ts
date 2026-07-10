import { useEffect } from 'react'
import { useRouter, useSegments, useRootNavigationState } from 'expo-router'
import { useAuthStore } from '@/libs/store/auth.store'
import { configureApiClient } from '@/core/api/client'
import { useAuth } from '@/features/auth/hooks/useAuth'

/**
 * Auth Guard Hook
 * - Configures the API client with full refresh token support
 * - Redirects to /login when not authenticated
 * - Redirects to /(tabs) if authenticated user lands on login
 *
 * Note: Now relies on RootLayout waiting for isHydrated, so no setTimeout needed.
 */
export function useAuthGuard() {
  const router = useRouter()
  const segments = useSegments()
  const rootNavigationState = useRootNavigationState()
  const { isAuthenticated, isHydrated, accessToken, logout } = useAuthStore()
  const { refreshPermissions } = useAuth()

  // 1. API Client Configuration
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      configureApiClient({
        getToken: () => useAuthStore.getState().accessToken,
        getRefreshToken: () => useAuthStore.getState().refreshToken,
        onTokensRefreshed: (tokens) => {
          useAuthStore.getState().setTokens(tokens)
        },
        onUnauthorized: () => {
          useAuthStore.getState().logout()
        },
      })

      // Background refresh of permissions
      refreshPermissions().catch(err =>
        console.error("[useAuthGuard] Error refreshing permissions on boot:", err)
      )
    }
  }, [isAuthenticated, accessToken, refreshPermissions])

  // 2. Navigation Logic
  useEffect(() => {
    // Only run if store is ready and navigation is mounted
    if (!isHydrated || !rootNavigationState?.key) return

    const inLoginScreen = segments[0] === 'login'
    const hasValidSession = isAuthenticated && !!accessToken

    if (!hasValidSession && !inLoginScreen) {
      // Force cleanup if state is inconsistent
      if (isAuthenticated) logout()

      // Navigate to login
      router.replace('/login')
    } else if (hasValidSession && inLoginScreen) {
      // Already logged in, go to dashboard
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, accessToken, isHydrated, segments, rootNavigationState?.key])
}
