import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { DiaSemana } from './semana'

const mayuscula = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`
export const textoEventos = (n: number) => `${n} ${n === 1 ? 'evento' : 'eventos'}`

/** La semana de lunes a domingo del teléfono: el día elegido con marca, "Hoy" en vez de la abreviatura y de 1 a 3 puntos. */
export function FilaDeDias({ dias, elegido, hoy, cantidadDelDia, onElegir }: {
  dias: DiaSemana[]
  elegido: string
  hoy: string
  cantidadDelDia: (fecha: string) => number
  onElegir: (fecha: string) => void
}) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Día de la semana" style={{ flexDirection: 'row', gap: space[1], padding: space[3], backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
      {dias.map((d) => {
        const activo = d.fecha === elegido
        const n = cantidadDelDia(d.fecha)
        return (
          <Pressable
            key={d.fecha}
            onPress={() => onElegir(d.fecha)}
            accessibilityRole="radio"
            accessibilityLabel={`${d.corto} ${d.numero}, ${textoEventos(n)}`}
            accessibilityState={{ checked: activo }}
            style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radii.campo, borderWidth: activo ? 2 : 0, borderColor: c.brand, backgroundColor: activo ? c.brandSoft : 'transparent' }}
          >
            <Text style={{ ...typeScale.etiqueta, color: activo ? c.brandInk : c.textSecondary }}>{d.fecha === hoy ? 'Hoy' : mayuscula(d.corto)}</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : c.text }}>{d.numero}</Text>
            <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
              {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                <View key={i} style={{ width: 6, height: 6, borderRadius: radii.pastilla, backgroundColor: c.brand }} />
              ))}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
