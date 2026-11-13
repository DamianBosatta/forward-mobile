import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { maxFontScale, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'

/** Diámetro del botón central: el pedido del dueño ("el que destaca"). */
export const DIAMETRO_NUEVA_VENTA = 64
/** Alto de la barra inferior cuando lleva el botón central: botón + etiqueta + aire, todo dentro de sus límites (Android no entrega toques fuera del padre). */
export const ALTO_BARRA_CON_CENTRO = 96

interface Props {
  onPress: () => void
}

/**
 * "Nueva venta" al centro de la barra inferior (dirección A del inicio por perfil): botón de 64 pt en
 * color de acción con la única sombra y la etiqueta debajo. Quien lo monta decide si el usuario puede
 * crear ventas; sin ese permiso no se renderiza. Variante de `Fab`, pero dentro del flujo de la barra.
 */
export function NuevaVentaCentral({ onPress }: Props) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: space[1] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nueva venta"
        onPress={onPress}
        android_ripple={{ color: c.surface2, foreground: true }}
        style={[
          {
            width: DIAMETRO_NUEVA_VENTA,
            height: DIAMETRO_NUEVA_VENTA,
            borderRadius: radii.pastilla,
            backgroundColor: c.action,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          sombra,
        ]}
      >
        <Plus size={32} strokeWidth={2.5} color={c.onAction} />
      </Pressable>
      <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.etiqueta, color: c.brandInk }}>
        Nueva venta
      </Text>
    </View>
  )
}
