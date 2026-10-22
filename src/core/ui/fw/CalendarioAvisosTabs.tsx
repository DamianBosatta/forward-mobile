import React from 'react'
import { View } from 'react-native'
import { space } from '@/libs/theme'
import { Segmented } from './Segmented'

export type VistaCalendarioAvisos = 'calendario' | 'avisos'

/**
 * "Calendario | Avisos (n)" de las láminas M16 y M17: el calendario y la bandeja son dos pantallas
 * hermanas y este selector pasa de una a la otra. En tablet van juntas (TM10) y no se muestra.
 */
export function CalendarioAvisosTabs({ actual, sinLeer = 0, onElegir }: { actual: VistaCalendarioAvisos; sinLeer?: number; onElegir: (v: VistaCalendarioAvisos) => void }) {
  return (
    <View style={{ paddingHorizontal: space[4], paddingVertical: space[2] }}>
      <Segmented<VistaCalendarioAvisos>
        accessibilityLabel="Calendario o avisos"
        value={actual}
        onChange={(v) => { if (v !== actual) onElegir(v) }}
        options={[
          { value: 'calendario', label: 'Calendario' },
          { value: 'avisos', label: sinLeer > 0 ? `Avisos (${sinLeer})` : 'Avisos' },
        ]}
      />
    </View>
  )
}
