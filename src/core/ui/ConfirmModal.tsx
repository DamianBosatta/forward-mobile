import React from 'react'
import {
  Modal, View, Text, Pressable,
  Dimensions, StyleSheet, ActivityIndicator
} from 'react-native'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react-native'
import { useColors, useIsDark, BRAND } from '@/libs/theme'

// ─── tipos ────────────────────────────────────────────────────────────────────

export type ConfirmVariant = 'danger' | 'success' | 'info' | 'warning' | 'primary'

interface ConfirmModalProps {
  visible: boolean
  title: string
  message?: string
  variant?: ConfirmVariant
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
  footer?: React.ReactNode
  hideButtons?: boolean
  loading?: boolean
}

// ─── config por variante ──────────────────────────────────────────────────────

function useVariant(variant: ConfirmVariant, colors: ReturnType<typeof useColors>) {
  switch (variant) {
    case 'success':
      return { Icon: CheckCircle2, color: BRAND.blue }
    case 'warning':
      return { Icon: AlertTriangle, color: colors.warning }
    case 'info':
      return { Icon: Info, color: colors.info }
    case 'primary':
      return { Icon: Info, color: colors.primary }
    case 'danger':
    default:
      return { Icon: AlertTriangle, color: colors.danger }
  }
}

// ─── componente ───────────────────────────────────────────────────────────────

export function ConfirmModal({
  visible,
  title,
  message,
  variant = 'danger',
  confirmLabel = 'Confirmar',
  cancelLabel,
  onConfirm,
  onCancel,
  children,
  footer,
  hideButtons = false,
  loading = false,
}: ConfirmModalProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const { Icon, color: accentColor } = useVariant(variant, colors)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.48)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
          {/* Card */}
          <View
            style={{
              width: '100%',
              backgroundColor: isDark ? '#121212' : '#ffffff',
              borderRadius: 32,
              padding: 24,
              borderWidth: 1,
              borderColor: isDark ? '#FFFFFF10' : '#00000005',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 24 },
              shadowOpacity: 0.5,
              shadowRadius: 40,
              elevation: 28,
            }}
          >
            {/* Ícono */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 22,
                backgroundColor: accentColor + '15',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: accentColor + '20'
              }}>
                <Icon size={28} color={accentColor} strokeWidth={2.5} />
              </View>
            </View>

            {/* Textos */}
            <Text style={{
              fontSize: 18, fontWeight: '900',
              color: colors.text,
              textAlign: 'center',
              letterSpacing: -0.5,
              marginBottom: 8,
            }}>
              {title}
            </Text>

            {message && (
              <Text style={{
                fontSize: 13, fontWeight: '500',
                color: colors.textMuted,
                textAlign: 'center',
                lineHeight: 18,
                marginBottom: 24,
              }}>
                {message}
              </Text>
            )}

            {/* Custom Content */}
            {children && (
              <View style={{ marginBottom: 24 }}>
                {children}
              </View>
            )}

            {/* Botones */}
            {footer ? footer : !hideButtons && (
              <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
                <Pressable
                  onPress={onCancel}
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: isDark ? '#FFFFFF08' : '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: '900', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }} maxFontSizeMultiplier={1.3}>
                    {cancelLabel || 'Cancelar'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onConfirm}
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: accentColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: accentColor,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={{ color: variant === 'success' || variant === 'primary' || variant === 'danger' ? '#fff' : '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }} maxFontSizeMultiplier={1.3}>
                      {confirmLabel}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
    </Modal>
  )
}
