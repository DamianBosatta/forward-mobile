import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Pressable } from './Pressable'
import { radii, space, typeScale, useColors, type ForwardColors } from '@/libs/theme'

export type ButtonVariant = 'primario' | 'secundario' | 'peligro'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  accessibilityLabel?: string
  testID?: string
}

function paleta(c: ForwardColors, variant: ButtonVariant, inactivo: boolean) {
  if (inactivo) return { fondo: c.surface2, texto: c.textSecondary, borde: c.surface2 }
  if (variant === 'peligro') return { fondo: c.dangerStrong, texto: c.onDangerStrong, borde: c.dangerStrong }
  if (variant === 'secundario') return { fondo: c.surface, texto: c.text, borde: c.border }
  return { fondo: c.action, texto: c.onAction, borde: c.action }
}

/** Botón de la lámina F4: alto 48, radio 10, texto 16/600. */
export function Button({
  label,
  onPress,
  variant = 'primario',
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const colors = useColors()
  const inactivo = disabled || loading
  // Cargando conserva el color de la variante; solo deshabilitado se apaga.
  const p = paleta(colors, variant, disabled)

  return (
    <Pressable
      testID={testID}
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactivo, busy: loading }}
      style={({ pressed }) => ({
        height: space[12],
        paddingHorizontal: space[5],
        borderRadius: radii.campo,
        borderWidth: 1,
        borderColor: p.borde,
        backgroundColor: p.fondo,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed && !inactivo ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {loading && <ActivityIndicator size="small" color={p.texto} />}
        <Text style={{ ...typeScale.cuerpoDestacado, color: p.texto }}>{label}</Text>
      </View>
    </Pressable>
  )
}
