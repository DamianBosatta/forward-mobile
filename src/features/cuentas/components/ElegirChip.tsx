import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

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
      {opciones.map(o => {
        const elegido = o.id === valor
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: elegido, selected: elegido }}
            onPress={() => onCambio(o.id)}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              ...(conTilde ? { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2] } : {}),
              paddingHorizontal: space[4],
              borderRadius: radii.pastilla,
              backgroundColor: elegido ? c.brandSoft : c.surface2,
              borderWidth: elegido ? 2 : 0,
              borderColor: c.brand,
            }}
          >
            {conTilde && elegido ? <View testID="chip-tilde"><Check size={18} color={c.brandInk} strokeWidth={2.5} /></View> : null}
            <Text style={{ ...typeScale.secundario, color: elegido ? c.brandInk : c.text }}>{o.label}</Text>
          </Pressable>
        )
      })}
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
