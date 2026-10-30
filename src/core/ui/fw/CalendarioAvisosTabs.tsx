import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

export type VistaCalendarioAvisos = 'calendario' | 'avisos'

/**
 * "Calendario | Avisos n" de las láminas M16 y M17: son dos solapas hermanas en la barra superior
 * (el filtro Todos / Sin leer baja al cuerpo de Avisos). Se pinta pegada al `TopBar`, con su mismo fondo.
 * En tablet van juntas (TM10) y no se muestra.
 */
export function CalendarioAvisosTabs({ actual, sinLeer = 0, onElegir }: { actual: VistaCalendarioAvisos; sinLeer?: number; onElegir: (v: VistaCalendarioAvisos) => void }) {
  const c = useColors()
  const tab = (valor: VistaCalendarioAvisos, label: string, cuenta = 0) => {
    const elegida = valor === actual
    return (
      <Pressable
        key={valor}
        onPress={() => { if (!elegida) onElegir(valor) }}
        accessibilityRole="tab"
        accessibilityLabel={cuenta > 0 ? `${label} (${cuenta})` : label}
        accessibilityState={{ selected: elegida }}
        style={{ minHeight: space[12], flexDirection: 'row', alignItems: 'center', gap: space[2], borderBottomWidth: 3, borderBottomColor: elegida ? c.brand : 'transparent' }}
      >
        <Text style={{ ...(elegida ? typeScale.cuerpoDestacado : typeScale.cuerpo), color: elegida ? c.onTopBarStrong : c.onTopBar }}>{label}</Text>
        {cuenta > 0 ? (
          <View style={{ minWidth: 24, height: 24, paddingHorizontal: space[1], borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: elegida ? c.action : c.surface2 }}>
            <Text style={{ ...typeScale.etiqueta, color: elegida ? c.onAction : c.text }}>{cuenta}</Text>
          </View>
        ) : null}
      </Pressable>
    )
  }
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Calendario o avisos"
      style={{ flexDirection: 'row', gap: space[6], paddingHorizontal: space[4], backgroundColor: c.topBar, borderBottomWidth: 1, borderBottomColor: c.topBarBorder }}
    >
      {tab('calendario', 'Calendario')}
      {tab('avisos', 'Avisos', sinLeer)}
    </View>
  )
}
