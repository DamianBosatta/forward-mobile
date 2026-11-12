import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

interface MarcaProps {
  marcada: boolean
  /** Sin tildar y con algo por corregir: el borde pasa a rojo (el motivo va en texto aparte). */
  error?: boolean
  /** Lado de la caja: 24 en listas y filtros, 36 en la consola del chofer. */
  tamano?: 24 | 36
}

/** Caja de la casilla sin comportamiento: para filas que ya son un solo `Pressable` con rol checkbox. */
export function MarcaDeCasilla({ marcada, error = false, tamano = 24 }: MarcaProps) {
  const c = useColors()
  return (
    <View
      testID="casilla-caja"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamano,
        height: tamano,
        borderRadius: radii.campo / 2,
        borderWidth: 2,
        borderColor: marcada ? c.brandInk : error ? c.chip.anulado.text : c.borderStrong,
        backgroundColor: marcada ? c.brandInk : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {marcada ? <Check size={tamano === 36 ? 22 : 14} color={c.onPrimary} strokeWidth={3} /> : null}
    </View>
  )
}

interface CasillaProps extends MarcaProps {
  label: string
  onPress: () => void
  /** Texto accesible si difiere de `label` (p. ej. con el conteo: "Sin stock, 34"). */
  accessibilityLabel?: string
  /** Dato a la derecha de la etiqueta (un conteo). */
  detalle?: React.ReactNode
}

/** Casilla de 44 pt de alto: borde de 2 px `borderStrong`; tildada = relleno `brandInk` con check, nunca solo color. */
export function Casilla({ label, marcada, onPress, accessibilityLabel, detalle, error, tamano }: CasillaProps) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: marcada }}
      onPress={onPress}
      android_ripple={{ color: c.border }}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[3] }}
    >
      <MarcaDeCasilla marcada={marcada} error={error} tamano={tamano} />
      <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={[typeScale.cuerpo, { flex: 1, color: c.text }]}>{label}</Text>
      {detalle}
    </Pressable>
  )
}
