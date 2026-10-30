import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { radii, space, typeScale, useColors, type ForwardColors } from '@/libs/theme'

export type ButtonVariant = 'primario' | 'secundario' | 'peligro'
/** `xl` es la escala de la consola del chofer: 72 de alto, texto 19 y borde de 2 px (se lee al sol, con una mano). */
export type ButtonSize = 'md' | 'xl'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ícono a la izquierda del texto (el estado nunca va solo en el color). */
  icon?: LucideIcon
  disabled?: boolean
  loading?: boolean
  accessibilityLabel?: string
  testID?: string
}

function paleta(c: ForwardColors, variant: ButtonVariant, inactivo: boolean, xl: boolean) {
  if (inactivo) return { fondo: c.surface2, texto: c.textSecondary, borde: c.surface2 }
  if (variant === 'peligro') return { fondo: c.dangerStrong, texto: c.onDangerStrong, borde: c.dangerStrong }
  if (variant === 'secundario') return { fondo: c.surface, texto: c.text, borde: xl ? c.textSecondary : c.border }
  return { fondo: c.action, texto: c.onAction, borde: c.action }
}

/** Botón de la lámina F4: alto 48, radio 10, texto 16/600. */
export function Button({
  label,
  onPress,
  variant = 'primario',
  size = 'md',
  icon: Icono,
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const colors = useColors()
  const inactivo = disabled || loading
  // Cargando conserva el color de la variante; solo deshabilitado se apaga.
  const xl = size === 'xl'
  const p = paleta(colors, variant, disabled, xl)

  return (
    <Pressable
      // Con `android_ripple`, Android conserva el fondo nativo viejo cuando el tema cambia en vivo: el texto se
      // repinta y el fondo no. Remontar cuando cambia el color lo corrige.
      key={p.fondo}
      testID={testID}
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactivo, busy: loading }}
      // Estilo fijo y no una función de `pressed`: con NativeWind 4 la función se pierde y el botón queda sin
      // fondo ni alto. El toque se marca con el ripple nativo.
      android_ripple={inactivo ? undefined : { color: p.borde }}
      style={{
        height: xl ? 72 : space[12],
        paddingHorizontal: space[5],
        borderRadius: xl ? radii.tarjeta : radii.campo,
        borderWidth: xl ? 2 : 1,
        borderColor: p.borde,
        backgroundColor: p.fondo,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {loading && <ActivityIndicator size="small" color={p.texto} />}
        {Icono ? <Icono size={xl ? 26 : 20} color={p.texto} strokeWidth={2.5} /> : null}
        <Text style={{ ...typeScale.cuerpoDestacado, ...(xl ? { fontSize: 19, lineHeight: 26 } : null), color: p.texto }}>{label}</Text>
      </View>
    </Pressable>
  )
}
