import React from 'react'
import {
  Modal, View, Text, Pressable,
  Dimensions, StyleSheet, ActivityIndicator
} from 'react-native'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react-native'
import { useColors, useIsDark, maxFontScale, radii, shadowMd, space, typeScale } from '@/libs/theme'

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

/** Ícono, acento y botón de confirmar de cada variante, todo con colores del tema. */
function useVariant(variant: ConfirmVariant, colors: ReturnType<typeof useColors>) {
  switch (variant) {
    case 'success':
      return { Icon: CheckCircle2, color: colors.success, boton: colors.success, textoBoton: colors.onAction }
    case 'warning':
      return { Icon: AlertTriangle, color: colors.warning, boton: colors.warning, textoBoton: colors.onAction }
    case 'info':
      return { Icon: Info, color: colors.info, boton: colors.info, textoBoton: colors.onAction }
    case 'primary':
      return { Icon: Info, color: colors.primary, boton: colors.primary, textoBoton: colors.onPrimary }
    case 'danger':
    default:
      return { Icon: AlertTriangle, color: colors.danger, boton: colors.dangerStrong, textoBoton: colors.onDangerStrong }
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
  const { Icon, color: accentColor, boton, textoBoton } = useVariant(variant, colors)

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
          backgroundColor: colors.veil,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space[6],
        }}
      >
          {/* Card */}
          <View
            style={{
              width: '100%',
              backgroundColor: colors.surface,
              borderRadius: radii.hoja,
              padding: space[6],
              borderWidth: 1,
              borderColor: colors.border,
              ...(isDark ? shadowMd.dark : shadowMd.light),
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
              ...typeScale.seccion,
              color: colors.text,
              textAlign: 'center',
              marginBottom: space[2],
            }}>
              {title}
            </Text>

            {message && (
              <Text style={{
                ...typeScale.secundario,
                color: colors.textMuted,
                textAlign: 'center',
                marginBottom: space[6],
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
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  <Text style={{ ...typeScale.etiqueta, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }} maxFontSizeMultiplier={maxFontScale}>
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
                    backgroundColor: boton,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color={textoBoton} size="small" />
                  ) : (
                    <Text style={{ ...typeScale.etiqueta, color: textoBoton, letterSpacing: 0.5, textTransform: 'uppercase' }} maxFontSizeMultiplier={maxFontScale}>
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
