import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { MesGrilla as Mes } from './semana'

const ENCABEZADO = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

/** El mes de la lámina TM10: lunes a domingo, un punto por evento (hasta 3) y el día elegido resaltado. */
export function MesGrilla({ mes, elegido, hoy, cantidadDelDia, onElegir }: {
  mes: Mes
  elegido: string
  hoy: string
  cantidadDelDia: (fecha: string) => number
  onElegir: (fecha: string) => void
}) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={`Días de ${mes.titulo}`} style={{ gap: space[1] }}>
      <View style={{ flexDirection: 'row' }}>
        {ENCABEZADO.map((n) => (
          <Text key={n} style={{ flex: 1, textAlign: 'center', ...typeScale.etiqueta, color: c.textSecondary }}>{n}</Text>
        ))}
      </View>
      {mes.semanas.map((semana) => (
        <View key={semana[0].fecha} style={{ flexDirection: 'row', gap: space[1] }}>
          {semana.map((d) => {
            const activo = d.fecha === elegido
            const n = cantidadDelDia(d.fecha)
            return (
              <Pressable
                key={d.fecha}
                onPress={() => onElegir(d.fecha)}
                accessibilityRole="radio"
                accessibilityLabel={`${d.corto} ${d.numero}, ${n} ${n === 1 ? 'evento' : 'eventos'}${d.fecha === hoy ? ', hoy' : ''}`}
                accessibilityState={{ checked: activo }}
                style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radii.campo, borderWidth: activo ? 2 : 0, borderColor: c.brand, backgroundColor: activo ? c.brandSoft : 'transparent' }}
              >
                <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : d.delMes ? c.text : c.textSecondary, opacity: d.delMes ? 1 : 0.5 }}>{d.numero}</Text>
                <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                  {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                    <View key={i} style={{ width: 6, height: 6, borderRadius: radii.pastilla, backgroundColor: c.brand }} />
                  ))}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
