import React from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { CabeceraVentaEstado } from '../hooks/useCabeceraVenta'

/** Un solo aspecto para el día sin entregas (domingo, feriado), en cualquier orientación: tachado, nunca solo gris. */
const SIN_ENTREGAS = { textDecorationLine: 'line-through' } as const

/**
 * La tira de días de entrega: los hábiles se eligen; los feriados y los días sin reparto salen tachados.
 * La usan la pestaña Cabecera y "Confirmar pedido" (¿Cuándo se entrega?): las dos editan la misma fecha.
 */
export function TiraDeDias({ cab }: { cab: Pick<CabeceraVentaEstado, 'tira' | 'setFecha' | 'cabecera'> }) {
  const c = useColors()
  const { fecha } = cab.cabecera
  return (
    // La barra de desplazamiento queda a la vista (MV-30): sin ella no hay pista de que la fila sigue hacia la derecha.
    <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar contentContainerStyle={{ gap: space[2], paddingBottom: space[2] }}>
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
            android_ripple={{ color: c.surfaceAlt }}
            style={{ width: 56, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radii.cantidad,
              backgroundColor: sel ? c.lime : d.habil ? c.surface : c.surfaceAlt }}
          >
            {/* "mar 24": primero el día de la semana, así el número no se lee como un mes ("24 mar" parece marzo). */}
            {[d.feriado ? 'feriado' : d.nombre, String(d.numero)].map((t, i) => (
              <Text key={i} style={{ ...(i === 1 ? typeScale.cuerpoDestacado : typeScale.secundario), ...(d.habil ? null : SIN_ENTREGAS),
                color: sel ? c.ink : d.habil ? c.text : c.textSecondary }}>{t}</Text>
            ))}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
