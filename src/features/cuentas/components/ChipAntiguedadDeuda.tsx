import React from 'react'
import { Text, View } from 'react-native'
import { AlertCircle, Clock } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { chipAntiguedadDeuda } from '../lib/antiguedadDeuda'

/** Chip "Vencida · 49 días" (rojo) / "Deuda de 27 días" (ámbar): texto + ícono, nunca solo color. Sin dato, nada. */
export function ChipAntiguedadDeuda({ dias }: { dias: number | null | undefined }) {
  const c = useColors()
  const chip = chipAntiguedadDeuda(dias)
  if (!chip) return null
  const { bg, text } = chip.tono === 'peligro' ? c.chip.anulado : c.chip.porAutorizar
  const Icono = chip.tono === 'peligro' ? AlertCircle : Clock
  return (
    <View
      accessible
      accessibilityLabel={chip.texto}
      style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space[1], backgroundColor: bg, borderRadius: radii.pastilla, paddingVertical: space[1], paddingHorizontal: 10 }}
    >
      <Icono size={14} color={text} />
      <Text style={[typeScale.etiqueta, { color: text }]}>{chip.texto}</Text>
    </View>
  )
}
