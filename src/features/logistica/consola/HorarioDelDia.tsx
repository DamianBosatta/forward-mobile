import React from 'react'
import { Text, View } from 'react-native'
import { Clock } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import type { components } from '@/libs/api-client/generated/schema'

export type HorarioDelDiaDto = components['schemas']['HorarioDelDiaDto']

/** Franjas en que el cliente recibe hoy, con el texto ya armado por la API. Sin horario no dibuja nada. */
export function HorarioDelDia({ horario }: { horario?: HorarioDelDiaDto | null }) {
  const c = useColors()
  if (!horario?.texto) return null
  return (
    <View accessible accessibilityLabel={horario.texto} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Clock size={16} color={c.textSecondary} />
      <Text style={{ ...typeScale.secundario, color: c.textSecondary, flexShrink: 1 }}>{horario.texto}</Text>
    </View>
  )
}
