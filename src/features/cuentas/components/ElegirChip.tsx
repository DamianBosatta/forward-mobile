import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

interface Props {
  titulo: string
  opciones: { id: string; label: string }[]
  valor: string | null
  onCambio: (id: string) => void
}

/** Opciones que vienen de un catálogo del servidor (medios de pago, tipos de movimiento), como chips de 44 px. */
export function ElegirChip({ titulo, opciones, valor, onCambio }: Props) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {opciones.map(o => {
        const elegido = o.id === valor
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: elegido, selected: elegido }}
            onPress={() => onCambio(o.id)}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: space[4],
              borderRadius: radii.pastilla,
              backgroundColor: elegido ? c.brandSoft : c.surface2,
              borderWidth: elegido ? 2 : 0,
              borderColor: c.brand,
            }}
          >
            <Text style={{ ...typeScale.secundario, color: elegido ? c.brandInk : c.text }}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
