import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { maxFontScale, space, typeScale, useColors } from '@/libs/theme'

interface MarcaProps {
  marcada: boolean
  /** Sin tildar y con algo por corregir: el borde pasa a rojo (el motivo va en texto aparte). */
  error?: boolean
  /** Lado de la caja: 24 en listas y filtros, 36 en la consola del chofer. */
  tamano?: 24 | 36
  /** Sobre una fila teal (consola del chofer): la marca se invierte, caja `ink` con tilde teal. */
  sobreTeal?: boolean
}

/** Caja de la casilla sin comportamiento: para filas que ya son un solo `Pressable` con rol checkbox. */
export function MarcaDeCasilla({ marcada, error = false, tamano = 24, sobreTeal = false }: MarcaProps) {
  const c = useColors()
  const relleno = sobreTeal ? c.ink : c.teal
  return (
    <View
      testID="casilla-caja"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano === 36 ? 12 : 8,
        borderWidth: tamano === 36 ? 3 : 2,
        borderColor: marcada ? relleno : error ? c.chip.anulado.text : c.borderStrong,
        backgroundColor: marcada ? relleno : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {marcada ? <Check size={tamano === 36 ? 22 : 14} color={sobreTeal ? c.teal : c.ink} strokeWidth={3} /> : null}
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

/** Casilla de 44 pt de alto: borde de 2 px (3 en la de 36) `borderStrong`; tildada = relleno teal con tilde `ink` (sobre fila teal, al revés), nunca solo color. */
export function Casilla({ label, marcada, onPress, accessibilityLabel, detalle, error, tamano, sobreTeal }: CasillaProps) {
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
      <MarcaDeCasilla marcada={marcada} error={error} tamano={tamano} sobreTeal={sobreTeal} />
      <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={[typeScale.cuerpo, { flex: 1, color: c.text }]}>{label}</Text>
      {detalle}
    </Pressable>
  )
}
