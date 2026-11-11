import React, { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { importe, maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

/** Cifra del monto grande (v2): fuera de la escala de 6 pasos a propósito, como la cifra de los heroes. */
const CIFRA = { fontSize: 28, lineHeight: 36 } as const

interface Props {
  value: string
  onChangeText: (texto: string) => void
  /** Rótulo visible y lo que oye el lector. */
  label?: string
}

/**
 * Monto como cifra grande con "$" (propuesta "Finanzas como venta", frames 10, 11, 14 y 15; v2): un campo de 64 px
 * con borde de marca cuando tiene valor o foco. Mismo texto libre que el campo de siempre: lo lee `leerNumero`.
 */
export function MontoGrande({ value, onChangeText, label = 'Monto' }: Props) {
  const c = useColors()
  const [foco, setFoco] = useState(false)
  const marcado = foco || value.trim().length > 0
  return (
    <View style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.text }}>{label}</Text>
      <View
        testID="monto-grande"
        style={{
          height: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingHorizontal: space[4],
          borderRadius: radii.campo,
          borderWidth: 2,
          borderColor: marcado ? c.brand : c.border,
          backgroundColor: c.surface,
        }}
      >
        <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.titulo, CIFRA, { color: c.textSecondary }]}>$</Text>
        <TextInput
          accessibilityLabel={label}
          maxFontSizeMultiplier={maxFontScale}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={c.textSecondary}
          style={[typeScale.titulo, CIFRA, importe, { flex: 1, color: c.text, textAlign: 'right', paddingVertical: 0 }]}
        />
      </View>
    </View>
  )
}
