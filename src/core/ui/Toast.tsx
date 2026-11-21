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
import { MotiView, AnimatePresence, type MotiTransitionProp } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { radii, useColors, type ForwardColors, typeScale } from '@/libs/theme'
import { pesoSemibold } from './fw/tipografia'

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
  // Reduce Motion: sin desplazamiento, solo un fundido corto.
  const reducido = useReducedMotion()
  const desplazamiento = reducido ? 0 : -32

  return (
    <View
      style={[styles.hostContainer, { top: insets.top + 8 }]}
      pointerEvents="none"
    >
      <AnimatePresence>
        {toast !== null && (
          <MotiView
            key={toast.id}
            from={{ translateY: desplazamiento, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: desplazamiento, opacity: 0 }}
            transition={{ type: 'timing', duration: reducido ? 120 : 250 } as MotiTransitionProp}
            style={[
              styles.card,
              { backgroundColor: variantPaleta(toast.variant, colors).fondo },
            ]}
            // @ts-ignore — MotiView forwards these to the underlying View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <ToastIcon variant={toast.variant} color={variantPaleta(toast.variant, colors).texto} />
            <Text style={[styles.message, { color: variantPaleta(toast.variant, colors).texto }]} numberOfLines={2}>
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

function ToastIcon({ variant, color }: { variant: ToastVariant; color: string }) {
  const iconProps = { size: 20, strokeWidth: 2.5, color } as const
  if (variant === 'success') return <CheckCircle2 {...iconProps} />
  if (variant === 'error') return <AlertCircle {...iconProps} />
  return <Info {...iconProps} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Paleta
// ─────────────────────────────────────────────────────────────────────────────

/** Recetas FWD: éxito = teal con texto ink; error = `dangerFill` con `onState`; info = `surfaceAlt` con texto `text`. Sin borde ni sombra; el estado va escrito en el mensaje y en el ícono. */
function variantPaleta(variant: ToastVariant, colors: ForwardColors): { fondo: string; texto: string } {
  if (variant === 'success') return { fondo: colors.teal, texto: colors.ink }
  if (variant === 'error') return { fondo: colors.dangerFill, texto: colors.onState }
  return { fondo: colors.surfaceAlt, texto: colors.text }
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: radii.fila,
  },
  message: {
    flex: 1,
    ...typeScale.secundario,
    ...pesoSemibold,
  },
})
