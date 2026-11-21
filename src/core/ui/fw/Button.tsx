import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors, useIsDark, type ForwardColors } from '@/libs/theme'
import { PressableFx } from './PressableFx'

/**
 * `listo`: la acción que cierra un trabajo terminado (teal con texto ink, spec FWD §5). `peligroContorno`:
 * destructivo que no compite con nada, con el texto en rojo; el sólido queda para confirmar. `peligroContornoNeutro`: el mismo contorno
 * de peligro pero con el texto normal (decisión del dueño: "Cerrar sesión" en texto normal).
 */
export type ButtonVariant = 'primario' | 'secundario' | 'peligro' | 'peligroContorno' | 'peligroContornoNeutro' | 'listo'
/**
 * `md` 48 (el alto de siempre, filas y diálogos), `lg` 64 (el botón principal de ancho completo del pie, spec FWD §4)
 * y `xl` 72 con texto 19 (la consola del chofer: se lee al sol, con una mano).
 */
export type ButtonSize = 'md' | 'lg' | 'xl'
const ALTO: Record<ButtonSize, number> = { md: 48, lg: 64, xl: 72 }

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ícono a la izquierda del texto (el estado nunca va solo en el color). */
  icon?: LucideIcon
  /** Ícono a la derecha del texto (p. ej. un chevron en "Continuar"). */
  iconoFinal?: LucideIcon
  disabled?: boolean
  loading?: boolean
  accessibilityLabel?: string
  testID?: string
}

/** Spec FWD §5: píldora sin borde; el contorno solo lo lleva el destructivo suave. `ondas`: color del ripple. */
function paleta(c: ForwardColors, variant: ButtonVariant, inactivo: boolean) {
  if (inactivo) return { fondo: c.surfaceAlt, texto: c.textMuted, borde: null, ondas: c.border }
  if (variant === 'peligro') return { fondo: c.dangerFill, texto: c.onState, borde: null, ondas: c.ink }
  if (variant === 'peligroContorno') return { fondo: c.surface, texto: c.chip.anulado.text, borde: c.chip.anulado.text, ondas: c.border }
  if (variant === 'peligroContornoNeutro') return { fondo: 'transparent', texto: c.text, borde: c.dangerFill, ondas: c.surfaceAlt }
  if (variant === 'secundario') return { fondo: c.surface, texto: c.text, borde: null, ondas: c.surfaceAlt }
  if (variant === 'listo') return { fondo: c.teal, texto: c.ink, borde: null, ondas: c.ink }
  return { fondo: c.primaryBg, texto: c.primaryFg, borde: null, ondas: c.primaryFg }
}

/** Botón FWD: píldora de 48 de alto (`lg` 64, `xl` 72), texto 800. Presionado: escala 0.95 (PressableFx). */
export function Button({
  label,
  onPress,
  variant = 'primario',
  size = 'md',
  icon: Icono,
  iconoFinal: IconoFinal,
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const colors = useColors()
  const oscuro = useIsDark()
  const inactivo = disabled || loading
  // Cargando conserva el color de la variante; solo deshabilitado se apaga.
  const xl = size === 'xl'
  const p = paleta(colors, variant, disabled)

  return (
    <PressableFx
      // Con `android_ripple`, Android conserva el fondo nativo viejo cuando el tema cambia en vivo: el texto se
      // repinta y el fondo no. Remontar cuando cambia el tema lo corrige.
      key={oscuro ? 'oscuro' : 'claro'}
      testID={testID}
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactivo, busy: loading }}
      // Estilo fijo y no una función de `pressed`: con NativeWind 4 la función se pierde y el botón queda sin
      // fondo ni alto. El toque se marca con el ripple nativo.
      android_ripple={inactivo ? undefined : { color: p.ondas }}
      style={{
        height: ALTO[size],
        paddingHorizontal: space[6],
        borderRadius: radii.pastilla,
        ...(p.borde ? { borderWidth: 2, borderColor: p.borde } : null),
        backgroundColor: p.fondo,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {loading && <ActivityIndicator size="small" color={p.texto} />}
        {Icono ? <Icono size={xl ? 26 : 20} color={p.texto} strokeWidth={2.5} /> : null}
        <Text maxFontSizeMultiplier={maxFontScale} style={{ ...(xl ? typeScale.seccionGrande : typeScale.cuerpoDestacado), color: p.texto }}>{label}</Text>
        {IconoFinal ? <IconoFinal testID="icono-final" size={xl ? 26 : 20} color={p.texto} strokeWidth={2.5} /> : null}
      </View>
    </PressableFx>
  )
}
