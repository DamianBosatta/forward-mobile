import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { FiltroChip } from '@/core/ui/fw'

interface Props {
  titulo: string
  opciones: { id: string; label: string }[]
  valor: string | null
  onCambio: (id: string) => void
  /** Escribe `titulo` sobre los chips (hoy solo lo leen los lectores de pantalla). */
  tituloVisible?: boolean
  /** Tilde delante de la opción elegida (láminas de Tesorería). */
  conTilde?: boolean
}

/** Opciones que vienen de un catálogo del servidor (medios de pago, tipos de movimiento), como chips de 44 px. */
export function ElegirChip({ titulo, opciones, valor, onCambio, tituloVisible = false, conTilde = false }: Props) {
  const c = useColors()
  const chips = (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {opciones.map(o => (
        <FiltroChip key={o.id} rol="radio" label={o.label} activo={o.id === valor} conTilde={conTilde} onPress={() => onCambio(o.id)} />
      ))}
    </View>
  )
  if (!tituloVisible) return chips
  return (
    <View style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.textSecondary }}>{titulo}</Text>
      {chips}
    </View>
  )
}
