import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { EventoCalendario } from '@/libs/api-client/calendario'
import { cabeceraDeDia, tituloDia, type DiaSemana } from './semana'
import type { MarcaDeEntregas } from './entregas'
import { TarjetaDeEvento } from './TarjetaDeEvento'

interface Props {
  dias: DiaSemana[]
  hoy: string
  porDia: Map<string, EventoCalendario[]>
  onAbrir: (e: EventoCalendario) => void
  /** Si llegó la configuración de entregas: qué días no hay entregas y cuáles son feriado. */
  entregas: ((fecha: string) => MarcaDeEntregas) | null
  /** Dónde queda hoy dentro de la lista, para pararla ahí al abrir. */
  onHoyMedido?: (y: number) => void
}

/** La semana de lunes a domingo, un día debajo del otro, como la web en teléfono (`VistaSemanal`). */
export function VistaSemanal({ dias, hoy, porDia, onAbrir, entregas, onHoyMedido }: Props) {
  const c = useColors()
  return (
    <View accessibilityLabel="Calendario semanal" style={{ gap: space[2] }}>
      {dias.map((d) => {
        const delDia = porDia.get(d.fecha) ?? []
        const marca = entregas?.(d.fecha)
        const esHoy = d.fecha === hoy
        const tinta = esHoy ? c.onAction : c.text
        return (
          <View
            key={d.fecha}
            testID={`dia-${d.fecha}`}
            accessibilityLabel={tituloDia(d.fecha)}
            onLayout={esHoy && onHoyMedido ? (ev) => onHoyMedido(ev.nativeEvent.layout.y) : undefined}
            style={{ backgroundColor: c.surface2, borderRadius: radii.campo, padding: space[2], gap: space[2], opacity: marca?.sinEntregas ? 0.8 : 1 }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: space[1] + 2, paddingHorizontal: space[2], borderRadius: radii.campo - 2, backgroundColor: esHoy ? c.action : 'transparent' }}>
              <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: tinta }}>{cabeceraDeDia(d)}</Text>
              {esHoy ? <Text style={{ ...typeScale.etiqueta, color: tinta }}>Hoy</Text> : null}
              {marca?.feriado || marca?.sinEntregas ? (
                <Text style={{ ...typeScale.secundario, color: esHoy ? tinta : c.textSecondary, flexBasis: '100%' }}>{marca.feriado ?? 'Sin entregas'}</Text>
              ) : null}
            </View>
            {delDia.length === 0 ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary, paddingHorizontal: space[2] }}>Sin eventos</Text>
            ) : (
              delDia.map((e) => <TarjetaDeEvento key={e.clave} evento={e} onPress={() => onAbrir(e)} />)
            )}
          </View>
        )
      })}
    </View>
  )
}
