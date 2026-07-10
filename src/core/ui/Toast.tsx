/**
 * Toast — ephemeral notification system.
 *
 * Mount <ToastProvider> in _layout.tsx (inside SafeAreaProvider).
 * Call useToast().show('message', 'success' | 'error' | 'info') from any descendant.
 *
 * Auto-dismisses after 2 500 ms. Each call cancels any in-flight timer so rapid
 * successive calls do not stack — only the latest toast is shown.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MotiView, AnimatePresence } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native'
import { useColors, type ForwardColors } from '@/libs/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastEntry {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

/** Call from any component inside <ToastProvider> to trigger a toast. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be called inside a <ToastProvider>')
  return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastEntry | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    setToast({ id: Date.now(), message, variant })
    timerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastHost toast={toast} />
    </ToastContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Host — internal, renders the animated card above all content
// ─────────────────────────────────────────────────────────────────────────────

function ToastHost({ toast }: { toast: ToastEntry | null }) {
  const insets = useSafeAreaInsets()
  const colors = useColors()

  return (
    <View
      style={[styles.hostContainer, { top: insets.top + 8 }]}
      pointerEvents="none"
    >
      <AnimatePresence>
        {toast !== null && (
          <MotiView
            key={toast.id}
            from={{ translateY: -32, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: -32, opacity: 0 }}
            transition={{ type: 'timing', duration: 250 }}
            style={[
              styles.card,
              {
                backgroundColor: variantBg(toast.variant, colors),
                borderColor: variantBorder(toast.variant, colors),
              },
            ]}
            // @ts-ignore — MotiView forwards these to the underlying View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <ToastIcon variant={toast.variant} colors={colors} />
            <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
              {toast.message}
            </Text>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon
// ─────────────────────────────────────────────────────────────────────────────

function ToastIcon({ variant, colors }: { variant: ToastVariant; colors: ForwardColors }) {
  const iconProps = { size: 18, strokeWidth: 2 } as const
  if (variant === 'success') return <CheckCircle2 {...iconProps} color={colors.success} />
  if (variant === 'error') return <AlertCircle {...iconProps} color={colors.danger} />
  return <Info {...iconProps} color={colors.info} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────────────────────────────────────

function variantAccent(variant: ToastVariant, colors: ForwardColors): string {
  if (variant === 'success') return colors.success
  if (variant === 'error') return colors.danger
  return colors.info
}

function variantBg(variant: ToastVariant, colors: ForwardColors): string {
  return variantAccent(variant, colors) + '18' // ~10 % opacity
}

function variantBorder(variant: ToastVariant, colors: ForwardColors): string {
  return variantAccent(variant, colors) + '40' // ~25 % opacity
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hostContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    lineHeight: 20,
  },
})
