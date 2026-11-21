import React, { useEffect } from 'react'
import { Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { maxFontScale, radii, shadowMd, typeScale, useColors, useIsDark } from '@/libs/theme'
import { PressableFx } from './PressableFx'

/** Diámetro del botón central: spec FWD (`.tcenter .cb`, 84). */
export const DIAMETRO_NUEVA_VENTA = 84
/** Alto de la barra inferior cuando lleva el botón central: botón + aire, todo dentro de sus límites (Android no entrega toques fuera del padre). */
export const ALTO_BARRA_CON_CENTRO = 96

/** Token `halo` de la spec §6: anillo que crece de 0.9 a 1.5 y se apaga, 1.8 s, infinito. */
export const HALO = { desde: 0.9, hasta: 1.5, opacidadInicial: 0.45, duracion: 1800 } as const

interface Props {
  onPress: () => void
}

/**
 * "Nueva venta" al centro de la barra inferior: círculo de 84 con solo el ícono (`fabBg` con ícono `onFab`)
 * y un halo que respira. La etiqueta queda para el lector de pantalla. Con Reduce Motion el halo no se
 * anima ni se dibuja. Quien lo monta decide si el usuario puede crear ventas; sin ese permiso no se renderiza.
 */
export function NuevaVentaCentral({ onPress }: Props) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const reducido = useReducedMotion()
  const t = useSharedValue(0)
  useEffect(() => {
    if (reducido) return
    t.value = 0
    t.value = withRepeat(withTiming(1, { duration: HALO.duracion, easing: Easing.out(Easing.ease) }), -1, false)
  }, [reducido, t])
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: HALO.desde + (HALO.hasta - HALO.desde) * t.value }],
    opacity: HALO.opacidadInicial * (1 - t.value),
  }))
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {reducido ? null : (
        <Animated.View
          testID="nueva-venta-halo"
          pointerEvents="none"
          style={[
            { position: 'absolute', width: DIAMETRO_NUEVA_VENTA, height: DIAMETRO_NUEVA_VENTA, borderRadius: radii.pastilla, borderWidth: 3, borderColor: c.fabBg },
            halo,
          ]}
        />
      )}
      <PressableFx
        accessibilityRole="button"
        accessibilityLabel="Nueva venta"
        onPress={onPress}
        android_ripple={{ color: c.ink, foreground: true }}
        style={[
          {
            width: DIAMETRO_NUEVA_VENTA,
            height: DIAMETRO_NUEVA_VENTA,
            borderRadius: radii.pastilla,
            backgroundColor: c.fabBg,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          sombra,
        ]}
      >
        <Plus size={44} strokeWidth={3.2} color={c.onFab} />
      </PressableFx>
      {/* Para el lector de pantalla y para quien agranda la letra: no se ve, pero está. */}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontScale}
        importantForAccessibility="no"
        style={{ ...typeScale.etiqueta, position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, color: c.text }}
      >
        Nueva venta
      </Text>
    </View>
  )
}
