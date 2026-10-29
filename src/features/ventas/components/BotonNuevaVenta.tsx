import React from 'react'
import { Pressable, Text } from 'react-native'
import { Plus } from 'lucide-react-native'
import { radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'

interface Props {
  onPress: () => void
}

/**
 * "+ Nueva venta" flotante abajo a la derecha (lámina Main de la venta mobile). Es la variante con texto del `Fab`
 * del sistema (que es solo un ícono): mismos tokens (color de acción y la única sombra), alto de 56 px.
 */
export function BotonNuevaVenta({ onPress }: Props) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nueva venta"
      onPress={onPress}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: space[4],
          bottom: space[6],
          height: 56,
          paddingLeft: space[4],
          paddingRight: space[5],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          borderRadius: radii.pastilla,
          backgroundColor: c.action,
          opacity: pressed ? 0.85 : 1,
        },
        sombra,
      ]}
    >
      <Plus size={24} strokeWidth={2.5} color={c.onAction} />
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.onAction }}>Nueva venta</Text>
    </Pressable>
  )
}
