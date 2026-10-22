import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Grupo de opciones excluyentes (una por renglón, 48 de alto): condición de IVA, condición de pago. */
export function OpcionesRadio<T extends string>({ titulo, opciones, valor, onChange }: {
  titulo: string; opciones: { value: T; label: string }[]; valor: T; onChange: (v: T) => void
}) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.text }}>{titulo}</Text>
      {opciones.map(op => {
        const elegido = op.value === valor
        return (
          <Pressable
            key={op.value}
            accessibilityRole="radio"
            accessibilityLabel={op.label}
            accessibilityState={{ checked: elegido, selected: elegido }}
            onPress={() => onChange(op.value)}
            style={{
              minHeight: 48, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radii.campo,
              borderWidth: elegido ? 2 : 1, borderColor: elegido ? c.brand : c.border,
              backgroundColor: elegido ? c.brandSoft : c.surface,
            }}
          >
            <Text style={{ ...(elegido ? typeScale.cuerpoDestacado : typeScale.cuerpo), color: c.text }}>{op.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
