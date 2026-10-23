import React from 'react'
import { View } from 'react-native'
import { space, useColors } from '@/libs/theme'

/** Pie fijo de los formularios de socios (láminas Nuevo y Editar): el botón de guardar siempre a mano. */
export function PieDeFormulario({ children }: { children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ padding: space[4], gap: space[2], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
      {children}
    </View>
  )
}
