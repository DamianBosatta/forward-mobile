import React from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { CabeceraVentaEstado } from '../hooks/useCabeceraVenta'

/**
 * La tira de días de entrega: los hábiles se eligen; los feriados y los días sin reparto salen tachados.
 * La usan la pestaña Cabecera y "Confirmar pedido" (¿Cuándo se entrega?): las dos editan la misma fecha.
 */
export function TiraDeDias({ cab }: { cab: Pick<CabeceraVentaEstado, 'tira' | 'setFecha' | 'cabecera'> }) {
  const c = useColors()
  const { fecha } = cab.cabecera
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
      {cab.tira.map((d) => {
        const sel = d.dia === fecha
        return (
          <Pressable
            key={d.dia}
            disabled={!d.habil}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel, disabled: !d.habil }}
            accessibilityLabel={`${d.nombre} ${d.numero}${d.habil ? '' : `, sin entregas${d.feriado ? ` (${d.feriado})` : ''}`}`}
            onPress={() => cab.setFecha(d.dia)}
            style={{ width: 56, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo, borderWidth: 1,
              borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : d.habil ? c.surface : c.surface2 }}
          >
            {[String(d.numero), d.feriado ? 'feriado' : d.nombre].map((t, i) => (
              <Text key={i} style={{ ...(i === 0 ? typeScale.cuerpoDestacado : typeScale.secundario),
                color: sel ? c.brandInk : d.habil ? c.text : c.textSecondary, textDecorationLine: d.habil ? 'none' : 'line-through' }}>{t}</Text>
            ))}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
