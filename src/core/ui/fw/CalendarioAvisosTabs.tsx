import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Bell, CalendarDays, type LucideIcon } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'

export type VistaCalendarioAvisos = 'calendario' | 'avisos'

/**
 * "Calendario | Avisos N" como segmentado con ícono dentro del cuerpo (maquetas de Calendario y Avisos).
 * Es la única copia: Calendario la pinta arriba de sus controles (solo teléfono) y Avisos arriba de "Todos / Sin leer".
 * Tocar la vista que ya está elegida no hace nada.
 */
export function CalendarioAvisosTabs({ actual, sinLeer = 0, onElegir }: { actual: VistaCalendarioAvisos; sinLeer?: number; onElegir: (v: VistaCalendarioAvisos) => void }) {
  const c = useColors()
  const segmento = (valor: VistaCalendarioAvisos, label: string, Icono: LucideIcon, cuenta = 0) => {
    const elegido = valor === actual
    return (
      <Pressable
        key={valor}
        onPress={() => { if (!elegido) onElegir(valor) }}
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
  }
  return (
    <View
      testID="vista-calendario-avisos"
      accessibilityRole="tablist"
      accessibilityLabel="Calendario o avisos"
      style={{ flexDirection: 'row', gap: space[1], padding: space[1], backgroundColor: c.surface, borderRadius: radii.pastilla }}
    >
      {segmento('calendario', 'Calendario', CalendarDays)}
      {segmento('avisos', 'Avisos', Bell, sinLeer)}
    </View>
  )
}
