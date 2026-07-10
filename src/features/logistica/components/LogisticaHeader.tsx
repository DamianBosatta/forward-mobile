/**
 * LogisticaHeader.tsx — Shared header for Logística sub-screens.
 *
 * Visual parity with the picking.tsx / vehiculos.tsx header pattern, but the
 * left circle is a back button (ArrowLeft) instead of the ForwardLogo drawer
 * opener.  Pressing it pops the stack when possible; otherwise replaces to the
 * logística hub so the user is never left without a way back.
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors, useIsDark } from '@/libs/theme'
import { TopHeaderActions } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'

export interface LogisticaHeaderProps {
  title: string
  statusText?: string
  /** Content rendered below the header row (e.g. filter bars). */
  children?: ReactNode
  /** Overrides the default <TopHeaderActions /> on the right side. */
  right?: ReactNode
  /** Bottom padding of the BlurView wrapper. Default: 8. */
  paddingBottom?: number
}

export function LogisticaHeader({
  title,
  statusText,
  children,
  right,
  paddingBottom = 8,
}: LogisticaHeaderProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const handleBack = () => {
    safeHaptics.impact('light')
    // Drawer-based nav: router.back() pops the ROOT history and lands on the
    // main menu, not the logística hub. Navigate to the hub by name so the
    // destination is deterministic regardless of how the screen was reached.
    router.navigate('/(tabs)/logistica')
  }

  return (
    <View style={{ zIndex: 100 }}>
      <BlurView
        intensity={isDark ? 20 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={{ paddingTop: insets.top + 8, paddingBottom }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            hitSlop={8}
            style={[
              styles.brandCircle,
              { backgroundColor: isDark ? '#111' : colors.surface },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Volver al menú de logística"
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>
              {title}
            </Text>
            {statusText ? (
              <View style={styles.subtitleRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: colors.primary }]}
                />
                <Text style={[styles.statusText, { color: colors.primary }]}>
                  {statusText}
                </Text>
              </View>
            ) : null}
          </View>

          {right ?? <TopHeaderActions />}
        </View>

        {children}
      </BlurView>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — copied verbatim from picking.tsx StyleSheet for visual parity
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  brandCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.8,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
})
