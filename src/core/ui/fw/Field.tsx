import React, { useState } from 'react'
import { Text, TextInput, View, type TextInputProps } from 'react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'

interface FieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label: string
  help?: string
  error?: string
  /** Importes: cifras alineadas a la derecha. */
  alignRight?: boolean
}

const etiqueta = { ...typeScale.secundario, fontFamily: FONT.semibold, fontWeight: '600' as const }

/** Campo de la lámina F4: etiqueta 14/600, alto 48, relleno superficie-2, foco con la marca y error en rojo. */
export function Field({ label, help, error, alignRight, onFocus, onBlur, ...input }: FieldProps) {
  const colors = useColors()
  const [foco, setFoco] = useState(false)
  const colorError = colors.chip.anulado.text
  const conMarca = foco || !!error

  return (
    <View style={{ gap: space[1] }}>
      <Text style={{ ...etiqueta, color: colors.text }}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={error ?? help}
        onFocus={(e) => {
          setFoco(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFoco(false)
          onBlur?.(e)
        }}
        placeholderTextColor={colors.textSecondary}
        style={{
          ...typeScale.cuerpo,
          height: space[12],
          borderRadius: radii.campo,
          borderWidth: conMarca ? 2 : 1,
          borderColor: error ? colorError : foco ? colors.brand : colors.border,
          backgroundColor: conMarca ? colors.surface : colors.surface2,
          paddingHorizontal: space[3] - (conMarca ? 1 : 0),
          paddingVertical: 0,
          color: colors.text,
          textAlign: alignRight ? 'right' : 'left',
        }}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ ...typeScale.secundario, color: colorError }}
        >
          {error}
        </Text>
      ) : help ? (
        <Text style={{ ...typeScale.secundario, color: colors.textSecondary }}>{help}</Text>
      ) : null}
    </View>
  )
}
