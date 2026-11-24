import React, { useState } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { FONT, maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

interface FieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label: string
  help?: string
  error?: string
  /** Importes: cifras alineadas a la derecha. */
  alignRight?: boolean
  /** Con `secureTextEntry`: agrega el ojo para ver u ocultar el texto (lámina perfil--clave). */
  verOcultar?: boolean
  /** Palabra en rojo junto a la etiqueta ("obligatorio"): el rojo nunca va solo. */
  labelSuffix?: string
  /** Borde rojo sin mensaje debajo (el motivo ya está en `labelSuffix`). */
  invalid?: boolean
  /** Signo fijo a la izquierda del texto ("$" en los importes de las láminas de Tesorería). Sin él, el campo es el de siempre. */
  prefijo?: string
}

// Spec FWD §3: etiqueta 13-14 / 700 en `textMuted`; el texto tipeado 16 / 700.
const ALTO = 56
const etiqueta = { ...typeScale.secundario, fontFamily: FONT.bold, fontWeight: '700' as const }
const tipeado = { ...typeScale.cuerpo, fontFamily: FONT.bold, fontWeight: '700' as const }

/** Campo FWD: alto 56, radio de fila, relleno gris suave (surface2, P10) sin contorno; foco = borde `text` de 2 px y error en rojo. */
export function Field({ label, help, error, alignRight, verOcultar, labelSuffix, invalid, prefijo, secureTextEntry, onFocus, onBlur, ...input }: FieldProps) {
  const colors = useColors()
  const [foco, setFoco] = useState(false)
  const colorError = colors.chip.anulado.text
  const [visible, setVisible] = useState(false)
    const ojo = !!verOcultar && !!secureTextEntry

  return (
    <View style={{ gap: space[1] }}>
      <Text style={{ ...etiqueta, color: colors.textMuted }}>
        {label}
        {labelSuffix ? <Text style={{ color: colorError }}>{` ${labelSuffix}`}</Text> : null}
      </Text>
      <View>
      <TextInput
        {...input}
        secureTextEntry={ojo ? !visible : secureTextEntry}
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
        maxFontSizeMultiplier={maxFontScale}
        style={{
          ...tipeado,
          height: ALTO,
          borderRadius: radii.fila,
          borderWidth: 2,
          borderColor: error || invalid ? colorError : foco ? colors.text : 'transparent',
          backgroundColor: colors.surface2,
          paddingHorizontal: space[4],
          paddingLeft: prefijo ? space[8] : space[4],
          paddingRight: ojo ? space[12] : space[4],
          paddingVertical: 0,
          color: colors.text,
          textAlign: alignRight ? 'right' : 'left',
        }}
      />
      {prefijo ? (
        <Text
          importantForAccessibility="no"
          pointerEvents="none"
          maxFontSizeMultiplier={maxFontScale}
          style={{ ...typeScale.cuerpoDestacado, position: 'absolute', left: space[4], top: 0, height: ALTO, lineHeight: ALTO, color: colors.textSecondary }}
        >
          {prefijo}
        </Text>
      ) : null}
      {ojo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          onPress={() => setVisible((v) => !v)}
          style={{ position: 'absolute', right: 0, top: 0, width: space[12], height: ALTO, alignItems: 'center', justifyContent: 'center' }}
        >
          {visible ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
        </Pressable>
      ) : null}
      </View>
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
