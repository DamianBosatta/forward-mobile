import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { FONT, space, typeScale, useColors } from '@/libs/theme'
import { moverDia, nombreLargo } from './semana'

/** El día del evento, de a uno con flechas. El servidor guarda el día, no la hora. */
export function SelectorDia({ fecha, onCambiar, etiqueta = 'Día', nota = 'El calendario guarda el día, no la hora' }: {
  fecha: string
  onCambiar: (fecha: string) => void
  etiqueta?: string
  nota?: string
}) {
  const c = useColors()
  const flecha = (Icono: typeof ChevronLeft, label: string, dias: number) => (
    <Pressable
      onPress={() => onCambiar(moverDia(fecha, dias).fecha)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icono size={22} color={c.text} />
    </Pressable>
  )
  return (
    <View style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, fontFamily: FONT.semibold, fontWeight: '600', color: c.text }}>{etiqueta}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {flecha(ChevronLeft, 'Día anterior', -1)}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{nombreLargo(moverDia(fecha, 0))}</Text>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{nota}</Text>
        </View>
        {flecha(ChevronRight, 'Día siguiente', 1)}
      </View>
    </View>
  )
}
