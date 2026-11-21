import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Bell, CalendarDays, type LucideIcon } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

/**
 * "Calendario | Avisos N" de la bandeja como segmentado con ícono dentro del cuerpo, arriba de "Todos / Sin leer"
 * (propuesta Cuenta, frame 8). Mismo destino que las solapas de `CalendarioAvisosTabs`, que el calendario sigue usando.
 */
export function VistaCalendarioAvisos({ sinLeer, onCalendario }: { sinLeer: number; onCalendario: () => void }) {
  const c = useColors()
  const segmento = (label: string, Icono: LucideIcon, elegido: boolean, cuenta = 0, onPress?: () => void) => (
    <Pressable
      key={label}
      onPress={elegido ? undefined : onPress}
      accessibilityRole="tab"
      accessibilityLabel={cuenta > 0 ? `${label} (${cuenta})` : label}
      accessibilityState={{ selected: elegido }}
      android_ripple={elegido ? undefined : { color: c.surfaceAlt }}
      style={{
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        paddingHorizontal: space[1],
        borderRadius: radii.pastilla,
        backgroundColor: elegido ? c.primaryBg : 'transparent',
      }}
    >
      <Icono size={18} color={elegido ? c.primaryFg : c.textSecondary} />
      <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.cuerpoDestacado, color: elegido ? c.primaryFg : c.textSecondary }}>{label}</Text>
      {cuenta > 0 ? (
        <View style={{ minWidth: 22, height: 22, paddingHorizontal: space[1], borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primaryFg }}>
          <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.etiqueta, color: c.primaryBg }}>{cuenta}</Text>
        </View>
      ) : null}
    </Pressable>
  )
  return (
    <View
      testID="vista-calendario-avisos"
      accessibilityRole="tablist"
      accessibilityLabel="Calendario o avisos"
      style={{ flexDirection: 'row', gap: space[1], padding: space[1], backgroundColor: c.surface, borderRadius: radii.pastilla }}
    >
      {segmento('Calendario', CalendarDays, false, 0, onCalendario)}
      {segmento('Avisos', Bell, true, sinLeer)}
    </View>
  )
}
