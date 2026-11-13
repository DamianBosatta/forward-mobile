import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { nombreDelDia, type DiaEntrega } from './dias'

interface Props {
  dias: readonly DiaEntrega[]
  /** YYYY-MM-DD del día elegido, o null si se mira un rango. */
  elegido: string | null
  /** Los feriados que caen en la tira no se eligen (no hay entregas). */
  esFeriado: (fecha: string) => boolean
  onElegir: (fecha: string) => void
}

/**
 * Los próximos días de entrega, con los feriados tachados y deshabilitados, y el aviso del primer feriado.
 * Elegir un día filtra el tablero a esa fecha de entrega (reemplaza el rango).
 */
export function TiraDeDias({ dias, elegido, esFeriado, onElegir }: Props) {
  const c = useColors()
  const feriadoEnLaTira = dias.find((d) => esFeriado(d.fecha))
  return (
    <View style={{ gap: space[2] }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Día de entrega" style={{ flexDirection: 'row', gap: space[1] }}>
        {dias.map((d) => {
          const feriado = esFeriado(d.fecha)
          const activo = d.fecha === elegido
          return (
            <Pressable
              key={d.fecha}
              disabled={feriado}
              onPress={() => onElegir(d.fecha)}
              android_ripple={{ color: c.surface2 }}
              accessibilityRole="radio"
              accessibilityLabel={`${d.semana} ${d.numero}${d.esHoy ? ' · Hoy' : ''}${feriado ? ' · Feriado' : ''}`}
              accessibilityState={{ checked: activo, disabled: feriado }}
              style={{
                flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo,
                borderWidth: activo ? 2 : 1, borderColor: activo ? c.brand : c.border,
                backgroundColor: activo ? c.brandSoft : feriado ? c.surface2 : c.surface,
              }}
            >
              <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : feriado ? c.textSecondary : c.text, textDecorationLine: feriado ? 'line-through' : 'none' }}>{String(d.numero)}</Text>
              <Text style={{ ...typeScale.etiqueta, color: activo ? c.brandInk : c.textSecondary }}>{d.semana}</Text>
            </Pressable>
          )
        })}
      </View>
      {feriadoEnLaTira ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`El ${nombreDelDia(feriadoEnLaTira)} es feriado: no hay entregas.`}</Text>
      ) : null}
    </View>
  )
}
