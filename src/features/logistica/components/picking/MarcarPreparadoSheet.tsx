/**
 * MarcarPreparadoSheet — Bottom-sheet modal for confirming the "empacar" action.
 *
 * Shows a numeric input for cantidadBultos. Calls validateCantidadBultos before
 * submitting — blocks on 0/blank and shows an inline error message.
 * On valid input, calls usePickingEmpacarVenta({ ventaId, cantidadBultos, version }).
 *
 * Exports validateBultosForTest for jest unit tests (pure function).
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { Package, X, CheckCircle, Minus, Plus } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { useColors, useIsDark } from '@/libs/theme'
import { PremiumInput } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import { usePickingEmpacarVenta } from '@/libs/api-client/logistica'
import { validateCantidadBultos } from '@/src/features/logistica/lib/picking-board-logic'
import type { VentaPreparacion } from '@/libs/api-client/logistica'

// ─────────────────────────────────────────────────────────────────────────────
// Re-export the pure validator so tests can import from this module directly
// ─────────────────────────────────────────────────────────────────────────────

export { validateCantidadBultos as validateBultosForTest }

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface MarcarPreparadoSheetProps {
  visible: boolean
  venta: VentaPreparacion | null
  onClose: () => void
  onSuccess: () => void
  onError: (message: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MarcarPreparadoSheet({
  visible,
  venta,
  onClose,
  onSuccess,
  onError,
}: MarcarPreparadoSheetProps) {
  const colors = useColors()
  const isDark = useIsDark()

  const [bultosStr, setBultosStr] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const { mutateAsync: empacarVenta, isPending } = usePickingEmpacarVenta()

  // Reset state when sheet opens or venta changes
  useEffect(() => {
    if (visible) {
      setBultosStr('')
      setValidationError(null)
    }
  }, [visible, venta])

  const handleClose = () => {
    Keyboard.dismiss()
    onClose()
  }

  const handleSubmit = async () => {
    const error = validateCantidadBultos(bultosStr)
    if (error) {
      setValidationError(error)
      safeHaptics.notification('warning')
      return
    }

    if (!venta) return

    // Guard against a missing concurrency token. version === 0 is VALID; only
    // null/undefined means the venta shape lacked the token and Empacar would
    // fail optimistic-concurrency on the backend.
    if (venta.version == null) {
      safeHaptics.notification('error')
      onError(
        'No se pudo determinar la versión de la venta. Refrescá la lista e intentá de nuevo.',
      )
      return
    }

    const cantidadBultos = parseInt(bultosStr.trim(), 10)

    try {
      Keyboard.dismiss()
      await empacarVenta({
        ventaId: venta.id,
        cantidadBultos,
        version: venta.version,
      })
      safeHaptics.notification('success')
      onSuccess()
      onClose()
    } catch {
      safeHaptics.notification('error')
      onError('Error al marcar como preparado. Intente nuevamente.')
    }
  }

  const submitDisabled = isPending || bultosStr.trim() === ''

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: isDark ? '#111111' : colors.surface },
            ]}
            onPress={() => {}}
          >
            <BlurView
              intensity={isDark ? 20 : 50}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />

            {/* Handle */}
            <View
              style={[
                styles.handle,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : colors.border },
              ]}
            />

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primary + '18' }]}>
                <Package size={20} color={colors.primary} strokeWidth={2} />
              </View>

              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  Marcar como preparado
                </Text>
                {venta && (
                  <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                    {venta.clienteNombre}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleClose}
                hitSlop={12}
                accessibilityLabel="Cerrar"
                accessibilityRole="button"
              >
                <View
                  style={[
                    styles.closeBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : colors.border + '60',
                    },
                  ]}
                >
                  <X size={18} color={colors.textMuted} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.formContent}>
              <PremiumInput
                label="Cantidad de bultos"
                placeholder="Ej: 3"
                value={bultosStr}
                onChangeText={(t) => {
                  setBultosStr(t)
                  if (validationError) setValidationError(null)
                }}
                keyboardType="number-pad"
                autoFocus
              />

              {validationError ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {validationError}
                </Text>
              ) : null}

              {/* Quick-pick buttons — tap to set a common bultos count instantly */}
              <View style={styles.quickPickRow}>
                {([1, 2, 3, 5] as const).map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.quickPickBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bg,
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setBultosStr(String(n))
                      if (validationError) setValidationError(null)
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Cantidad ${n}`}
                  >
                    <Text style={[styles.quickPickLabel, { color: colors.text }]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Stepper — decrement floors at 1; increment is unbounded */}
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[
                    styles.stepperBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bg,
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const current = parseInt(bultosStr, 10) || 0
                    const next = Math.max(1, current - 1)
                    setBultosStr(String(next))
                    if (validationError) setValidationError(null)
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Restar un bulto"
                >
                  <Minus size={18} color={colors.text} strokeWidth={2.5} />
                </TouchableOpacity>

                <Text style={[styles.stepperValue, { color: colors.text }]}>
                  {bultosStr || '–'}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.stepperBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bg,
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const current = parseInt(bultosStr, 10) || 0
                    setBultosStr(String(current + 1))
                    if (validationError) setValidationError(null)
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Sumar un bulto"
                >
                  <Plus size={18} color={colors.text} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Ingresá la cantidad de bultos que contiene este pedido.
              </Text>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: submitDisabled
                      ? colors.primary + '50'
                      : colors.primary,
                  },
                ]}
                onPress={handleSubmit}
                disabled={submitDisabled}
                activeOpacity={0.8}
                accessibilityLabel="Confirmar empaque"
                accessibilityRole="button"
              >
                {isPending ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <CheckCircle size={18} color="#000" strokeWidth={2.5} />
                    <Text style={styles.submitLabel}>Confirmar empaque</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    minHeight: 280,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: -8,
    marginBottom: 4,
    marginLeft: 4,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 4,
    lineHeight: 17,
  },
  quickPickRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickPickBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPickLabel: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    minWidth: 40,
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
    color: '#000',
  },
})
