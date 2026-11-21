import React, { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { importe, maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

interface Props {
  value: string
  onChangeText: (texto: string) => void
  /** Rótulo visible y lo que oye el lector. */
  label?: string
}

/**
 * Monto como bloque grande (FWD, `.amount`): tarjeta de radio 30 sobre `surface`, rótulo arriba y la cifra
 * protagonista con "$". El foco lo marca un contorno de 2 pt en `text`, no solo el color. Mismo texto libre que
 * el campo de siempre: lo lee `leerNumero`.
 */
export function MontoGrande({ value, onChangeText, label = 'Monto' }: Props) {
  const c = useColors()
  const [foco, setFoco] = useState(false)
  return (
    <View
      testID="monto-grande"
      style={{
        minHeight: 96,
        paddingHorizontal: space[5],
        paddingTop: space[4],
        paddingBottom: space[5],
        gap: space[2],
        borderRadius: radii.tarjetaGrande,
        borderWidth: 2,
        borderColor: foco ? c.text : 'transparent',
        backgroundColor: c.surface,
      }}
    >
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.numeroProtagonista, { color: c.textMuted }]}>$</Text>
        <TextInput
          accessibilityLabel={label}
          maxFontSizeMultiplier={maxFontScale}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={c.textMuted}
          style={[typeScale.numeroProtagonista, importe, { flex: 1, color: c.text, textAlign: 'right', paddingVertical: 0 }]}
        />
      </View>
    </View>
  )
}
