import React from 'react'
import { Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { PressableFx } from './PressableFx'

export interface DrawerItemProps {
  label: string
  /** Sin ícono (p. ej. "Cerrar sesión"). */
  icon?: LucideIcon
  onPress: () => void
  /** Pantalla actual: píldora lime con texto ink (la única pieza lime del menú). */
  activa?: boolean
  /** Texto chico a la derecha (p. ej. "Solo ver"). */
  hint?: string
  /** Fila desplegada de un grupo: va sobre `surface` e ícono de 20. */
  hija?: boolean
  /** Menú fijo de tablet: panel oscuro, la activa en color de acción y sin ícono. */
  oscuro?: boolean
  /** Reemplaza el `accessibilityLabel` (por defecto, el rótulo). */
  accessibilityLabel?: string
  /** Contenido a la derecha del rótulo (p. ej. el chevron de un grupo). */
  derecha?: React.ReactNode
  /** Si es un grupo desplegable: se anuncia como expandido o plegado. */
  expandida?: boolean
  fondo?: string
}

/** Fila del menú lateral (FWD, lote drawer): 44 de alto, radio 22, activa en píldora lime con texto ink. */
export function DrawerItem({ label, icon: Icono, onPress, activa = false, hint, hija = false, oscuro = false, accessibilityLabel, derecha, expandida, fondo }: DrawerItemProps) {
  const c = useColors()
  const color = activa ? (oscuro ? c.onAction : c.ink) : oscuro ? c.onPanelOscuroStrong : c.text
  const aux = activa ? color : oscuro ? c.onPanelOscuro : c.textMuted
  const fondoFila = activa ? (oscuro ? c.action : c.lime) : (fondo ?? (hija ? c.surface : 'transparent'))
  return (
    <PressableFx
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: activa, ...(expandida === undefined ? null : { expanded: expandida }) }}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[3],
        borderRadius: radii.fila,
        backgroundColor: fondoFila,
      }}
    >
      {oscuro || !Icono ? null : <Icono size={hija ? 20 : 22} color={color} strokeWidth={2} />}
      <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.textoFila, color, flex: 1 }}>
        {label}
      </Text>
      {hint ? <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.secundario, color: aux }}>{hint}</Text> : null}
      {derecha ? <View>{derecha}</View> : null}
    </PressableFx>
  )
}
